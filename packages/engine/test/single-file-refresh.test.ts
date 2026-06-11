import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compileVault, ingestDirectory, initVault, listManifests, loadVaultConfig, runWatchCycle, syncTrackedFiles } from "../src/index.js";

const tempDirs: string[] = [];

async function createTempWorkspace(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "swarmvault-single-file-refresh-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function createTrackedRepoVault(): Promise<{ rootDir: string; repoDir: string }> {
  const rootDir = await createTempWorkspace();
  await initVault(rootDir);
  const repoDir = path.join(rootDir, "repo");
  await fs.mkdir(repoDir, { recursive: true });
  await fs.writeFile(path.join(repoDir, "alpha.ts"), "export function alpha() { return 1; }\n", "utf8");
  await fs.writeFile(path.join(repoDir, "beta.ts"), "export function beta() { return 2; }\n", "utf8");
  await fs.writeFile(path.join(repoDir, "guide.md"), "# Guide\n\nInitial guide.\n", "utf8");
  await ingestDirectory(rootDir, repoDir, {});
  await compileVault(rootDir);
  return { rootDir, repoDir };
}

describe("single-file graph refresh", () => {
  it("refreshes only the named file without re-walking other sources", async () => {
    const { rootDir, repoDir } = await createTrackedRepoVault();
    const alphaPath = path.join(repoDir, "alpha.ts");
    const betaPath = path.join(repoDir, "beta.ts");
    const manifestsBefore = await listManifests(rootDir);
    const betaBefore = manifestsBefore.find((manifest) => manifest.originalPath === betaPath);

    await fs.writeFile(alphaPath, "export function alpha() { return 1; }\nexport function alphaPrime() { return 11; }\n", "utf8");
    // beta.ts also changes on disk, but only alpha.ts is named — the fast
    // path must not pick beta.ts up.
    await fs.writeFile(betaPath, "export function beta() { return 2; }\nexport function betaPrime() { return 22; }\n", "utf8");

    const sync = await syncTrackedFiles(rootDir, [alphaPath]);
    expect(sync.scannedCount).toBe(1);
    expect(sync.updated.length + sync.imported.length).toBeGreaterThan(0);
    expect(sync.repoRoots).toEqual([repoDir]);

    const manifestsAfter = await listManifests(rootDir);
    const alphaAfter = manifestsAfter.find((manifest) => manifest.originalPath === alphaPath);
    const betaAfter = manifestsAfter.find((manifest) => manifest.originalPath === betaPath);
    expect(alphaAfter?.contentHash).not.toBe(manifestsBefore.find((manifest) => manifest.originalPath === alphaPath)?.contentHash);
    expect(betaAfter?.contentHash).toBe(betaBefore?.contentHash);
  });

  it("runs a full file refresh cycle through runWatchCycle and updates the graph", async () => {
    const { rootDir, repoDir } = await createTrackedRepoVault();
    const alphaPath = path.join(repoDir, "alpha.ts");
    const { paths } = await loadVaultConfig(rootDir);
    const graphBefore = JSON.parse(await fs.readFile(paths.graphPath, "utf8")) as { nodes: Array<{ label: string }> };
    expect(graphBefore.nodes.some((node) => node.label === "alphaPrime")).toBe(false);

    await fs.writeFile(alphaPath, "export function alpha() { return 1; }\nexport function alphaPrime() { return 11; }\n", "utf8");
    const result = await runWatchCycle(rootDir, { files: [alphaPath] });
    expect(result.scannedCount).toBe(1);
    expect(result.queuedFiles).toBeUndefined();

    const graphAfter = JSON.parse(await fs.readFile(paths.graphPath, "utf8")) as { nodes: Array<{ label: string }> };
    expect(graphAfter.nodes.some((node) => node.label === "alphaPrime")).toBe(true);

    const watchStatus = JSON.parse(await fs.readFile(paths.watchStatusPath, "utf8")) as {
      lastRun?: { reasons?: string[]; success?: boolean };
    };
    expect(watchStatus.lastRun?.success).toBe(true);
    expect(watchStatus.lastRun?.reasons?.some((reason) => reason.startsWith("file:"))).toBe(true);
  });

  it("routes non-code single files into pending semantic refresh instead of recompiling", async () => {
    const { rootDir, repoDir } = await createTrackedRepoVault();
    const guidePath = path.join(repoDir, "guide.md");
    await fs.writeFile(guidePath, "# Guide\n\nUpdated guide.\n", "utf8");

    const sync = await syncTrackedFiles(rootDir, [guidePath]);
    expect(sync.pendingSemanticRefresh.map((entry) => entry.path)).toContain("repo/guide.md");
    expect(sync.imported).toHaveLength(0);
    expect(sync.updated).toHaveLength(0);
  });

  it("handles deletions of named code files", async () => {
    const { rootDir, repoDir } = await createTrackedRepoVault();
    const betaPath = path.join(repoDir, "beta.ts");
    await fs.rm(betaPath);

    const sync = await syncTrackedFiles(rootDir, [betaPath]);
    expect(sync.removed.length).toBeGreaterThan(0);

    const manifestsAfter = await listManifests(rootDir);
    expect(manifestsAfter.some((manifest) => manifest.originalPath === betaPath)).toBe(false);
  });

  it("skips untracked and ignored files", async () => {
    const { rootDir, repoDir } = await createTrackedRepoVault();
    const outsidePath = path.join(await createTempWorkspace(), "outside.ts");
    await fs.writeFile(outsidePath, "export const outside = 1;\n", "utf8");

    await fs.writeFile(path.join(repoDir, ".gitignore"), "generated.ts\n", "utf8");
    const ignoredPath = path.join(repoDir, "generated.ts");
    await fs.writeFile(ignoredPath, "export const generated = 1;\n", "utf8");

    const sync = await syncTrackedFiles(rootDir, [outsidePath, ignoredPath]);
    expect(sync.imported).toHaveLength(0);
    expect(sync.updated).toHaveLength(0);
    expect(sync.skipped.map((entry) => entry.reason)).toEqual(expect.arrayContaining(["untracked", "gitignore"]));
  });

  it("queues files when another refresh holds the lock and drains the queue", async () => {
    const { rootDir, repoDir } = await createTrackedRepoVault();
    const alphaPath = path.join(repoDir, "alpha.ts");
    const betaPath = path.join(repoDir, "beta.ts");
    const { paths } = await loadVaultConfig(rootDir);
    const lockDir = path.join(path.dirname(paths.watchStatusPath), "refresh.lock");
    await fs.mkdir(lockDir, { recursive: true });

    const queued = await runWatchCycle(rootDir, { files: [alphaPath] });
    expect(queued.queuedFiles).toEqual([alphaPath]);
    expect(queued.scannedCount).toBe(0);

    await fs.rm(lockDir, { recursive: true, force: true });
    await fs.writeFile(alphaPath, "export function alpha() { return 1; }\nexport function alphaPrime() { return 11; }\n", "utf8");
    await fs.writeFile(betaPath, "export function beta() { return 2; }\nexport function betaPrime() { return 22; }\n", "utf8");

    // The queued alpha refresh from the locked attempt is drained into this
    // run alongside the directly named beta.ts.
    const result = await runWatchCycle(rootDir, { files: [betaPath] });
    expect(result.scannedCount).toBeGreaterThanOrEqual(2);

    const graphAfter = JSON.parse(await fs.readFile(paths.graphPath, "utf8")) as { nodes: Array<{ label: string }> };
    expect(graphAfter.nodes.some((node) => node.label === "alphaPrime")).toBe(true);
    expect(graphAfter.nodes.some((node) => node.label === "betaPrime")).toBe(true);
  });
});
