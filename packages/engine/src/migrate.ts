// TODO: Port orchestration, configuration, or CLI command entry points to Go in Phase 5 shell cutover.
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { initWorkspace } from "./config.js";
import { ensureMemoryLedger } from "./memory.js";
import { ensureDir } from "./utils.js";

export interface MigrationStepContext {
  rootDir: string;
  paths: {
    wikiDir: string;
    stateDir: string;
    rootDir: string;
  };
}

export interface MigrationStep {
  id: string;
  fromVersion: string;
  toVersion: string;
  description: string;
  apply(ctx: MigrationStepContext, options: { dryRun: boolean }): Promise<{ changed: string[] }>;
}

export interface MigrationPlan {
  fromVersion: string | null;
  toVersion: string;
  steps: MigrationStep[];
}

export interface MigrationResult {
  planned: number;
  applied: Array<{ id: string; changed: string[] }>;
  skipped: Array<{ id: string; reason: string }>;
  dryRun: boolean;
  fromVersion: string | null;
  toVersion: string;
}

export interface VaultVersionRecord {
  version: string;
  migratedAt: string;
  appliedSteps: string[];
}

const VAULT_VERSION_FILENAME = "vault-version.json";

async function walkMarkdownFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkMarkdownFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

async function readFrontmatterFile(filePath: string): Promise<{ data: Record<string, unknown>; content: string } | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = matter(raw);
    const data = (parsed.data ?? {}) as Record<string, unknown>;
    return { data, content: parsed.content };
  } catch {
    return null;
  }
}

async function writeFrontmatterFile(filePath: string, data: Record<string, unknown>, content: string): Promise<void> {
  await fs.writeFile(filePath, matter.stringify(content, data), "utf8");
}

function relFromRoot(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath) || filePath;
}

const MIGRATION_ADD_DECAY_FIELDS: MigrationStep = {
  id: "0.9-to-0.10-add-decay-fields",
  fromVersion: "0.9.0",
  toVersion: "0.10.0",
  description: "Add decay_score and last_confirmed_at frontmatter to pages missing them.",
  async apply(ctx, options) {
    const changed: string[] = [];
    const files = await walkMarkdownFiles(ctx.paths.wikiDir);
    for (const filePath of files) {
      const parsed = await readFrontmatterFile(filePath);
      if (!parsed) continue;
      const { data, content } = parsed;
      if (!data.page_id) continue;
      let mutated = false;
      if (data.decay_score === undefined) {
        data.decay_score = 1;
        mutated = true;
      }
      if (data.last_confirmed_at === undefined) {
        data.last_confirmed_at = (data.updated_at as string | undefined) ?? new Date().toISOString();
        mutated = true;
      }
      if (mutated) {
        if (!options.dryRun) {
          await writeFrontmatterFile(filePath, data, content);
        }
        changed.push(relFromRoot(ctx.rootDir, filePath));
      }
    }
    return { changed };
  }
};

const MIGRATION_ADD_TIER_DEFAULT: MigrationStep = {
  id: "0.9-to-0.10-add-tier-default",
  fromVersion: "0.9.0",
  toVersion: "0.10.0",
  description: 'Tag insight pages with tier: "working" when the field is absent.',
  async apply(ctx, options) {
    const changed: string[] = [];
    const insightsDir = path.join(ctx.paths.wikiDir, "insights");
    const files = await walkMarkdownFiles(insightsDir);
    for (const filePath of files) {
      const parsed = await readFrontmatterFile(filePath);
      if (!parsed) continue;
      const { data, content } = parsed;
      if (data.kind !== "insight") continue;
      if (data.tier !== undefined) continue;
      data.tier = "working";
      if (!options.dryRun) {
        await writeFrontmatterFile(filePath, data, content);
      }
      changed.push(relFromRoot(ctx.rootDir, filePath));
    }
    return { changed };
  }
};

const MIGRATION_ADD_TAGS_FIELD: MigrationStep = {
  id: "0.10-to-0.11-add-tags-field",
  fromVersion: "0.10.0",
  toVersion: "0.11.0",
  description: 'Add default tags: ["<kind>"] to derived concept and entity pages missing a tags array.',
  async apply(ctx, options) {
    const changed: string[] = [];
    const files = await walkMarkdownFiles(ctx.paths.wikiDir);
    for (const filePath of files) {
      const parsed = await readFrontmatterFile(filePath);
      if (!parsed) continue;
      const { data, content } = parsed;
      const kind = data.kind;
      if (kind !== "concept" && kind !== "entity") continue;
      if (Array.isArray(data.tags) && data.tags.length > 0) continue;
      data.tags = [kind];
      if (!options.dryRun) {
        await writeFrontmatterFile(filePath, data, content);
      }
      changed.push(relFromRoot(ctx.rootDir, filePath));
    }
    return { changed };
  }
};

const MIGRATION_NOTE_WATCH_BLOCK: MigrationStep = {
  id: "0.10-to-0.11-normalize-config-watch-absence",
  fromVersion: "0.10.0",
  toVersion: "0.11.0",
  description: "Record that swarmvault.config.json watch block is optional in 0.11 (no file changes).",
  async apply() {
    return { changed: [] };
  }
};

const MIGRATION_REBUILD_SEARCH_INDEX: MigrationStep = {
  id: "any-to-any-rebuild-search-index",
  fromVersion: "0.9.0",
  toVersion: "0.11.0",
  description: "Mark state/search.sqlite as stale so the next compile regenerates it.",
  async apply(ctx, options) {
    const changed: string[] = [];
    const searchPath = path.join(ctx.paths.stateDir, "search.sqlite");
    try {
      await fs.access(searchPath);
      if (!options.dryRun) {
        await fs.rm(searchPath, { force: true });
      }
      changed.push(relFromRoot(ctx.rootDir, searchPath));
    } catch {
      // No index present — nothing to do.
    }
    return { changed };
  }
};

const MIGRATION_ADD_MEMORY_LEDGER: MigrationStep = {
  id: "1.5-to-2.0-add-memory-ledger",
  fromVersion: "1.5.0",
  toVersion: "2.0.0",
  description: "Create the Agent Memory ledger directories and wiki index without modifying existing context packs.",
  async apply(ctx, options) {
    if (options.dryRun) {
      return {
        changed: [
          relFromRoot(ctx.rootDir, path.join(ctx.paths.stateDir, "memory", "tasks")),
          relFromRoot(ctx.rootDir, path.join(ctx.paths.wikiDir, "memory", "index.md"))
        ]
      };
    }
    return await ensureMemoryLedger(ctx.rootDir);
  }
};

const MIGRATION_3_0_RETRIEVAL_AND_TASKS: MigrationStep = {
  id: "2.0-to-3.0-retrieval-and-task-surface",
  fromVersion: "2.0.0",
  toVersion: "3.0.0",
  description:
    "Move search config into retrieval, create state/retrieval, remove the legacy search index, and add task aliases to memory frontmatter.",
  async apply(ctx, options) {
    const changed: string[] = [];
    const configPath = path.join(ctx.rootDir, "swarmvault.config.json");
    try {
      const raw = await fs.readFile(configPath, "utf8");
      const config = JSON.parse(raw) as {
        search?: { hybrid?: boolean; rerank?: boolean };
        retrieval?: Record<string, unknown>;
        tasks?: { embeddingProvider?: string };
      };
      let mutated = false;
      if (config.search) {
        config.retrieval = {
          backend: "sqlite",
          shardSize: 25000,
          hybrid: config.search.hybrid ?? true,
          rerank: config.search.rerank ?? false,
          ...(config.tasks?.embeddingProvider && !config.retrieval?.embeddingProvider
            ? { embeddingProvider: config.tasks.embeddingProvider }
            : {}),
          ...(config.retrieval ?? {})
        };
        delete config.search;
        mutated = true;
      } else if (!config.retrieval) {
        config.retrieval = {
          backend: "sqlite",
          shardSize: 25000,
          hybrid: true,
          rerank: false,
          ...(config.tasks?.embeddingProvider ? { embeddingProvider: config.tasks.embeddingProvider } : {})
        };
        mutated = true;
      }
      if (mutated) {
        if (!options.dryRun) {
          await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
        }
        changed.push(relFromRoot(ctx.rootDir, configPath));
      }
    } catch {
      // Older lite vaults may not have a config file yet.
    }

    const retrievalDir = path.join(ctx.paths.stateDir, "retrieval");
    if (!options.dryRun) {
      await ensureDir(retrievalDir);
    }
    changed.push(relFromRoot(ctx.rootDir, retrievalDir));

    const legacySearchPath = path.join(ctx.paths.stateDir, "search.sqlite");
    try {
      await fs.access(legacySearchPath);
      if (!options.dryRun) {
        await fs.rm(legacySearchPath, { force: true });
      }
      changed.push(relFromRoot(ctx.rootDir, legacySearchPath));
    } catch {
      // No legacy index present.
    }

    const memoryTaskDir = path.join(ctx.paths.wikiDir, "memory", "tasks");
    const files = await walkMarkdownFiles(memoryTaskDir);
    for (const filePath of files) {
      const parsed = await readFrontmatterFile(filePath);
      if (!parsed) continue;
      const { data, content } = parsed;
      if (data.kind !== "memory_task") continue;
      let mutated = false;
      if (data.task_id === undefined && typeof data.memory_task_id === "string") {
        data.task_id = data.memory_task_id;
        mutated = true;
      }
      if (data.task_status === undefined && typeof data.memory_status === "string") {
        data.task_status = data.memory_status;
        mutated = true;
      }
      if (Array.isArray(data.tags) && !data.tags.includes("agent-task")) {
        data.tags = [...data.tags, "agent-task"];
        mutated = true;
      }
      if (mutated) {
        if (!options.dryRun) {
          await writeFrontmatterFile(filePath, data, content);
        }
        changed.push(relFromRoot(ctx.rootDir, filePath));
      }
    }
    return { changed: [...new Set(changed)] };
  }
};

export const ALL_MIGRATIONS: readonly MigrationStep[] = [
  MIGRATION_ADD_DECAY_FIELDS,
  MIGRATION_ADD_TIER_DEFAULT,
  MIGRATION_ADD_TAGS_FIELD,
  MIGRATION_NOTE_WATCH_BLOCK,
  MIGRATION_REBUILD_SEARCH_INDEX,
  MIGRATION_ADD_MEMORY_LEDGER,
  MIGRATION_3_0_RETRIEVAL_AND_TASKS
];

function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map((part) => Number.parseInt(part, 10));
  const pb = b.split(".").map((part) => Number.parseInt(part, 10));
  for (let i = 0; i < 3; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

async function readVaultVersionRecord(stateDir: string): Promise<VaultVersionRecord | null> {
  const filePath = path.join(stateDir, VAULT_VERSION_FILENAME);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as VaultVersionRecord;
    if (typeof parsed.version === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

async function readGraphVersion(stateDir: string): Promise<string | null> {
  const filePath = path.join(stateDir, "graph.json");
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as { generatedBy?: { version?: string } };
    const version = parsed?.generatedBy?.version;
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}

export async function detectVaultVersion(rootDir: string): Promise<string | null> {
  const { paths } = await initWorkspace(rootDir);
  const record = await readVaultVersionRecord(paths.stateDir);
  if (record) return record.version;
  const graphVersion = await readGraphVersion(paths.stateDir);
  if (graphVersion) return graphVersion;
  return null;
}

async function currentPackageVersion(): Promise<string> {
  try {
    const raw = await fs.readFile(new URL("../package.json", import.meta.url), "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    return typeof parsed.version === "string" && parsed.version.trim() ? parsed.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export async function planMigration(rootDir: string, targetVersion?: string): Promise<MigrationPlan> {
  const fromVersion = await detectVaultVersion(rootDir);
  const toVersion = targetVersion ?? (await currentPackageVersion());
  const steps = ALL_MIGRATIONS.filter((step) => compareSemver(step.toVersion, toVersion) <= 0).filter((step) => {
    if (!fromVersion) return true;
    return compareSemver(step.toVersion, fromVersion) > 0;
  });
  return { fromVersion, toVersion, steps };
}

async function writeVaultVersionRecord(stateDir: string, record: VaultVersionRecord): Promise<void> {
  await fs.mkdir(stateDir, { recursive: true });
  await fs.writeFile(path.join(stateDir, VAULT_VERSION_FILENAME), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

export async function runMigration(rootDir: string, options: { targetVersion?: string; dryRun?: boolean } = {}): Promise<MigrationResult> {
  const dryRun = options.dryRun ?? true;
  const { paths } = await initWorkspace(rootDir);
  const plan = await planMigration(rootDir, options.targetVersion);
  const applied: MigrationResult["applied"] = [];
  const skipped: MigrationResult["skipped"] = [];
  const ctx: MigrationStepContext = {
    rootDir,
    paths: { wikiDir: paths.wikiDir, stateDir: paths.stateDir, rootDir }
  };
  for (const step of plan.steps) {
    const { changed } = await step.apply(ctx, { dryRun });
    if (changed.length === 0) {
      skipped.push({ id: step.id, reason: "No changes required." });
    } else {
      applied.push({ id: step.id, changed });
    }
  }
  if (!dryRun && applied.length > 0) {
    await writeVaultVersionRecord(paths.stateDir, {
      version: plan.toVersion,
      migratedAt: new Date().toISOString(),
      appliedSteps: applied.map((entry) => entry.id)
    });
  }
  return {
    planned: plan.steps.length,
    applied,
    skipped,
    dryRun,
    fromVersion: plan.fromVersion,
    toVersion: plan.toVersion
  };
}
