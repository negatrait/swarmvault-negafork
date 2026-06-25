// TODO: Port this module to Go, adhering to the 1:1 structural port paradigm (mirroring directory structures and data models) and ensuring 100% output parity.
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { loadVaultConfig } from "./config.js";
import { appendLogEntry, recordSession } from "./logs.js";
import { tierFrontmatterFragment } from "./markdown.js";
import { loadInsightPages, type StoredPage } from "./pages.js";
import type { ConsolidationConfig, ConsolidationPromotion, ConsolidationResult, GraphPage, MemoryTier, ProviderAdapter } from "./types.js";
import { ensureDir, fileExists, slugify, toPosix, writeFileIfChanged } from "./utils.js";

/**
 * LLM Wiki v2 consolidation tiers. This pass is a lightweight deterministic
 * rollup that groups working-tier insight pages into episodic digests and
 * episodic pages into semantic/procedural pages. The LLM provider (if any)
 * is only consulted for nicer titles and summaries — promotion decisions
 * themselves are heuristic so the pass works without any provider access.
 *
 * The function never deletes pages. Lower-tier pages that are rolled up get
 * a `supersededBy` pointer to the new higher-tier page. Consumers use
 * `tier` and `consolidatedFromPageIds` on the generated page to trace the
 * basis of every rollup.
 */

export const DEFAULT_CONSOLIDATION_CONFIG: Required<{
  enabled: boolean;
  workingToEpisodic: Required<NonNullable<ConsolidationConfig["workingToEpisodic"]>>;
  episodicToSemantic: Required<NonNullable<ConsolidationConfig["episodicToSemantic"]>>;
  semanticToProcedural: Required<NonNullable<ConsolidationConfig["semanticToProcedural"]>>;
}> = {
  enabled: true,
  workingToEpisodic: {
    minPages: 3,
    sessionWindowHours: 24,
    minSharedNodeRatio: 0.3
  },
  episodicToSemantic: {
    minOccurrences: 3
  },
  semanticToProcedural: {
    minWorkflowSteps: 3
  }
};

/** Episodic-to-semantic lookback window, in days. Fixed by spec. */
const SEMANTIC_LOOKBACK_DAYS = 90;

/** Workflow-tag heuristic: procedural rollup requires this tag prefix. */
const WORKFLOW_TAG_PREFIX = "kind/workflow";

export interface RunConsolidationOptions {
  /** When true, compute decisions and return them without writing any files. */
  dryRun?: boolean;
  /** Fixed clock for deterministic tests. */
  now?: Date;
}

/**
 * Resolve the default-backed consolidation config. Missing/partial config
 * objects are treated as "use all defaults".
 */
export function resolveConsolidationConfig(config?: ConsolidationConfig): {
  enabled: boolean;
  workingToEpisodic: Required<NonNullable<ConsolidationConfig["workingToEpisodic"]>>;
  episodicToSemantic: Required<NonNullable<ConsolidationConfig["episodicToSemantic"]>>;
  semanticToProcedural: Required<NonNullable<ConsolidationConfig["semanticToProcedural"]>>;
} {
  return {
    enabled: config?.enabled ?? DEFAULT_CONSOLIDATION_CONFIG.enabled,
    workingToEpisodic: {
      minPages: config?.workingToEpisodic?.minPages ?? DEFAULT_CONSOLIDATION_CONFIG.workingToEpisodic.minPages,
      sessionWindowHours:
        config?.workingToEpisodic?.sessionWindowHours ?? DEFAULT_CONSOLIDATION_CONFIG.workingToEpisodic.sessionWindowHours,
      minSharedNodeRatio: config?.workingToEpisodic?.minSharedNodeRatio ?? DEFAULT_CONSOLIDATION_CONFIG.workingToEpisodic.minSharedNodeRatio
    },
    episodicToSemantic: {
      minOccurrences: config?.episodicToSemantic?.minOccurrences ?? DEFAULT_CONSOLIDATION_CONFIG.episodicToSemantic.minOccurrences
    },
    semanticToProcedural: {
      minWorkflowSteps: config?.semanticToProcedural?.minWorkflowSteps ?? DEFAULT_CONSOLIDATION_CONFIG.semanticToProcedural.minWorkflowSteps
    }
  };
}

function jaccardRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const value of a) {
    if (b.has(value)) {
      intersection += 1;
    }
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function pageFingerprint(page: GraphPage): Set<string> {
  return new Set([
    ...page.nodeIds.map((id) => `node:${id}`),
    ...page.sourceIds.map((id) => `src:${id}`),
    ...page.relatedNodeIds.map((id) => `rel:${id}`)
  ]);
}

interface WorkingGroup {
  pages: StoredPage[];
  fingerprint: Set<string>;
}

/**
 * Group working-tier pages by time-window and shared-node overlap.
 *
 * The algorithm is intentionally simple: sort working pages by updatedAt,
 * then greedily assign each page to the first existing group whose
 * fingerprint overlaps with the page above `minSharedNodeRatio` AND whose
 * most recent page is within `sessionWindowHours`. New pages that do not
 * match any group seed a new group.
 */
function groupWorkingPages(pages: StoredPage[], sessionWindowHours: number, minSharedNodeRatio: number): WorkingGroup[] {
  const sessionWindowMs = sessionWindowHours * 60 * 60 * 1000;
  const groups: Array<WorkingGroup & { latestMs: number }> = [];
  const sorted = [...pages].sort((left, right) => left.page.updatedAt.localeCompare(right.page.updatedAt));
  for (const stored of sorted) {
    const fingerprint = pageFingerprint(stored.page);
    const updatedMs = Date.parse(stored.page.updatedAt);
    if (Number.isNaN(updatedMs)) {
      continue;
    }
    let placed = false;
    for (const group of groups) {
      if (updatedMs - group.latestMs > sessionWindowMs) {
        continue;
      }
      if (jaccardRatio(fingerprint, group.fingerprint) >= minSharedNodeRatio) {
        group.pages.push(stored);
        for (const value of fingerprint) {
          group.fingerprint.add(value);
        }
        group.latestMs = Math.max(group.latestMs, updatedMs);
        placed = true;
        break;
      }
    }
    if (!placed) {
      groups.push({
        pages: [stored],
        fingerprint,
        latestMs: updatedMs
      });
    }
  }
  return groups.map(({ pages: groupPages, fingerprint }) => ({ pages: groupPages, fingerprint }));
}

function unionStringArrays(values: string[][]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const group of values) {
    for (const value of group) {
      if (!seen.has(value)) {
        seen.add(value);
        result.push(value);
      }
    }
  }
  return result;
}

function isWorkflowTitle(title: string): string | undefined {
  const match = title
    .toLowerCase()
    .match(/\b(set\s?up|configure|install|deploy|run|build|test|debug|migrate|publish|release|onboard|refactor|benchmark)\b/);
  return match?.[1]?.replace(/\s+/g, "");
}

async function heuristicEpisodicTitle(
  groupPages: GraphPage[],
  now: Date,
  provider?: ProviderAdapter
): Promise<{ title: string; summary: string }> {
  const dateStamp = now.toISOString().slice(0, 10);
  const titles = groupPages.map((page) => page.title);
  const heuristicTitle = `Episodic: ${dateStamp} [${groupPages.length} sources]`;
  const heuristicSummary = [
    `Rolled up ${groupPages.length} working-tier pages captured on or before ${dateStamp}.`,
    `Source pages: ${titles.slice(0, 5).join("; ")}${titles.length > 5 ? "…" : ""}.`
  ].join(" ");
  if (!provider) {
    return { title: heuristicTitle, summary: heuristicSummary };
  }
  try {
    const response = await provider.generateText({
      system:
        "Summarize the following group of working-tier research notes into a concise one-paragraph episodic digest. Return a short title on the first line and the paragraph on the second line.",
      prompt: titles.map((title) => `- ${title}`).join("\n")
    });
    const lines = response.text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const title = lines[0] ? lines[0].replace(/^#+\s*/, "").slice(0, 120) : heuristicTitle;
    const summary = lines.slice(1).join(" ").slice(0, 600) || heuristicSummary;
    return { title, summary };
  } catch {
    return { title: heuristicTitle, summary: heuristicSummary };
  }
}

async function heuristicSemanticTitle(
  nodeId: string,
  occurrences: number,
  provider?: ProviderAdapter
): Promise<{ title: string; summary: string }> {
  const heuristicTitle = `Semantic: ${nodeId} [${occurrences} episodes]`;
  const heuristicSummary = `Node ${nodeId} recurred across ${occurrences} episodic digests within the last ${SEMANTIC_LOOKBACK_DAYS} days.`;
  if (!provider) {
    return { title: heuristicTitle, summary: heuristicSummary };
  }
  try {
    const response = await provider.generateText({
      system:
        "Summarize the following recurring knowledge node as a one-paragraph durable semantic fact. Return a short title on the first line and the paragraph on the second line.",
      prompt: `Node: ${nodeId}\nEpisodic occurrences: ${occurrences}`
    });
    const lines = response.text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const title = lines[0] ? lines[0].replace(/^#+\s*/, "").slice(0, 120) : heuristicTitle;
    const summary = lines.slice(1).join(" ").slice(0, 600) || heuristicSummary;
    return { title, summary };
  } catch {
    return { title: heuristicTitle, summary: heuristicSummary };
  }
}

async function heuristicProceduralTitle(
  workflow: string,
  stepTitles: string[],
  provider?: ProviderAdapter
): Promise<{ title: string; summary: string }> {
  const heuristicTitle = `Procedural: ${workflow} [${stepTitles.length} steps]`;
  const heuristicSummary = [
    `Observed workflow pattern "${workflow}" across ${stepTitles.length} semantic steps.`,
    `Steps: ${stepTitles.join(" -> ")}.`
  ].join(" ");
  if (!provider) {
    return { title: heuristicTitle, summary: heuristicSummary };
  }
  try {
    const response = await provider.generateText({
      system:
        "Summarize the following ordered steps as a concise procedural how-to knowledge page. Return a short title on the first line and the paragraph on the second line.",
      prompt: stepTitles.map((title, index) => `${index + 1}. ${title}`).join("\n")
    });
    const lines = response.text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const title = lines[0] ? lines[0].replace(/^#+\s*/, "").slice(0, 120) : heuristicTitle;
    const summary = lines.slice(1).join(" ").slice(0, 600) || heuristicSummary;
    return { title, summary };
  } catch {
    return { title: heuristicTitle, summary: heuristicSummary };
  }
}

function insightPagePath(tier: Exclude<MemoryTier, "working">, slugSource: string): string {
  return `insights/${tier}/${slugify(slugSource)}.md`;
}

/**
 * Pull the `tags` array out of a stored insight page's frontmatter so a
 * higher-tier rollup can inherit the same tag vocabulary.
 *
 * Reading tags off the raw markdown (rather than `GraphPage`) avoids
 * widening the `GraphPage` type just to carry a cosmetic field that
 * lives in frontmatter. Non-array / non-string values are ignored so
 * malformed upstream pages never crash the consolidation pass.
 */
export function extractStoredPageTags(stored: StoredPage): string[] {
  try {
    const parsed = matter(stored.content);
    const raw = parsed.data?.tags;
    if (!Array.isArray(raw)) return [];
    return raw.filter((value): value is string => typeof value === "string" && value.length > 0);
  } catch {
    return [];
  }
}

/**
 * Sort inherited insight tags deterministically while pinning the kind
 * and tier leader tags to the front. This keeps the visual convention
 * (`#insight #episodic ...`) and still guarantees stable ordering.
 */
function sortDerivedTagsForInsight(tags: string[], leaders: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const tag of tags) {
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    deduped.push(tag);
  }
  const pinned: string[] = [];
  const rest: string[] = [];
  for (const tag of deduped) {
    if (leaders.includes(tag)) continue;
    rest.push(tag);
  }
  for (const leader of leaders) {
    if (seen.has(leader)) pinned.push(leader);
  }
  rest.sort((left, right) => left.localeCompare(right));
  return [...pinned, ...rest];
}

function buildConsolidatedPage(input: {
  tier: Exclude<MemoryTier, "working">;
  title: string;
  summary: string;
  relativePath: string;
  sourcePages: GraphPage[];
  /**
   * Tags to inherit from the contributing source pages. The derived page
   * keeps its own `insight` + `tier` kind tags, then merges the union of
   * these inherited tags (deduped, sorted) so tag-based navigation can
   * pivot from a source page to its rolled-up insight without losing the
   * originating tag vocabulary.
   */
  inheritedTags?: string[];
  confidence: number;
  now: Date;
}): { page: GraphPage; content: string } {
  const { tier, title, summary, relativePath, sourcePages, confidence, now } = input;
  const pageId = `insight:${slugify(`${tier}-${relativePath.replace(/^insights\//, "").replace(/\.md$/, "")}`)}`;
  const sourceIds = unionStringArrays(sourcePages.map((page) => page.sourceIds));
  const nodeIds = unionStringArrays(sourcePages.map((page) => page.nodeIds));
  const projectIds = unionStringArrays(sourcePages.map((page) => page.projectIds));
  const relatedPageIds = sourcePages.map((page) => page.id);
  const consolidatedFromPageIds = sourcePages.map((page) => page.id);
  const createdAt = now.toISOString();
  const leaderTags = ["insight", tier];
  const projectTags = projectIds.map((projectId) => `project/${projectId}`);
  const inheritedTags = (input.inheritedTags ?? []).filter((tag): tag is string => typeof tag === "string" && tag.length > 0);
  const tags = sortDerivedTagsForInsight([...leaderTags, ...projectTags, ...inheritedTags], leaderTags);
  const frontmatter: Record<string, unknown> = {
    page_id: pageId,
    title,
    kind: "insight",
    tier,
    tags,
    consolidated_from_page_ids: consolidatedFromPageIds,
    consolidation_confidence: Math.max(0, Math.min(1, confidence)),
    source_ids: sourceIds,
    node_ids: nodeIds,
    project_ids: projectIds,
    related_page_ids: relatedPageIds,
    related_node_ids: nodeIds,
    related_source_ids: sourceIds,
    source_hashes: {},
    source_semantic_hashes: {},
    schema_hash: "",
    confidence: Math.max(0, Math.min(1, confidence)),
    status: "active",
    managed_by: "system",
    freshness: "fresh",
    created_at: createdAt,
    updated_at: createdAt,
    backlinks: [],
    compiled_from: sourceIds
  };
  const body = [
    `# ${title}`,
    "",
    summary,
    "",
    "## Rolled up from",
    "",
    ...sourcePages.map((page) => `- [[${page.path.replace(/\.md$/, "")}|${page.title}]]`),
    ""
  ].join("\n");
  const content = matter.stringify(body, frontmatter);
  const page: GraphPage = {
    id: pageId,
    path: relativePath,
    title,
    kind: "insight",
    sourceIds,
    projectIds,
    nodeIds,
    freshness: "fresh",
    status: "active",
    confidence: Math.max(0, Math.min(1, confidence)),
    backlinks: [],
    schemaHash: "",
    sourceHashes: {},
    sourceSemanticHashes: {},
    relatedPageIds,
    relatedNodeIds: nodeIds,
    relatedSourceIds: sourceIds,
    createdAt,
    updatedAt: createdAt,
    compiledFrom: sourceIds,
    managedBy: "system",
    tier,
    consolidatedFromPageIds,
    consolidationConfidence: Math.max(0, Math.min(1, confidence))
  };
  return { page, content };
}

async function markSourcePagesSuperseded(wikiDir: string, sourcePages: StoredPage[], newPageId: string): Promise<string[]> {
  const updatedPaths: string[] = [];
  for (const stored of sourcePages) {
    const absolutePath = path.join(wikiDir, stored.page.path);
    if (!(await fileExists(absolutePath))) {
      continue;
    }
    const current = await fs.readFile(absolutePath, "utf8");
    const parsed = matter(current);
    const nextData = { ...parsed.data, superseded_by: newPageId };
    const nextContent = matter.stringify(parsed.content, nextData);
    const changed = await writeFileIfChanged(absolutePath, nextContent);
    if (changed) {
      updatedPaths.push(stored.page.path);
    }
  }
  return updatedPaths;
}

async function writeConsolidatedPage(wikiDir: string, relativePath: string, content: string): Promise<boolean> {
  const absolutePath = path.join(wikiDir, relativePath);
  await ensureDir(path.dirname(absolutePath));
  return writeFileIfChanged(absolutePath, content);
}

export async function runConsolidation(
  rootDir: string,
  config: ConsolidationConfig = {},
  provider?: ProviderAdapter,
  options: RunConsolidationOptions = {}
): Promise<ConsolidationResult> {
  const resolved = resolveConsolidationConfig(config);
  const decisions: string[] = [];
  const promoted: ConsolidationPromotion[] = [];
  const newPages: GraphPage[] = [];

  if (!resolved.enabled) {
    decisions.push("consolidation disabled; no-op");
    return { promoted, newPages, decisions };
  }

  const { paths } = await loadVaultConfig(rootDir);
  const wikiDir = paths.wikiDir;
  const now = options.now ?? new Date();
  const dryRun = Boolean(options.dryRun);

  const insights = await loadInsightPages(wikiDir);
  if (!insights.length) {
    decisions.push("no insight pages found; no-op");
    return { promoted, newPages, decisions };
  }

  // Default missing tiers to "working" in memory — never writes back.
  const tieredPages: StoredPage[] = insights.map((stored) => {
    const tier: MemoryTier = stored.page.tier ?? "working";
    return {
      ...stored,
      page: {
        ...stored.page,
        tier
      }
    };
  });

  // Skip already-superseded pages from consolidation candidates.
  const working = tieredPages.filter((stored) => stored.page.tier === "working" && !stored.page.supersededBy);
  const episodic = tieredPages.filter((stored) => stored.page.tier === "episodic" && !stored.page.supersededBy);
  const semantic = tieredPages.filter((stored) => stored.page.tier === "semantic" && !stored.page.supersededBy);

  // Working → episodic.
  const groups = groupWorkingPages(working, resolved.workingToEpisodic.sessionWindowHours, resolved.workingToEpisodic.minSharedNodeRatio);
  decisions.push(`working-to-episodic: ${working.length} candidate pages, ${groups.length} group(s)`);
  for (const group of groups) {
    if (group.pages.length < resolved.workingToEpisodic.minPages) {
      decisions.push(`  skip: group of ${group.pages.length} below minPages=${resolved.workingToEpisodic.minPages}`);
      continue;
    }
    const groupPages = group.pages.map((stored) => stored.page);
    const titleSummary = await heuristicEpisodicTitle(groupPages, now, provider);
    const slugSource = `${now.toISOString().slice(0, 10)}-${groupPages.length}`;
    const relativePath = insightPagePath("episodic", slugSource);
    const confidence = Math.min(1, 0.4 + 0.1 * groupPages.length);
    const built = buildConsolidatedPage({
      tier: "episodic",
      title: titleSummary.title,
      summary: titleSummary.summary,
      relativePath,
      sourcePages: groupPages,
      inheritedTags: group.pages.flatMap((stored) => extractStoredPageTags(stored)),
      confidence,
      now
    });
    newPages.push(built.page);
    for (const stored of group.pages) {
      promoted.push({ pageId: stored.page.id, fromTier: "working", toTier: "episodic" });
    }
    decisions.push(`  promote: ${group.pages.length} working pages -> ${built.page.id}`);
    if (!dryRun) {
      await writeConsolidatedPage(wikiDir, relativePath, built.content);
      await markSourcePagesSuperseded(wikiDir, group.pages, built.page.id);
    }
  }

  // Re-load episodic set to include just-created pages when not dry-run.
  const episodicForSemantic: StoredPage[] = dryRun
    ? episodic
    : (await loadInsightPages(wikiDir)).filter((stored) => (stored.page.tier ?? "working") === "episodic" && !stored.page.supersededBy);

  // Episodic → semantic.
  const windowStart = new Date(now.getTime() - SEMANTIC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const recentEpisodic = episodicForSemantic.filter((stored) => stored.page.updatedAt >= windowStart);
  const nodeOccurrences = new Map<string, StoredPage[]>();
  for (const stored of recentEpisodic) {
    const uniqueNodes = new Set(stored.page.nodeIds);
    for (const nodeId of uniqueNodes) {
      const bucket = nodeOccurrences.get(nodeId) ?? [];
      bucket.push(stored);
      nodeOccurrences.set(nodeId, bucket);
    }
  }
  const recurring = [...nodeOccurrences.entries()]
    .filter(([, pages]) => pages.length >= resolved.episodicToSemantic.minOccurrences)
    .sort((left, right) => right[1].length - left[1].length);
  decisions.push(`episodic-to-semantic: ${recentEpisodic.length} recent episodic pages, ${recurring.length} recurring node(s)`);
  for (const [nodeId, pages] of recurring) {
    const occurrences = pages.length;
    const titleSummary = await heuristicSemanticTitle(nodeId, occurrences, provider);
    const relativePath = insightPagePath("semantic", nodeId);
    const confidence = Math.min(1, 0.5 + 0.1 * occurrences);
    const built = buildConsolidatedPage({
      tier: "semantic",
      title: titleSummary.title,
      summary: titleSummary.summary,
      relativePath,
      sourcePages: pages.map((stored) => stored.page),
      inheritedTags: pages.flatMap((stored) => extractStoredPageTags(stored)),
      confidence,
      now
    });
    // Only emit when the path does not already exist (or already belongs to this rollup).
    const existingPath = path.join(wikiDir, relativePath);
    if (await fileExists(existingPath)) {
      decisions.push(`  skip: semantic page already exists for node ${nodeId}`);
      continue;
    }
    newPages.push(built.page);
    for (const stored of pages) {
      promoted.push({ pageId: stored.page.id, fromTier: "episodic", toTier: "semantic" });
    }
    decisions.push(`  promote: node ${nodeId} across ${occurrences} episodes -> ${built.page.id}`);
    if (!dryRun) {
      await writeConsolidatedPage(wikiDir, relativePath, built.content);
    }
  }

  // Re-load semantic set for procedural pass.
  const semanticForProcedural: StoredPage[] = dryRun
    ? semantic
    : (await loadInsightPages(wikiDir)).filter((stored) => (stored.page.tier ?? "working") === "semantic" && !stored.page.supersededBy);

  // Semantic → procedural.
  // Workflow detection: look for sequences where pages share a workflow tag
  // (project id `kind/workflow` OR a recognizable verb in the title) and
  // their `consolidatedFromPageIds` chain through a shared basis.
  const workflowBuckets = new Map<string, StoredPage[]>();
  for (const stored of semanticForProcedural) {
    const tags = stored.page.projectIds ?? [];
    if (tags.some((tag) => tag.startsWith(WORKFLOW_TAG_PREFIX))) {
      const key = "kind/workflow";
      const bucket = workflowBuckets.get(key) ?? [];
      bucket.push(stored);
      workflowBuckets.set(key, bucket);
      continue;
    }
    const verb = isWorkflowTitle(stored.page.title);
    if (verb) {
      const bucket = workflowBuckets.get(verb) ?? [];
      bucket.push(stored);
      workflowBuckets.set(verb, bucket);
    }
  }
  decisions.push(`semantic-to-procedural: ${semanticForProcedural.length} semantic pages, ${workflowBuckets.size} workflow bucket(s)`);
  for (const [workflow, bucket] of workflowBuckets) {
    if (bucket.length < resolved.semanticToProcedural.minWorkflowSteps) {
      decisions.push(`  skip: workflow "${workflow}" with ${bucket.length} steps below minWorkflowSteps`);
      continue;
    }
    const ordered = [...bucket].sort((left, right) => left.page.updatedAt.localeCompare(right.page.updatedAt));
    const stepTitles = ordered.map((stored) => stored.page.title);
    const titleSummary = await heuristicProceduralTitle(workflow, stepTitles, provider);
    const relativePath = insightPagePath("procedural", workflow);
    const confidence = Math.min(1, 0.6 + 0.1 * ordered.length);
    const built = buildConsolidatedPage({
      tier: "procedural",
      title: titleSummary.title,
      summary: titleSummary.summary,
      relativePath,
      sourcePages: ordered.map((stored) => stored.page),
      inheritedTags: ordered.flatMap((stored) => extractStoredPageTags(stored)),
      confidence,
      now
    });
    const existingPath = path.join(wikiDir, relativePath);
    if (await fileExists(existingPath)) {
      decisions.push(`  skip: procedural page already exists for workflow ${workflow}`);
      continue;
    }
    newPages.push(built.page);
    for (const stored of ordered) {
      promoted.push({ pageId: stored.page.id, fromTier: "semantic", toTier: "procedural" });
    }
    decisions.push(`  promote: workflow "${workflow}" across ${ordered.length} steps -> ${built.page.id}`);
    if (!dryRun) {
      await writeConsolidatedPage(wikiDir, relativePath, built.content);
    }
  }

  // Persist the decisions trace. Both dry-run and real runs surface them in
  // the return value; we only append a log/session record for real runs.
  if (!dryRun && (promoted.length > 0 || decisions.length > 0)) {
    try {
      await appendLogEntry(rootDir, "consolidate", `Consolidated ${newPages.length} tier page(s)`, decisions.slice(0, 50));
      await recordSession(rootDir, {
        operation: "consolidate",
        title: `Consolidated ${newPages.length} tier page(s)`,
        startedAt: now.toISOString(),
        finishedAt: new Date().toISOString(),
        success: true,
        relatedPageIds: [...promoted.map((entry) => entry.pageId), ...newPages.map((page) => page.id)],
        changedPages: newPages.map((page) => page.path),
        lines: decisions.slice(0, 50)
      });
    } catch {
      // Session logging is best-effort; consolidation should not fail if
      // the state directory is read-only or missing.
    }
  }

  // Touch a couple of module-level references so tree-shaking and linters
  // do not prune helpers that future callers (graph-enrichment, UI) use.
  void tierFrontmatterFragment;
  void toPosix;

  return { promoted, newPages, decisions };
}
