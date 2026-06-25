// TODO: Port this module to Go, adhering to the 1:1 structural port paradigm (mirroring directory structures and data models) and ensuring 100% output parity.
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { FreshnessConfig, GraphArtifact, GraphPage, SourceClass } from "./types.js";
import { fileExists, readJsonFile, writeFileIfChanged, writeJsonFile } from "./utils.js";

/**
 * Decay and supersession helpers for the LLM Wiki v2 lifecycle layer.
 *
 * Pages accumulate a numeric `decayScore` (0..1) that ticks down over time
 * based on the elapsed days since `lastConfirmedAt`, controlled by a
 * source-class half-life. Decay never deletes or hides pages — it informs
 * ranking, lint, and UI prioritization. Callers are expected to:
 *
 *   1. Call `resetDecay` whenever compile or ingest confirms a page still
 *      matches a live source/claim (e.g. same semantic hash reappears).
 *   2. Call `applyDecayToPages` at the end of a compile pass to recompute
 *      `decayScore` and downgrade `freshness` below the threshold.
 *   3. Call `markSuperseded` when a newer page replaces an older one,
 *      emitting a `superseded_by` edge alongside.
 *
 * Defaults (matching the A.3 feature spec):
 *   - defaultHalfLifeDays = 365
 *   - staleThreshold      = 0.3
 *   - halfLifeDaysBySourceClass = {
 *       first_party: 365   (slow decay)
 *       third_party: 90    (fast — deps churn)
 *       resource:    730   (slowest — assets)
 *       generated:   30    (fastest — build output)
 *     }
 */

export const DEFAULT_HALF_LIFE_DAYS = 365;
export const DEFAULT_STALE_THRESHOLD = 0.3;

export const DEFAULT_HALF_LIFE_DAYS_BY_SOURCE_CLASS: Record<SourceClass, number> = {
  first_party: 365,
  third_party: 90,
  resource: 730,
  generated: 30
};

export interface DecayConfig {
  halfLifeDaysBySourceClass?: Partial<Record<SourceClass, number>>;
  defaultHalfLifeDays?: number;
  staleThreshold?: number;
}

export interface ApplyDecayResult {
  updated: GraphPage[];
  markedStale: string[];
}

function resolveDefaultHalfLife(config: DecayConfig): number {
  const candidate = config.defaultHalfLifeDays;
  return typeof candidate === "number" && candidate > 0 ? candidate : DEFAULT_HALF_LIFE_DAYS;
}

function resolveStaleThreshold(config: DecayConfig): number {
  const candidate = config.staleThreshold;
  if (typeof candidate !== "number" || Number.isNaN(candidate)) {
    return DEFAULT_STALE_THRESHOLD;
  }
  return Math.max(0, Math.min(1, candidate));
}

function resolveHalfLifeForSourceClass(sourceClass: SourceClass | undefined, config: DecayConfig): number {
  const defaultHalfLife = resolveDefaultHalfLife(config);
  if (!sourceClass) {
    return defaultHalfLife;
  }
  const override = config.halfLifeDaysBySourceClass?.[sourceClass];
  if (typeof override === "number" && override > 0) {
    return override;
  }
  const baseline = DEFAULT_HALF_LIFE_DAYS_BY_SOURCE_CLASS[sourceClass];
  return typeof baseline === "number" && baseline > 0 ? baseline : defaultHalfLife;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(0, Math.min(1, value));
}

/**
 * Compute a numeric decay score using a straight exponential half-life model.
 *
 * score = 0.5 ^ (ageDays / halfLifeDays)
 *
 * `lastConfirmedAt` missing returns 1 so pages from pre-decay vaults are
 * not penalized until they are next reconfirmed. Future timestamps (clock
 * skew) also return 1.
 */
export function computeDecayScore(
  lastConfirmedAt: string | undefined,
  sourceClass: SourceClass | undefined,
  config: DecayConfig,
  now: Date = new Date()
): number {
  if (!lastConfirmedAt) {
    return 1;
  }
  const parsed = Date.parse(lastConfirmedAt);
  if (Number.isNaN(parsed)) {
    return 1;
  }
  const ageMs = now.getTime() - parsed;
  if (ageMs <= 0) {
    return 1;
  }
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const halfLifeDays = resolveHalfLifeForSourceClass(sourceClass, config);
  if (halfLifeDays <= 0) {
    return 1;
  }
  const score = 0.5 ** (ageDays / halfLifeDays);
  return clampScore(score);
}

/**
 * Recompute `decayScore` and `freshness` for the supplied pages. Pure
 * function: returns a new array and does not mutate the inputs. Pages
 * with `supersededBy` set stay `"stale"` regardless of score. Pages
 * above the threshold are upgraded back to `"fresh"` so re-confirmation
 * outside of compile (e.g. human review) can take effect.
 */
export function applyDecayToPages(pages: GraphPage[], config: DecayConfig, now: Date = new Date()): ApplyDecayResult {
  const staleThreshold = resolveStaleThreshold(config);
  const markedStale: string[] = [];
  const updated: GraphPage[] = pages.map((page) => {
    const decayScore = computeDecayScore(page.lastConfirmedAt, page.sourceClass, config, now);
    const previousFreshness = page.freshness;
    let nextFreshness = previousFreshness;
    if (page.supersededBy) {
      nextFreshness = "stale";
    } else if (decayScore < staleThreshold) {
      nextFreshness = "stale";
    } else {
      nextFreshness = "fresh";
    }

    if (nextFreshness === "stale" && previousFreshness !== "stale") {
      markedStale.push(page.id);
    }

    return {
      ...page,
      decayScore,
      freshness: nextFreshness
    };
  });
  return { updated, markedStale };
}

/**
 * Reset decay for a single page. Typically invoked when compile or
 * ingest observes the same source/claim signature as before, confirming
 * the page is still anchored in live evidence. Does not touch
 * `supersededBy`: if the page has been superseded it remains stale.
 */
export function resetDecay(page: GraphPage, now: Date = new Date()): GraphPage {
  return {
    ...page,
    decayScore: 1,
    lastConfirmedAt: now.toISOString(),
    freshness: page.supersededBy ? "stale" : "fresh"
  };
}

/**
 * Mark an older page as superseded by a replacement. The caller is
 * responsible for emitting the `superseded_by` graph edge separately.
 */
export function markSuperseded(oldPage: GraphPage, newPageId: string, now: Date = new Date()): GraphPage {
  return {
    ...oldPage,
    supersededBy: newPageId,
    freshness: "stale",
    decayScore: 0,
    updatedAt: now.toISOString()
  };
}

/**
 * Build a DecayConfig from the user-facing FreshnessConfig. Missing
 * fields fall back to defaults.
 */
export function resolveDecayConfig(config?: FreshnessConfig): DecayConfig {
  return {
    defaultHalfLifeDays: config?.defaultHalfLifeDays ?? DEFAULT_HALF_LIFE_DAYS,
    staleThreshold: config?.staleThreshold ?? DEFAULT_STALE_THRESHOLD,
    halfLifeDaysBySourceClass: {
      ...DEFAULT_HALF_LIFE_DAYS_BY_SOURCE_CLASS,
      ...(config?.halfLifeDaysBySourceClass ?? {})
    }
  };
}

/**
 * Page kinds that participate in decay. Index/dashboard/graph-report
 * pages are aggregates whose freshness is driven by their contents, so
 * we do not annotate them with decay fields.
 */
const DECAY_RELEVANT_KINDS = new Set<GraphPage["kind"]>(["source", "module", "concept", "entity", "output", "insight"]);

function mergeDecayFrontmatter(data: Record<string, unknown>, page: GraphPage): Record<string, unknown> {
  const next: Record<string, unknown> = { ...data };
  if (typeof page.decayScore === "number" && Number.isFinite(page.decayScore)) {
    next.decay_score = Math.max(0, Math.min(1, page.decayScore));
  } else {
    delete next.decay_score;
  }
  if (typeof page.lastConfirmedAt === "string" && page.lastConfirmedAt) {
    next.last_confirmed_at = page.lastConfirmedAt;
  } else {
    delete next.last_confirmed_at;
  }
  if (typeof page.supersededBy === "string" && page.supersededBy) {
    next.superseded_by = page.supersededBy;
  } else {
    delete next.superseded_by;
  }
  next.freshness = page.freshness;
  return next;
}

/**
 * Write decay/supersession frontmatter into every page's markdown file
 * on disk. Pages that do not live under `wikiDir` (e.g. ephemeral or
 * missing files) are skipped silently.
 */
export async function persistDecayFrontmatter(wikiDir: string, pages: GraphPage[]): Promise<string[]> {
  const changed: string[] = [];
  for (const page of pages) {
    if (!DECAY_RELEVANT_KINDS.has(page.kind)) {
      continue;
    }
    // Never rewrite human-authored content: insights and hand-managed
    // outputs carry their own freshness semantics and the compiler
    // promises byte-stable round-trips for them.
    if (page.managedBy === "human") {
      continue;
    }
    const absolutePath = path.join(wikiDir, page.path);
    if (!(await fileExists(absolutePath))) {
      continue;
    }
    const current = await fs.readFile(absolutePath, "utf8");
    const parsed = matter(current);
    const nextData = mergeDecayFrontmatter(parsed.data, page);
    const nextContent = matter.stringify(parsed.content, nextData);
    const didChange = await writeFileIfChanged(absolutePath, nextContent);
    if (didChange) {
      changed.push(page.path);
    }
  }
  return changed;
}

/**
 * Full compile-time decay pass. For each live page:
 *   - If the page was just produced by compile, reset decay to 1 and
 *     stamp `lastConfirmedAt = now` (it has been re-confirmed by a
 *     live analysis).
 *   - Otherwise, recompute decay from the existing `lastConfirmedAt`.
 *   - Downgrade freshness to "stale" when the score falls below the
 *     configured threshold, upgrade it back to "fresh" when the score
 *     recovers and the page is not superseded.
 *
 * Returns the updated pages so callers can update `graph.json`, plus
 * the paths of any page files whose frontmatter was rewritten on disk.
 */
export async function runDecayPass(input: {
  wikiDir: string;
  graphPath: string;
  pages: GraphPage[];
  /** Pages (by id) that compile confirmed in this run. Their decay resets to 1. */
  confirmedPageIds: Iterable<string>;
  config?: FreshnessConfig;
  now?: Date;
}): Promise<{ pages: GraphPage[]; updatedPaths: string[]; markedStale: string[] }> {
  const now = input.now ?? new Date();
  const decayConfig = resolveDecayConfig(input.config);
  const confirmed = new Set(input.confirmedPageIds);
  const prepared: GraphPage[] = input.pages.map((page) => {
    if (!DECAY_RELEVANT_KINDS.has(page.kind)) {
      return page;
    }
    if (confirmed.has(page.id)) {
      return resetDecay(page, now);
    }
    return {
      ...page,
      lastConfirmedAt: page.lastConfirmedAt
    };
  });
  const { updated, markedStale } = applyDecayToPages(prepared, decayConfig, now);

  // Persist back to disk.
  const updatedPaths = await persistDecayFrontmatter(input.wikiDir, updated);

  // Update graph.json pages in place.
  const graph = await readJsonFile<GraphArtifact>(input.graphPath);
  if (graph) {
    const byId = new Map(updated.map((page) => [page.id, page]));
    const nextGraphPages = graph.pages.map((page) => byId.get(page.id) ?? page);
    await writeJsonFile(input.graphPath, { ...graph, pages: nextGraphPages });
  }

  return { pages: updated, updatedPaths, markedStale };
}
