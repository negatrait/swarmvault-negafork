import fs from "node:fs/promises";
import path from "node:path";
import { loadVaultConfig } from "./config.js";
import { diffLines } from "./diff.js";
import { recordSession } from "./logs.js";
import { parseStoredPage } from "./markdown.js";
import { updateGuidedSourceSessionStatus } from "./source-sessions.js";
import type {
  ApprovalDetail,
  ApprovalEntry,
  ApprovalEntryDetail,
  ApprovalManifest,
  ApprovalSummary,
  CompileState,
  GraphArtifact,
  GraphPage,
  ReviewActionResult
} from "./types.js";
import { ensureDir, fileExists, readJsonFile, writeJsonFile } from "./utils.js";
import {
  approvalGraphPath,
  approvalSummary,
  computeChangeSummary,
  computeStructuredDiff,
  computeUnifiedDiff,
  emptyCompileState,
  readApprovalManifest,
  refreshIndexesAndSearch,
  resolveApprovalTargets,
  sortGraphPages,
  stageGeneratedOutputPages,
  updateCandidateHistory,
  writeApprovalManifest
} from "./vault.js";

export async function listApprovals(rootDir: string): Promise<ApprovalSummary[]> {
  const { paths } = await loadVaultConfig(rootDir);
  const manifests = await Promise.all(
    (await fs.readdir(paths.approvalsDir, { withFileTypes: true }).catch(() => []))
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        try {
          return await readApprovalManifest(paths, entry.name);
        } catch {
          return null;
        }
      })
  );

  return manifests
    .filter((manifest): manifest is ApprovalManifest => Boolean(manifest))
    .map(approvalSummary)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function readApproval(rootDir: string, approvalId: string, options?: { diff?: boolean }): Promise<ApprovalDetail> {
  const { paths } = await loadVaultConfig(rootDir);
  const manifest = await readApprovalManifest(paths, approvalId);
  const details = await Promise.all(
    manifest.entries.map(async (entry) => {
      const currentPath = entry.previousPath ?? entry.nextPath;
      const currentContent = currentPath
        ? await fs.readFile(path.join(paths.wikiDir, currentPath), "utf8").catch(() => undefined)
        : undefined;
      const stagedContent = entry.nextPath
        ? await fs.readFile(path.join(paths.approvalsDir, approvalId, "wiki", entry.nextPath), "utf8").catch(() => undefined)
        : undefined;
      const detail: ApprovalEntryDetail = {
        ...entry,
        currentContent,
        stagedContent
      };
      detail.changeSummary = computeChangeSummary(detail.currentContent, detail.stagedContent, detail.changeType);

      const isBinaryAsset = detail.kind === "output";
      const structured = computeStructuredDiff(detail.currentContent, detail.stagedContent, isBinaryAsset);
      if (structured) {
        detail.structuredDiff = structured;
        const protectedChanges = structured.frontmatterChanges.filter((change) => change.protected);
        if (protectedChanges.length) {
          detail.warnings = ["protected_frontmatter_changed"];
        }
      }
      if (options?.diff && detail.currentContent && detail.stagedContent && !isBinaryAsset) {
        detail.diff = computeUnifiedDiff(detail.currentContent, detail.stagedContent, detail.nextPath ?? detail.pageId);
      }
      return detail;
    })
  );

  return {
    ...approvalSummary(manifest),
    entries: details
  };
}

export async function syncOutputAssets(
  paths: Awaited<ReturnType<typeof loadVaultConfig>>["paths"],
  approvalId: string,
  nextPage: GraphPage
): Promise<void> {
  if (nextPage.kind !== "output" || !nextPage.outputAssets?.length) return;
  const outputAssetDir = path.join(paths.wikiDir, "outputs", "assets", path.basename(nextPage.path, ".md"));
  await fs.rm(outputAssetDir, { recursive: true, force: true });
  for (const asset of nextPage.outputAssets) {
    const stagedAssetPath = path.join(paths.approvalsDir, approvalId, "wiki", asset.path);
    if (!(await fileExists(stagedAssetPath))) {
      continue;
    }
    const targetAssetPath = path.join(paths.wikiDir, asset.path);
    await ensureDir(path.dirname(targetAssetPath));
    await fs.copyFile(stagedAssetPath, targetAssetPath);
  }
}

export async function syncStagedEntry(
  paths: Awaited<ReturnType<typeof loadVaultConfig>>["paths"],
  approvalId: string,
  entry: ApprovalEntry,
  bundleGraph: GraphArtifact | null
): Promise<{ nextPage?: GraphPage; deletedPage?: GraphPage; stagedContent?: string }> {
  if (entry.changeType !== "delete") {
    if (!entry.nextPath) {
      throw new Error(`Approval entry ${entry.pageId} is missing a staged path.`);
    }
    const stagedAbsolutePath = path.join(paths.approvalsDir, approvalId, "wiki", entry.nextPath);
    const stagedContent = await fs.readFile(stagedAbsolutePath, "utf8");
    const targetAbsolutePath = path.join(paths.wikiDir, entry.nextPath);
    await ensureDir(path.dirname(targetAbsolutePath));
    await fs.writeFile(targetAbsolutePath, stagedContent, "utf8");

    if (entry.changeType === "promote" && entry.previousPath) {
      await fs.rm(path.join(paths.wikiDir, entry.previousPath), { force: true });
    }

    const nextPage =
      bundleGraph?.pages.find((page) => page.id === entry.pageId && page.path === entry.nextPath) ??
      parseStoredPage(entry.nextPath, stagedContent);

    await syncOutputAssets(paths, approvalId, nextPage);
    return { nextPage, stagedContent };
  } else {
    const deletedPage = bundleGraph?.pages.find((page) => page.id === entry.pageId);
    if (entry.previousPath) {
      await fs.rm(path.join(paths.wikiDir, entry.previousPath), { force: true });
    }
    return { deletedPage };
  }
}

export async function acceptApproval(rootDir: string, approvalId: string, targets: string[] = []): Promise<ReviewActionResult> {
  const startedAt = new Date().toISOString();
  const { paths } = await loadVaultConfig(rootDir);
  const manifest = await readApprovalManifest(paths, approvalId);
  const selectedEntries = resolveApprovalTargets(manifest, targets);
  const bundleGraph = await readJsonFile<GraphArtifact>(approvalGraphPath(paths, approvalId));
  const currentGraph = await readJsonFile<GraphArtifact>(paths.graphPath);
  const basePages =
    currentGraph?.pages ??
    (bundleGraph?.pages ?? []).filter((page) => page.kind === "index" || page.kind === "output" || page.kind === "insight");
  let nextPages = [...basePages];
  const compileState = (await readJsonFile<CompileState>(paths.compileStatePath)) ?? emptyCompileState();

  for (const entry of selectedEntries) {
    const { nextPage, deletedPage } = await syncStagedEntry(paths, approvalId, entry, bundleGraph);
    if (nextPage) {
      nextPages = nextPages.filter(
        (page) => page.id !== entry.pageId && page.path !== entry.nextPath && (!entry.previousPath || page.path !== entry.previousPath)
      );
      nextPages.push(nextPage);
      updateCandidateHistory(compileState, nextPage);
    } else {
      nextPages = nextPages.filter((page) => page.id !== entry.pageId && page.path !== entry.previousPath);
      updateCandidateHistory(compileState, deletedPage ?? null, true);
    }
    entry.status = "accepted";
  }

  const nextGraph: GraphArtifact = {
    generatedAt: new Date().toISOString(),
    nodes: currentGraph?.nodes ?? bundleGraph?.nodes ?? [],
    edges: currentGraph?.edges ?? bundleGraph?.edges ?? [],
    hyperedges: currentGraph?.hyperedges ?? bundleGraph?.hyperedges ?? [],
    sources: currentGraph?.sources ?? bundleGraph?.sources ?? [],
    pages: sortGraphPages(nextPages)
  };
  compileState.generatedAt = nextGraph.generatedAt;

  await writeJsonFile(paths.graphPath, nextGraph);
  await writeJsonFile(paths.compileStatePath, compileState);
  await refreshIndexesAndSearch(rootDir, nextGraph.pages);
  await writeApprovalManifest(paths, manifest);
  if (manifest.sourceSessionId) {
    await updateGuidedSourceSessionStatus(rootDir, manifest.sourceSessionId, "accepted");
  }
  await recordSession(rootDir, {
    operation: "review",
    title: `Accepted review entries from ${approvalId}`,
    startedAt,
    finishedAt: new Date().toISOString(),
    success: true,
    relatedPageIds: selectedEntries.map((entry) => entry.pageId),
    changedPages: selectedEntries.flatMap((entry) =>
      [entry.nextPath, entry.previousPath].filter((value): value is string => Boolean(value))
    ),
    lines: selectedEntries.map((entry) => `accepted=${entry.pageId}`)
  });

  return {
    ...approvalSummary(manifest),
    updatedEntries: selectedEntries.map((entry) => entry.pageId)
  };
}

export async function rejectApproval(rootDir: string, approvalId: string, targets: string[] = []): Promise<ReviewActionResult> {
  const startedAt = new Date().toISOString();
  const { paths } = await loadVaultConfig(rootDir);
  const manifest = await readApprovalManifest(paths, approvalId);
  const selectedEntries = resolveApprovalTargets(manifest, targets);
  for (const entry of selectedEntries) {
    entry.status = "rejected";
  }
  await writeApprovalManifest(paths, manifest);
  if (manifest.sourceSessionId) {
    await updateGuidedSourceSessionStatus(rootDir, manifest.sourceSessionId, "rejected");
  }
  await recordSession(rootDir, {
    operation: "review",
    title: `Rejected review entries from ${approvalId}`,
    startedAt,
    finishedAt: new Date().toISOString(),
    success: true,
    relatedPageIds: selectedEntries.map((entry) => entry.pageId),
    changedPages: [],
    lines: selectedEntries.map((entry) => `rejected=${entry.pageId}`)
  });

  return {
    ...approvalSummary(manifest),
    updatedEntries: selectedEntries.map((entry) => entry.pageId)
  };
}
