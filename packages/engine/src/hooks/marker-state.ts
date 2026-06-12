// NOTE: This file is bundled by tsup as a standalone hook script
// (`dist/hooks/marker-state.js`) and installed into user projects. It must
// only import Node builtins — no engine imports. The helpers below share
// the "has the session seen the graph report" tracking across the per-agent
// hook scripts so each agent can manage its own per-cwd state directory.

import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface MarkerState {
  dir: string;
  markerPath: string;
}

export function markerState(cwd: string, agentKey: string): MarkerState {
  const hash = crypto.createHash("sha256").update(cwd).digest("hex");
  const dir = path.join(os.tmpdir(), "swarmvault-agent-hooks", agentKey, hash);
  return {
    dir,
    markerPath: path.join(dir, "report-read")
  };
}

function flagPath(cwd: string, agentKey: string, name: string): string {
  const safeName = name.replaceAll(/[^a-z0-9-]/gi, "-");
  return path.join(markerState(cwd, agentKey).dir, safeName);
}

export async function markFlag(cwd: string, agentKey: string, name: string): Promise<void> {
  const target = flagPath(cwd, agentKey, name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, "seen\n", "utf8");
}

export async function hasFlag(cwd: string, agentKey: string, name: string): Promise<boolean> {
  try {
    await fs.access(flagPath(cwd, agentKey, name));
    return true;
  } catch {
    return false;
  }
}

export function isReportPath(value: unknown, cwd: string): boolean {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  const reportSuffix = path.join("wiki", "graph", "report.md");
  const normalized = value.replaceAll("\\", "/");
  const reportNormalized = reportSuffix.replaceAll("\\", "/");
  if (normalized.endsWith(reportNormalized)) {
    return true;
  }
  return path.resolve(cwd, value) === reportPath(cwd);
}

export function collectCandidatePaths(node: unknown, acc: string[] = []): string[] {
  if (typeof node === "string") {
    acc.push(node);
    return acc;
  }
  if (!node || typeof node !== "object") {
    return acc;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      collectCandidatePaths(item, acc);
    }
    return acc;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (["path", "filePath", "file_path", "paths", "target", "targets"].includes(key)) {
      collectCandidatePaths(value, acc);
      continue;
    }
    collectCandidatePaths(value, acc);
  }
  return acc;
}

interface HookInputCwdShape {
  cwd?: unknown;
  directory?: unknown;
  workspace?: { cwd?: unknown };
  toolInput?: { cwd?: unknown };
}

export function resolveInputCwd(input: unknown): string {
  const shaped = (input ?? {}) as HookInputCwdShape;
  const candidate =
    (typeof shaped.cwd === "string" && shaped.cwd) ||
    (typeof shaped.directory === "string" && shaped.directory) ||
    (typeof shaped.workspace?.cwd === "string" && shaped.workspace.cwd) ||
    (typeof shaped.toolInput?.cwd === "string" && shaped.toolInput.cwd) ||
    process.cwd();
  return path.resolve(candidate);
}

interface HookInputToolNameShape {
  toolName?: unknown;
  tool_name?: unknown;
  tool?: { name?: unknown };
  name?: unknown;
}

export function resolveToolName(input: unknown): string {
  const shaped = (input ?? {}) as HookInputToolNameShape;
  return String(shaped.toolName ?? shaped.tool_name ?? shaped.tool?.name ?? shaped.name ?? "");
}

interface HookInputToolInputShape {
  toolInput?: unknown;
  tool_input?: unknown;
}

export function resolveToolInput(input: unknown): unknown {
  const shaped = (input ?? {}) as HookInputToolInputShape;
  return shaped.toolInput ?? shaped.tool_input ?? {};
}

export async function hasReport(cwd: string): Promise<boolean> {
  try {
    await fs.access(reportPath(cwd));
    return true;
  } catch {
    return false;
  }
}

function artifactRootDir(cwd: string): string {
  const override = process.env.SWARMVAULT_OUT?.trim();
  if (!override) {
    return path.resolve(cwd);
  }
  return path.isAbsolute(override) ? path.resolve(override) : path.resolve(cwd, override);
}

function reportPath(cwd: string): string {
  return path.join(artifactRootDir(cwd), "wiki", "graph", "report.md");
}

export async function markReportRead(cwd: string, agentKey: string): Promise<void> {
  const state = markerState(cwd, agentKey);
  await fs.mkdir(state.dir, { recursive: true });
  await fs.writeFile(state.markerPath, "seen\n", "utf8");
}

export async function hasSeenReport(cwd: string, agentKey: string): Promise<boolean> {
  const state = markerState(cwd, agentKey);
  try {
    await fs.access(state.markerPath);
    return true;
  } catch {
    return false;
  }
}

export async function resetSession(cwd: string, agentKey: string): Promise<void> {
  const state = markerState(cwd, agentKey);
  await fs.rm(state.dir, { recursive: true, force: true });
}

export function isBroadSearchTool(toolName: string): boolean {
  return /grep|glob|search|find/i.test(toolName);
}

function collectCommandCandidates(node: unknown, acc: string[] = []): string[] {
  if (!node || typeof node !== "object") {
    return acc;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      collectCommandCandidates(item, acc);
    }
    return acc;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (["command", "cmd", "script", "bash", "shell"].includes(key) && typeof value === "string") {
      acc.push(value);
      continue;
    }
    collectCommandCandidates(value, acc);
  }
  return acc;
}

function commandLooksLikeBroadSearch(command: string): boolean {
  // A search tool reading from a pipe filters another command's output —
  // not a file search — so within each statement only the first pipeline
  // stage counts.
  const statements = command.split(/;|&&|\|\|/);
  for (const statement of statements) {
    const firstStage = statement.split("|")[0] ?? "";
    const tokens = firstStage
      .replace(/[()]/g, " ")
      .split(/\s+/)
      .map((token) => path.basename(token.replace(/^['"]|['"]$/g, "")))
      .filter(Boolean);
    const leading = tokens.find((token) => !token.includes("=") && !token.startsWith("-"));
    if (!leading) {
      continue;
    }
    if (["rg", "grep", "find", "fd", "ag", "ack"].includes(leading)) {
      return true;
    }
    if (leading === "git" && tokens[tokens.indexOf(leading) + 1] === "grep") {
      return true;
    }
  }
  return false;
}

export function isBroadSearchInput(input: unknown): boolean {
  const toolName = resolveToolName(input);
  if (isBroadSearchTool(toolName)) {
    return true;
  }
  return collectCommandCandidates(input).some(commandLooksLikeBroadSearch);
}

const VAULT_ARTIFACT_SEGMENTS = ["wiki", "raw", "state", "agent", "inbox"];

/**
 * True when a search clearly targets SwarmVault-owned artifact directories
 * (wiki/, raw/, state/, agent/, inbox/) — those searches are exempt from
 * graph-first redirection because the graph is built FROM those artifacts.
 */
export function isVaultArtifactSearch(input: unknown, cwd: string): boolean {
  const artifactRoot = artifactRootDir(cwd);
  const candidates = [...collectCandidatePaths(input), ...collectCommandCandidates(input)];
  return candidates.some((candidate) => {
    if (typeof candidate !== "string" || candidate.length === 0) {
      return false;
    }
    const normalized = candidate.replaceAll("\\", "/");
    if (
      VAULT_ARTIFACT_SEGMENTS.some(
        (segment) => normalized.includes(`${segment}/`) && normalized.match(new RegExp(`(^|[\\s'"=/])${segment}/`))
      )
    ) {
      return true;
    }
    const resolved = path.resolve(cwd, candidate);
    return VAULT_ARTIFACT_SEGMENTS.some(
      (segment) => resolved.startsWith(path.join(artifactRoot, segment) + path.sep) || resolved === path.join(artifactRoot, segment)
    );
  });
}

/**
 * True for Grep/Glob inputs scoped to one existing file — a narrow read,
 * not a broad search, so graph-first redirection does not apply.
 */
export async function isNarrowSearch(input: unknown): Promise<boolean> {
  const toolInput = resolveToolInput(input) as Record<string, unknown>;
  const candidate = toolInput?.path;
  if (typeof candidate !== "string" || candidate.length === 0) {
    return false;
  }
  try {
    const stats = await fs.stat(candidate);
    return stats.isFile();
  } catch {
    return false;
  }
}

export type GraphFirstMode = "deny" | "context" | "off";

/**
 * Resolution order: SWARMVAULT_GRAPH_FIRST env var, then `hooks.graphFirst`
 * in swarmvault.config.json, then the "context" default. Enforcement
 * ("deny", the once-per-session guided redirect) is opt-in — set it at
 * install time with `swarmvault install --agent <a> --hook --graph-first`.
 */
export async function resolveGraphFirstMode(cwd: string): Promise<GraphFirstMode> {
  const fromEnv = process.env.SWARMVAULT_GRAPH_FIRST?.trim().toLowerCase();
  if (fromEnv === "deny" || fromEnv === "context" || fromEnv === "off") {
    return fromEnv;
  }
  try {
    const raw = await fs.readFile(path.join(cwd, "swarmvault.config.json"), "utf8");
    const parsed = JSON.parse(raw) as { hooks?: { graphFirst?: unknown } };
    const fromConfig = typeof parsed?.hooks?.graphFirst === "string" ? parsed.hooks.graphFirst.toLowerCase() : "";
    if (fromConfig === "deny" || fromConfig === "context" || fromConfig === "off") {
      return fromConfig;
    }
  } catch {
    // No config or unreadable config: fall through to the default.
  }
  return "context";
}

export interface WatchStaleness {
  lastRunAt?: string;
  lastRunSuccess?: boolean;
  pendingSemanticRefreshCount: number;
}

/**
 * Cheap staleness signal read straight from the watch artifacts without
 * spawning the CLI. Returns null when no watch state exists yet.
 */
export async function readWatchStaleness(cwd: string): Promise<WatchStaleness | null> {
  const watchDir = path.join(artifactRootDir(cwd), "state", "watch");
  let lastRunAt: string | undefined;
  let lastRunSuccess: boolean | undefined;
  let pendingCount = 0;
  let found = false;
  try {
    const raw = await fs.readFile(path.join(watchDir, "status.json"), "utf8");
    const parsed = JSON.parse(raw) as { lastRun?: { finishedAt?: string; success?: boolean } };
    lastRunAt = typeof parsed?.lastRun?.finishedAt === "string" ? parsed.lastRun.finishedAt : undefined;
    lastRunSuccess = typeof parsed?.lastRun?.success === "boolean" ? parsed.lastRun.success : undefined;
    found = true;
  } catch {
    // Missing watch status is fine — vault may never have run watch.
  }
  try {
    const raw = await fs.readFile(path.join(watchDir, "pending-semantic-refresh.json"), "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      pendingCount = parsed.length;
      found = true;
    }
  } catch {
    // Missing pending list is fine.
  }
  if (!found) {
    return null;
  }
  return { lastRunAt, lastRunSuccess, pendingSemanticRefreshCount: pendingCount };
}

/** Edited-file candidates from a PostToolUse Edit/Write/NotebookEdit input. */
export function collectEditedFilePaths(input: unknown, cwd: string): string[] {
  const toolInput = resolveToolInput(input) as Record<string, unknown>;
  const candidates: string[] = [];
  for (const key of ["file_path", "filePath", "path", "notebook_path", "notebookPath"]) {
    const value = toolInput?.[key];
    if (typeof value === "string" && value.length > 0) {
      candidates.push(value);
    }
  }
  const artifactRoot = artifactRootDir(cwd);
  const resolved = candidates
    .map((candidate) => path.resolve(cwd, candidate))
    .filter(
      (absolutePath) =>
        !VAULT_ARTIFACT_SEGMENTS.some(
          (segment) =>
            absolutePath === path.join(artifactRoot, segment) || absolutePath.startsWith(path.join(artifactRoot, segment) + path.sep)
        )
    );
  return [...new Set(resolved)];
}

export async function readHookInput(): Promise<unknown> {
  let body = "";
  for await (const chunk of process.stdin) {
    body += chunk;
  }
  if (!body.trim()) {
    return {};
  }
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

export const REPORT_NOTE =
  "SwarmVault graph report exists at wiki/graph/report.md, or at $SWARMVAULT_OUT/wiki/graph/report.md when SWARMVAULT_OUT is set. Read it before broad grep/glob searching.";

const GRAPH_FIRST_COMMANDS = [
  '- `swarmvault graph query "<seed>"` — top matches with page paths plus an inline excerpt of the best page; usually answers where-is/what-calls in one command',
  '- `swarmvault graph explain "<node>"` — compact node summary with neighbors and its wiki page',
  "- `swarmvault graph blast <target>` — reverse-import impact analysis for change-impact questions",
  "- `wiki/graph/report.md` — orientation report (architecture, communities, key nodes)",
  "Do not add `--json` to these — the plain output is far smaller and already structured.",
  "Trust the graph/wiki answer for orientation questions; verify in source only when you are about to edit or the evidence conflicts. Answer directly in chat — do not write answer files unless asked for a durable artifact."
];

/** Session-start context block instructing graph-first reads. */
export function buildGraphFirstNote(staleness: WatchStaleness | null): string {
  const lines = [
    "This repo has a SwarmVault code graph. To save tokens, answer code-understanding questions (where is X, what calls Y, how is Z structured, impact of changing W) from the graph instead of reading or grepping source files:",
    ...GRAPH_FIRST_COMMANDS,
    "Read source files directly only when you are about to edit them, or when the graph lacks the detail you need.",
    "After your edits the SwarmVault hook refreshes the graph automatically."
  ];
  if (staleness?.pendingSemanticRefreshCount) {
    lines.push(
      `Note: ${staleness.pendingSemanticRefreshCount} non-code change(s) await semantic refresh — run \`swarmvault compile\` when convenient.`
    );
  }
  if (staleness?.lastRunSuccess === false) {
    lines.push(
      "Note: the last graph refresh failed — run `swarmvault graph status` then `swarmvault graph update` before relying on the graph."
    );
  }
  return lines.join("\n");
}

function extractSearchTerm(input: unknown): string {
  const toolInput = resolveToolInput(input) as Record<string, unknown>;
  for (const key of ["pattern", "query", "regex"]) {
    const value = toolInput?.[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return "<your term>";
}

/** Deny reason for the guided-redirect PreToolUse decision. */
export function buildDenyReason(toolName: string, input: unknown): string {
  const term = extractSearchTerm(input).slice(0, 120);
  return [
    `SwarmVault graph-first: this repo has a compiled code graph that answers structure questions in far fewer tokens than ${toolName || "broad search"}.`,
    `Run: swarmvault graph query "${term}" — it prints the top matches with page paths plus an inline excerpt of the best page, which usually answers the question without reading source. Add --context calls for caller/impact questions. Do not add --json (much larger output).`,
    "Trust that answer for orientation questions instead of re-verifying in source files.",
    "If the graph does not answer, repeat this exact search — it will be allowed for the rest of the session."
  ].join(" ");
}
