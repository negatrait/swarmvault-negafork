#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import type {
  AgentMemoryResumeFormat,
  AgentMemoryTaskStatus,
  AgentType,
  ContextPackFormat,
  GraphArtifact,
  GraphQueryFilters,
  GuidedSourceSessionQuestion,
  ProviderCapability,
  ProviderTaskKey,
  ProviderType,
  ResolvedPaths,
  SourceClass
} from "@swarmvaultai/engine";
import {
  acceptApproval,
  addInput,
  addManagedSource,
  addProviderConfig,
  addWatchedRoot,
  archiveCandidate,
  askChatSession,
  autoCommitWikiChanges,
  benchmarkVault,
  blastRadiusVault,
  buildContextPack,
  buildGraphShareArtifact,
  compileVault,
  consolidateVault,
  createSupersessionEdge,
  defaultVaultConfig,
  deleteChatSession,
  deleteContextPack,
  deleteManagedSource,
  doctorRetrieval,
  doctorVault,
  downloadWhisperModel,
  explainGraphVault,
  exploreVault,
  exportAiPack,
  exportGraphFormat,
  exportGraphHtml,
  exportGraphReportHtml,
  exportGraphTree,
  exportObsidianCanvas,
  exportObsidianVault,
  findGraphCycles,
  finishMemoryTask,
  getAgentInstallStatus,
  getGitHookStatus,
  getGraphStatus,
  getProviderConfigEntry,
  getRetrievalStatus,
  getWatchStatus,
  graphDiff,
  graphStatsVault,
  guideManagedSource,
  guideSourceScope,
  importInbox,
  ingestDirectory,
  ingestInputDetailed,
  initVault,
  installAgent,
  installGitHooks,
  lintVault,
  listApprovals,
  listCandidates,
  listChatSessions,
  listContextPacks,
  listGodNodes,
  listGraphCallers,
  listManagedSourceRecords,
  listManifests,
  listMemoryTasks,
  listProviderConfigEntries,
  listSchedules,
  listWatchedRoots,
  loadVaultConfig,
  mergeGraphFiles,
  pathGraphVault,
  previewCandidatePromotions,
  promoteCandidate,
  pushGraphNeo4j,
  queryGraphVault,
  queryVault,
  readApproval,
  readContextPack,
  readGraphReport,
  readMemoryTask,
  readPage,
  rebuildRetrievalIndex,
  refreshGraphClusters,
  registerLocalWhisperProvider,
  rejectApproval,
  reloadManagedSources,
  removeProviderConfig,
  removeWatchedRoot,
  renderContextPackLlms,
  renderContextPackMarkdown,
  renderGraphShareBundleFiles,
  renderGraphShareMarkdown,
  renderGraphShareSvg,
  resolvePaths,
  resumeMemoryTask,
  resumeSourceSession,
  reviewManagedSource,
  reviewSourceScope,
  runAutoPromotion,
  runMigration,
  runSchedule,
  runWatchCycle,
  serveSchedules,
  startGraphServer,
  startMcpServer,
  startMemoryTask,
  summarizeLocalWhisperSetup,
  uninstallGitHooks,
  updateMemoryTask,
  validateGraphVault,
  watchVault
} from "@swarmvaultai/engine";
import { Command, Option } from "commander";
import { collectCliNotices, collectHeuristicProviderNotice } from "./notices.js";

const program = new Command();
const CLI_VERSION = readCliVersion();
let activeCommand: Command | null = null;

program
  .name("swarmvault")
  .description("SwarmVault is a local-first knowledge compiler with graph outputs and optional provider-backed workflows.")
  .version(CLI_VERSION)
  .enablePositionalOptions()
  .option("--json", "Emit structured JSON output", false);

program.addHelpText("after", (context) =>
  context.command === program
    ? [
        "",
        "Need help choosing? Run `swarmvault next`.",
        "Advanced and compatibility commands are still available with `swarmvault <command> --help`.",
        "CLI docs: https://www.swarmvault.ai/docs/cli"
      ].join("\n")
    : ""
);

function readCliVersion(): string {
  try {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: string };
    return typeof packageJson.version === "string" && packageJson.version.trim() ? packageJson.version : "3.19.0";
  } catch {
    return "3.19.0";
  }
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const providerTypes: ProviderType[] = [
  "heuristic",
  "openai",
  "ollama",
  "anthropic",
  "gemini",
  "openai-compatible",
  "openrouter",
  "groq",
  "together",
  "xai",
  "cerebras",
  "local-whisper",
  "custom"
];

const providerCapabilities: ProviderCapability[] = [
  "responses",
  "chat",
  "structured",
  "tools",
  "vision",
  "embeddings",
  "streaming",
  "local",
  "image_generation",
  "audio"
];

const providerTaskKeys: ProviderTaskKey[] = [
  "compileProvider",
  "queryProvider",
  "lintProvider",
  "visionProvider",
  "imageProvider",
  "embeddingProvider",
  "audioProvider"
];

function parseProviderType(value: string): ProviderType {
  if (providerTypes.includes(value as ProviderType)) {
    return value as ProviderType;
  }
  throw new Error(`Unknown provider type "${value}". Use one of: ${providerTypes.join(", ")}.`);
}

function parseProviderCapability(value: string): ProviderCapability {
  if (providerCapabilities.includes(value as ProviderCapability)) {
    return value as ProviderCapability;
  }
  throw new Error(`Unknown provider capability "${value}". Use one of: ${providerCapabilities.join(", ")}.`);
}

function parseProviderTask(value: string): ProviderTaskKey {
  if (providerTaskKeys.includes(value as ProviderTaskKey)) {
    return value as ProviderTaskKey;
  }
  throw new Error(`Unknown provider task "${value}". Use one of: ${providerTaskKeys.join(", ")}.`);
}

function parsePositiveNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function collectRepeated(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function isHttpUrlInput(input: string): boolean {
  return input.startsWith("http://") || input.startsWith("https://");
}

function sourceScopeFromManifests(
  input: string,
  manifests: Array<{
    sourceId: string;
    title: string;
    sourceKind: string;
    sourceGroupId?: string;
    sourceGroupTitle?: string;
  }>
): { id: string; title: string; sourceIds: string[]; kind?: string } | null {
  if (!manifests.length) {
    return null;
  }
  const primary = manifests[0];
  return {
    id: primary?.sourceGroupId ?? primary?.sourceId ?? slugForCli(input),
    title: primary?.sourceGroupTitle ?? primary?.title ?? input,
    sourceIds: manifests.map((manifest) => manifest.sourceId),
    kind: primary?.sourceKind
  };
}

function slugForCli(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "source"
  );
}

function isJson(): boolean {
  return activeCommand?.opts().json === true || program.opts().json === true;
}

function summarizeRedactions(
  redactions?: Array<{ sourceId: string; title: string; matches: Array<{ count: number }> }>
): string | undefined {
  if (!redactions || redactions.length === 0) {
    return undefined;
  }
  const totalMatches = redactions.reduce((total, entry) => total + entry.matches.reduce((sum, match) => sum + match.count, 0), 0);
  if (totalMatches === 0) {
    return undefined;
  }
  const secretsLabel = totalMatches === 1 ? "secret" : "secrets";
  const sourceLabel = redactions.length === 1 ? "source" : "sources";
  return `Redacted ${totalMatches} ${secretsLabel} across ${redactions.length} ${sourceLabel} (run --no-redact to disable).`;
}

function topCountEntries(record: Record<string, number>, limit = 8): Array<[string, number]> {
  return Object.entries(record)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit);
}

function emitJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data)}\n`);
}

function log(message: string): void {
  if (isJson()) {
    process.stderr.write(`${message}\n`);
  } else {
    process.stdout.write(`${message}\n`);
  }
}

type NextCommandStatus = "uninitialized" | "initialized" | "compiled";
type NextCommandPriority = "high" | "medium" | "low";
type NextCommandCheckStatus = "ok" | "warning" | "error";

interface NextCommandCheck {
  id: string;
  label: string;
  status: NextCommandCheckStatus;
  summary: string;
  detail?: string;
  command?: string;
}

interface NextCommandRecommendation {
  label: string;
  command: string;
  description: string;
  priority: NextCommandPriority;
}

interface NextCommandPaths {
  configPath: string;
  schemaPath: string;
  rawDir: string;
  wikiDir: string;
  stateDir: string;
  graphPath: string;
  reportPath: string;
}

interface NextCommandReport {
  status: NextCommandStatus;
  rootDir: string;
  generatedAt: string;
  paths: NextCommandPaths;
  checks: NextCommandCheck[];
  recommendations: NextCommandRecommendation[];
  counts?: {
    sources: number;
    managedSources: number;
    pages: number;
    nodes: number;
    edges: number;
    approvalsPending: number;
    candidates: number;
    tasks: number;
    pendingSemanticRefresh: number;
  };
  graph?: {
    exists: boolean;
    reportExists: boolean;
    stale: boolean;
    codeChangeCount: number;
    semanticChangeCount: number;
    trackedRepoRoots: string[];
  };
}

function serializeNextPaths(paths: ResolvedPaths): NextCommandPaths {
  return {
    configPath: paths.configPath,
    schemaPath: paths.schemaPath,
    rawDir: paths.rawDir,
    wikiDir: paths.wikiDir,
    stateDir: paths.stateDir,
    graphPath: paths.graphPath,
    reportPath: path.join(paths.wikiDir, "graph", "report.md")
  };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function nextRecommendation(label: string, command: string, description: string, priority: NextCommandPriority): NextCommandRecommendation {
  return { label, command, description, priority };
}

function dedupeNextRecommendations(recommendations: NextCommandRecommendation[]): NextCommandRecommendation[] {
  const seen = new Set<string>();
  const rank = { high: 0, medium: 1, low: 2 } as const;
  return recommendations
    .filter((recommendation) => {
      if (seen.has(recommendation.command)) {
        return false;
      }
      seen.add(recommendation.command);
      return true;
    })
    .sort((left, right) => rank[left.priority] - rank[right.priority] || left.command.localeCompare(right.command));
}

async function buildNextCommandReport(rootDir: string): Promise<NextCommandReport> {
  const generatedAt = new Date().toISOString();
  const fallbackPaths = resolvePaths(rootDir, defaultVaultConfig());
  const fallbackNextPaths = serializeNextPaths(fallbackPaths);
  const [configExists, schemaExists] = await Promise.all([pathExists(fallbackPaths.configPath), pathExists(fallbackPaths.schemaPath)]);

  if (!configExists && !schemaExists) {
    return {
      status: "uninitialized",
      rootDir,
      generatedAt,
      paths: fallbackNextPaths,
      checks: [
        {
          id: "workspace",
          label: "Workspace",
          status: "error",
          summary: "No SwarmVault workspace files were found in this directory.",
          command: "swarmvault quickstart ./your-repo"
        }
      ],
      recommendations: [
        nextRecommendation(
          "Fast start",
          "swarmvault quickstart ./your-repo",
          "Initialize, ingest, compile, and open the graph viewer.",
          "high"
        ),
        nextRecommendation("Try a sample", "swarmvault demo", "Build a small demo vault before using your own files.", "medium"),
        nextRecommendation(
          "Manual setup",
          "swarmvault init",
          "Create an empty vault when you want to ingest and compile step by step.",
          "medium"
        )
      ]
    };
  }

  let paths: ResolvedPaths;
  try {
    ({ paths } = await loadVaultConfig(rootDir));
  } catch (error: unknown) {
    return {
      status: "initialized",
      rootDir,
      generatedAt,
      paths: fallbackNextPaths,
      checks: [
        {
          id: "config",
          label: "Config",
          status: "error",
          summary: "SwarmVault workspace files exist, but the config could not be loaded.",
          detail: error instanceof Error ? error.message : String(error),
          command: "swarmvault doctor"
        }
      ],
      recommendations: [
        nextRecommendation(
          "Inspect workspace health",
          "swarmvault doctor",
          "Review the config/schema issue before ingesting or compiling.",
          "high"
        )
      ]
    };
  }

  const nextPaths = serializeNextPaths(paths);
  const graphStatus = await getGraphStatus(rootDir).catch(() => null);
  const graphExists = graphStatus?.graphExists ?? (await pathExists(paths.graphPath));

  if (!graphExists) {
    return {
      status: "initialized",
      rootDir,
      generatedAt,
      paths: nextPaths,
      checks: [
        {
          id: "workspace",
          label: "Workspace",
          status: "ok",
          summary: "Workspace config and schema are present."
        },
        {
          id: "graph",
          label: "Graph",
          status: "error",
          summary: "No compiled graph artifact was found.",
          command: "swarmvault compile"
        }
      ],
      recommendations: [
        nextRecommendation("Add sources", "swarmvault ingest ./your-source", "Import a directory, file, or URL into raw/.", "high"),
        nextRecommendation("Compile vault", "swarmvault compile", "Build wiki pages, graph JSON, and the graph report.", "high"),
        nextRecommendation("Open the viewer", "swarmvault graph serve", "Open the local graph viewer after compiling.", "medium")
      ],
      graph: graphStatus
        ? {
            exists: graphStatus.graphExists,
            reportExists: graphStatus.reportExists,
            stale: graphStatus.stale,
            codeChangeCount: graphStatus.codeChangeCount,
            semanticChangeCount: graphStatus.semanticChangeCount,
            trackedRepoRoots: graphStatus.trackedRepoRoots
          }
        : undefined
    };
  }

  const doctor = await doctorVault(rootDir, { repair: false });
  const recommendations = dedupeNextRecommendations([
    ...(graphStatus?.recommendedCommand
      ? [
          nextRecommendation(
            graphStatus.stale ? "Refresh graph" : "Check graph",
            graphStatus.recommendedCommand,
            graphStatus.stale ? "Tracked inputs changed since the graph was compiled." : "Review graph freshness.",
            graphStatus.stale ? "high" : "medium"
          )
        ]
      : []),
    ...doctor.recommendations
      .filter((recommendation) => recommendation.command)
      .map((recommendation) =>
        nextRecommendation(
          recommendation.label,
          recommendation.command as string,
          recommendation.description ?? recommendation.summary,
          recommendation.priority
        )
      ),
    ...(doctor.recommendations.length
      ? []
      : [
          nextRecommendation(
            "Ask a question",
            'swarmvault query "What are the key concepts?"',
            "Query the compiled wiki and graph.",
            "medium"
          ),
          nextRecommendation("Open the graph", "swarmvault graph serve", "Explore the compiled graph locally.", "medium"),
          nextRecommendation("Run health checks", "swarmvault doctor", "Re-check graph, retrieval, review queues, and migrations.", "low")
        ])
  ]);

  return {
    status: "compiled",
    rootDir,
    generatedAt,
    paths: nextPaths,
    checks: doctor.checks.map((check) => ({
      id: check.id,
      label: check.label,
      status: check.status,
      summary: check.summary,
      detail: check.detail,
      command: check.actions?.[0]?.command
    })),
    recommendations,
    counts: doctor.counts,
    graph: graphStatus
      ? {
          exists: graphStatus.graphExists,
          reportExists: graphStatus.reportExists,
          stale: graphStatus.stale,
          codeChangeCount: graphStatus.codeChangeCount,
          semanticChangeCount: graphStatus.semanticChangeCount,
          trackedRepoRoots: graphStatus.trackedRepoRoots
        }
      : undefined
  };
}

function printNextCommandReport(report: NextCommandReport): void {
  if (report.status === "uninitialized") {
    log(`SwarmVault is not initialized in ${report.rootDir}.`);
    log("");
    log("Start here:");
  } else {
    log(`SwarmVault workspace: ${report.rootDir}`);
    log(`Config: ${report.paths.configPath}`);
    log(`Schema: ${report.paths.schemaPath}`);
    log(`Raw sources: ${report.paths.rawDir}`);
    log(`Wiki output: ${report.paths.wikiDir}`);
    const graphPresent = report.graph?.exists ?? report.status === "compiled";
    log(`Graph JSON: ${graphPresent ? report.paths.graphPath : `missing (${report.paths.graphPath})`}`);
    log(`Graph report: ${report.graph?.reportExists ? report.paths.reportPath : `missing (${report.paths.reportPath})`}`);
    if (report.graph) {
      log(`Graph state: ${report.graph.stale ? "stale" : "fresh"}`);
      log(`Tracked repo roots: ${report.graph.trackedRepoRoots.length ? report.graph.trackedRepoRoots.join(", ") : "none"}`);
      log(`Pending changes: ${report.graph.codeChangeCount + report.graph.semanticChangeCount}`);
    }
    if (report.counts) {
      log(
        `Counts: ${report.counts.sources} source(s), ${report.counts.pages} page(s), ${report.counts.nodes} node(s), ${report.counts.edges} edge(s).`
      );
    }
    log("");
    log(report.status === "initialized" ? "Status: initialized, not compiled yet." : "Status: compiled.");
    log("");
    log("Next steps:");
  }

  for (const recommendation of report.recommendations.slice(0, 6)) {
    log(`  ${recommendation.command}`);
    log(`    ${recommendation.description}`);
  }
}

async function writeShareBundle(
  bundlePath: string,
  files: ReturnType<typeof renderGraphShareBundleFiles>
): Promise<{
  markdownPath: string;
  postPath: string;
  svgPath: string;
  previewHtmlPath: string;
  artifactJsonPath: string;
}> {
  await mkdir(bundlePath, { recursive: true });
  const bundleFiles = {
    markdownPath: path.join(bundlePath, "share-card.md"),
    postPath: path.join(bundlePath, "share-post.txt"),
    svgPath: path.join(bundlePath, "share-card.svg"),
    previewHtmlPath: path.join(bundlePath, "share-preview.html"),
    artifactJsonPath: path.join(bundlePath, "share-artifact.json")
  };
  for (const file of files) {
    await writeFile(path.join(bundlePath, file.relativePath), file.content, "utf8");
  }
  return bundleFiles;
}

function emitNotice(message: string): void {
  process.stderr.write(`[swarmvault] ${message}\n`);
}

async function maybeEmitHeuristicNotice(commandPath: string[]): Promise<void> {
  if (isJson()) {
    return;
  }
  try {
    const { config } = await loadVaultConfig(process.cwd());
    const analysisTaskKeys = ["compileProvider", "queryProvider", "lintProvider"] as const;
    const usingHeuristic = analysisTaskKeys.every((task) => {
      const providerId = config.tasks[task];
      const providerConfig = config.providers[providerId];
      return !providerConfig || providerConfig.type === "heuristic";
    });
    if (!usingHeuristic) {
      return;
    }
    const notice = await collectHeuristicProviderNotice({
      commandPath,
      json: isJson()
    });
    if (notice) {
      emitNotice(notice);
    }
  } catch {
    // Workspace may not be initialized yet, or config may be unreadable.
    // Never let notice emission block or fail the real command.
  }
}

function canPromptGuide(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY && !isJson());
}

function readGuideAnswersFile(filePath: string | undefined): Record<string, string> | string[] | undefined {
  if (!filePath) {
    return undefined;
  }
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  if (Array.isArray(raw)) {
    return raw.filter((value): value is string => typeof value === "string");
  }
  if (raw && typeof raw === "object") {
    return Object.fromEntries(
      Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string")
    );
  }
  throw new Error("Guide answers files must contain either a JSON object keyed by question id or a JSON array of answers.");
}

async function promptGuideAnswers(questions: GuidedSourceSessionQuestion[]): Promise<Record<string, string>> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  try {
    const answers: Record<string, string> = {};
    for (const question of questions) {
      const promptLines = [question.prompt];
      if (question.answer) {
        promptLines.push(`Current: ${question.answer}`);
        promptLines.push("Press Enter to keep the current answer.");
      }
      const answer = (await rl.question(`${promptLines.join("\n")}\n> `)).trim();
      if (answer) {
        answers[question.id] = answer;
      } else if (question.answer) {
        answers[question.id] = question.answer;
      }
    }
    return answers;
  } finally {
    rl.close();
  }
}

async function completeGuideInteractively(
  guide: Awaited<ReturnType<typeof guideSourceScope>>,
  fallbackTarget: string
): Promise<Awaited<ReturnType<typeof guideSourceScope>>> {
  if (!guide.awaitingInput || !canPromptGuide()) {
    return guide;
  }
  const answers = await promptGuideAnswers(guide.questions);
  return await resumeSourceSession(process.cwd(), guide.sessionId || fallbackTarget, { answers });
}

function getCommandPath(command: Command): string[] {
  const names: string[] = [];
  let current: Command | null = command;
  while (current) {
    const name = current.name();
    if (name && name !== "swarmvault") {
      names.unshift(name);
    }
    current = current.parent ?? null;
  }
  return names;
}

async function runGraphUpdateCommand(
  targetPath: string | undefined,
  options: { lint?: boolean; force?: boolean; file?: string[] }
): Promise<void> {
  const overrideRoots = targetPath ? [path.resolve(process.cwd(), targetPath)] : undefined;
  const files = options.file?.length ? options.file.map((candidate) => path.resolve(process.cwd(), candidate)) : undefined;
  const result = await runWatchCycle(process.cwd(), {
    repo: true,
    codeOnly: true,
    lint: options.lint ?? false,
    force: options.force ?? false,
    overrideRoots,
    files
  });
  if (isJson()) {
    emitJson(result);
    return;
  }
  if (result.queuedFiles?.length && result.scannedCount === 0) {
    log(`Another refresh holds the lock. Queued ${result.queuedFiles.length} file(s) for the active refresh to fold in.`);
    return;
  }
  if (files) {
    log(
      `Refreshed ${result.scannedCount} file(s). Imported ${result.repoImportedCount}, updated ${result.repoUpdatedCount}, removed ${result.repoRemovedCount}, pending semantic refresh ${result.pendingSemanticRefreshCount}.`
    );
    return;
  }
  log(
    `Updated graph from ${result.watchedRepoRoots.length} repo root${result.watchedRepoRoots.length === 1 ? "" : "s"}. Imported ${result.repoImportedCount}, updated ${result.repoUpdatedCount}, removed ${result.repoRemovedCount}, pending semantic refresh ${result.pendingSemanticRefreshCount}.`
  );
}

async function showGraphStatusCommand(targetPath: string | undefined): Promise<void> {
  const overrideRoots = targetPath ? [path.resolve(process.cwd(), targetPath)] : undefined;
  const status = await getGraphStatus(process.cwd(), { repoRoots: overrideRoots });
  if (isJson()) {
    emitJson(status);
    return;
  }
  log(`Graph: ${status.graphExists ? status.graphPath : `missing (${status.graphPath})`}`);
  log(`Report: ${status.reportExists ? status.reportPath : `missing (${status.reportPath})`}`);
  log(`Tracked repo roots: ${status.trackedRepoRoots.length ? status.trackedRepoRoots.join(", ") : "none"}`);
  log(`Code changes: ${status.codeChangeCount}`);
  log(`Semantic changes: ${status.semanticChangeCount}`);
  log(`Pending semantic refresh: ${status.pendingSemanticRefresh.length}`);
  if (status.changes.length) {
    for (const change of status.changes.slice(0, 20)) {
      log(`- ${change.refreshType} ${change.changeType} ${change.path}`);
    }
    if (status.changes.length > 20) {
      log(`... and ${status.changes.length - 20} more`);
    }
  }
  log(`State: ${status.stale ? "stale" : "fresh"}`);
  if (status.recommendedCommand) {
    log(`Recommended: ${status.recommendedCommand}`);
  }
}

async function runGraphClusterCommand(options: { resolution?: string }, rootDir = process.cwd()): Promise<void> {
  const resolution = parsePositiveNumber(options.resolution);
  if (options.resolution && resolution === undefined) {
    throw new Error("--resolution must be a positive number.");
  }
  const result = await refreshGraphClusters(rootDir, { resolution });
  if (isJson()) {
    emitJson(result);
    return;
  }
  log(
    `Refreshed ${result.communityCount} communities across ${result.nodeCount} nodes and ${result.edgeCount} edges. Report: ${result.reportPath}`
  );
}

async function runGraphTreeCommand(options: { output?: string; root?: string; label?: string; maxChildren?: string }): Promise<void> {
  const rootDir = options.root ? path.resolve(process.cwd(), options.root) : process.cwd();
  const result = await exportGraphTree(rootDir, options.output, {
    label: options.label,
    maxChildren: parsePositiveInt(options.maxChildren, 250)
  });
  if (isJson()) {
    emitJson(result);
    return;
  }
  log(`Graph tree: ${result.outputPath}`);
  log(`Sources: ${result.sourceCount}; nodes: ${result.nodeCount}.`);
}

async function runGraphMergeCommand(graphPaths: string[], options: { out: string; label?: string }): Promise<void> {
  const result = await mergeGraphFiles(
    graphPaths.map((inputPath) => path.resolve(process.cwd(), inputPath)),
    path.resolve(process.cwd(), options.out),
    { label: options.label }
  );
  if (isJson()) {
    emitJson(result);
    return;
  }
  log(
    `Merged ${result.inputGraphs.length} graph${result.inputGraphs.length === 1 ? "" : "s"} into ${result.outputPath}. Nodes ${result.graph.nodes.length}, edges ${result.graph.edges.length}.`
  );
  for (const warning of result.warnings) {
    log(`Warning: ${warning}`);
  }
}

async function runScanCommand(
  input: string,
  options: {
    port?: string;
    serve?: boolean;
    viz?: boolean;
    branch?: string;
    ref?: string;
    checkoutDir?: string;
    mcp?: boolean;
    installAgentRules?: boolean;
  }
): Promise<void> {
  const rootDir = process.cwd();
  const progress = !isJson() && !options.mcp;
  await initVault(rootDir, { installAgentRules: options.installAgentRules ?? false });
  if (!isJson()) {
    log("Initialized workspace.");
  }

  const result = isHttpUrlInput(input)
    ? await addManagedSource(rootDir, input, {
        compile: true,
        brief: false,
        branch: options.branch,
        ref: options.ref,
        checkoutDir: options.checkoutDir
      })
    : await ingestScanInput(rootDir, input, progress);
  if (!isJson()) {
    if ("source" in result) {
      log(
        `Registered ${result.source.kind} source ${result.source.id}. Imported ${result.source.lastSyncCounts?.importedCount ?? 0}, updated ${result.source.lastSyncCounts?.updatedCount ?? 0}.`
      );
    } else if ("inputDir" in result) {
      log(`Ingested ${result.imported.length} file(s).`);
    } else {
      const sourceCount = result.created.length + result.updated.length + result.unchanged.length;
      log(`Ingested ${sourceCount} source(s).`);
    }
  }

  const compiled = "compile" in result && result.compile ? result.compile : await compileVault(rootDir, {});
  const { paths } = await loadVaultConfig(rootDir);
  const shareCardPath = path.join(paths.wikiDir, "graph", "share-card.md");
  const shareCardSvgPath = path.join(paths.wikiDir, "graph", "share-card.svg");
  const shareKitPath = path.join(paths.wikiDir, "graph", "share-kit");
  if (!isJson()) {
    log(`Compiled ${compiled.sourceCount} source(s), ${compiled.pageCount} page(s).`);
    log(`Vault workspace: ${rootDir}`);
    log(`Raw sources: ${paths.rawDir}`);
    log(`Wiki output: ${paths.wikiDir}`);
    log(`Graph JSON: ${paths.graphPath}`);
    log(`Share card: ${shareCardPath}`);
    log(`Visual card: ${shareCardSvgPath}`);
    log(`Share kit: ${shareKitPath}`);
    log("");
    log("Next steps:");
    log('  swarmvault query "What are the key concepts?"');
    log("  swarmvault graph serve");
    log("  swarmvault doctor");
    log("  swarmvault candidate list");
    log("  swarmvault next");
  }

  if (options.mcp) {
    process.stderr.write(`${JSON.stringify({ status: "running", transport: "stdio", compiled: compiled.sourceCount })}\n`);
    const controller = await startMcpServer(rootDir);
    process.on("SIGINT", async () => {
      try {
        await controller.close();
      } catch {}
      process.exit(0);
    });
    return;
  }

  if (options.serve !== false && options.viz !== false) {
    const port = options.port ? parsePositiveInt(options.port, 0) || undefined : undefined;
    const server = await startGraphServer(rootDir, port, { full: false });
    if (isJson()) {
      emitJson({
        ...result,
        compiled,
        shareCardPath,
        shareCardSvgPath,
        shareKitPath,
        port: server.port,
        url: `http://localhost:${server.port}`
      });
    } else {
      log(`Graph viewer running at http://localhost:${server.port}`);
      log("Next orientation: swarmvault next");
    }
    process.on("SIGINT", async () => {
      try {
        await server.close();
      } catch {}
      process.exit(0);
    });
  } else if (isJson()) {
    emitJson({ ...result, compiled, shareCardPath, shareCardSvgPath, shareKitPath });
  }
}

async function ingestScanInput(rootDir: string, input: string, progress: boolean) {
  const absoluteInput = path.resolve(rootDir, input);
  const inputStat = await stat(absoluteInput);
  if (inputStat.isDirectory()) {
    return ingestDirectory(rootDir, input, { progress });
  }
  if (inputStat.isFile()) {
    return ingestInputDetailed(rootDir, input, { progress });
  }
  throw new Error(`Input must be a file or directory: ${input}`);
}

async function resolveChatResumeId(resume: boolean | string | undefined): Promise<string | undefined> {
  if (!resume) {
    return undefined;
  }
  if (typeof resume === "string") {
    return resume;
  }
  const sessions = await listChatSessions(process.cwd());
  return sessions[0]?.id;
}

function logChatSessions(sessions: Awaited<ReturnType<typeof listChatSessions>>): void {
  if (!sessions.length) {
    log("No chat sessions yet.");
    return;
  }
  for (const session of sessions) {
    log(`${session.id}  ${session.turnCount} turn${session.turnCount === 1 ? "" : "s"}  ${session.title}`);
    log(`  updated: ${session.updatedAt}`);
    log(`  markdown: ${session.markdownPath}`);
  }
}

async function runChatQuestion(
  question: string,
  options: {
    resume?: boolean | string;
    saveOutput?: boolean;
    gapFill?: boolean;
    format?: "markdown" | "report" | "slides" | "chart" | "image";
    maxHistoryTurns?: string;
  }
): Promise<Awaited<ReturnType<typeof askChatSession>>> {
  const sessionId = await resolveChatResumeId(options.resume);
  return askChatSession(process.cwd(), {
    question,
    sessionId,
    saveOutput: options.saveOutput ?? false,
    gapFill: options.gapFill ?? false,
    format: options.format,
    maxHistoryTurns: parsePositiveInt(options.maxHistoryTurns, 6)
  });
}

async function runInteractiveChat(options: {
  resume?: boolean | string;
  saveOutput?: boolean;
  gapFill?: boolean;
  format?: "markdown" | "report" | "slides" | "chart" | "image";
  maxHistoryTurns?: string;
}): Promise<void> {
  if (isJson()) {
    throw new Error("Interactive chat is not available with --json. Pass a question for one-shot JSON output.");
  }
  if (!process.stdin.isTTY) {
    throw new Error("Pass a chat question, or run `swarmvault chat` in an interactive terminal.");
  }

  let sessionId = await resolveChatResumeId(options.resume);
  log(sessionId ? `Resuming chat session ${sessionId}.` : "Starting a new chat session.");
  log("Type /help for commands or /exit to quit.");

  const reader = createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (true) {
      const input = (await reader.question("swarmvault> ")).trim();
      if (!input) {
        continue;
      }
      if (input === "/exit" || input === "/quit") {
        break;
      }
      if (input === "/help") {
        log(
          [
            "/help              Show commands",
            "/sessions          List chat sessions",
            "/status            Show vault health summary",
            "/clear             Start a fresh session",
            "/exit              Quit"
          ].join("\n")
        );
        continue;
      }
      if (input === "/sessions") {
        logChatSessions(await listChatSessions(process.cwd()));
        continue;
      }
      if (input === "/status") {
        const report = await doctorVault(process.cwd(), {});
        log(`Vault health: ${report.ok ? "ok" : "needs attention"} (${report.recommendations.length} recommendation(s))`);
        for (const recommendation of report.recommendations.slice(0, 5)) {
          log(`- ${recommendation.label}: ${recommendation.command ?? recommendation.summary}`);
        }
        continue;
      }
      if (input === "/clear") {
        sessionId = undefined;
        log("Started a fresh chat session.");
        continue;
      }

      const result = await askChatSession(process.cwd(), {
        question: input,
        sessionId,
        saveOutput: options.saveOutput ?? false,
        gapFill: options.gapFill ?? false,
        format: options.format,
        maxHistoryTurns: parsePositiveInt(options.maxHistoryTurns, 6)
      });
      sessionId = result.session.id;
      log(result.answer);
      log(`Session: ${result.session.id}`);
      log(`Saved transcript: ${result.markdownPath}`);
      await maybeEmitHeuristicNotice(["chat"]);
    }
  } finally {
    reader.close();
  }
}

program.hook("postAction", async (_thisCommand, actionCommand) => {
  const commandPath = getCommandPath(actionCommand);
  if (commandPath[0] === "next" || commandPath[0] === "quickstart" || commandPath[0] === "init") {
    return;
  }
  const notices = await collectCliNotices({
    commandPath,
    currentVersion: CLI_VERSION,
    json: isJson()
  });
  for (const notice of notices) {
    emitNotice(notice);
  }
});

program
  .command("next")
  .description("Show the safest next command for this directory without changing files.")
  .action(async () => {
    const report = await buildNextCommandReport(process.cwd());
    if (isJson()) {
      emitJson(report);
      return;
    }
    printNextCommandReport(report);
  });

program
  .command("quickstart")
  .description("Beginner path: initialize, ingest, compile, and optionally open the graph viewer in one command.")
  .argument("<input>", "Directory or public GitHub repo root URL to turn into a vault")
  .option("--port <port>", "Port for the graph viewer")
  .option("--no-serve", "Skip launching the graph viewer after compile")
  .option("--no-viz", "Compatibility alias for --no-serve; skip launching the graph viewer after compile")
  .option("--mcp", "Start the MCP stdio server after compile instead of launching the graph viewer", false)
  .option("--branch <name>", "GitHub branch to clone when the input is a public repo URL")
  .option("--ref <ref>", "Git ref, tag, or commit to check out when the input is a public repo URL")
  .option("--checkout-dir <path>", "Persistent checkout directory for a public GitHub repo input")
  .option("--install-agent-rules", "Install configured agent rule files during initialization", false)
  .action(runScanCommand);

program
  .command("init")
  .description("Initialize a SwarmVault workspace in the current directory.")
  .option("--obsidian", "Generate a minimal .obsidian workspace alongside the vault", false)
  .option(
    "--profile <profile>",
    "Starter workspace profile or comma-separated preset list (for example: personal-research or reader,timeline)"
  )
  .option(
    "--lite",
    "Minimal LLM-Wiki starter (raw/, wiki/, wiki/index.md, wiki/log.md, swarmvault.schema.md) without config, state, or agent installs",
    false
  )
  .option("--install-agent-rules", "Install configured agent rule files during initialization", false)
  .action(async (options: { obsidian?: boolean; profile?: string; lite?: boolean; installAgentRules?: boolean }) => {
    await initVault(process.cwd(), {
      obsidian: options.obsidian ?? false,
      profile: options.profile,
      lite: options.lite ?? false,
      installAgentRules: options.installAgentRules ?? false
    });
    if (isJson()) {
      emitJson({
        status: "initialized",
        rootDir: process.cwd(),
        obsidian: options.obsidian ?? false,
        profile: options.profile ?? "default",
        lite: options.lite ?? false,
        installAgentRules: options.installAgentRules ?? false
      });
    } else {
      log(options.lite ? "Initialized SwarmVault lite workspace." : "Initialized SwarmVault workspace.");
      log("Next: swarmvault next");
    }
  });

program
  .command("ingest")
  .description("Ingest a local file path, directory path, or URL into the raw SwarmVault workspace.")
  .argument("<input>", "Local file path, directory path, or URL")
  .option("--review", "Stage a source review artifact after ingest and compile", false)
  .option("--guide", "Stage a guided source integration bundle after ingest and compile (default: from config)")
  .option("--no-guide", "Skip guided mode even if enabled in config")
  .option("--answers-file <path>", "JSON file with guided-session answers keyed by question id or listed in prompt order")
  .option("--include-assets", "Download remote image assets when ingesting URLs", true)
  .option("--no-include-assets", "Skip downloading remote image assets when ingesting URLs")
  .option("--max-asset-size <bytes>", "Maximum number of bytes to fetch for a single remote image asset")
  .option("--repo-root <path>", "Override the detected repo root when ingesting a directory")
  .option("--include <glob...>", "Only ingest files matching one or more glob patterns")
  .option("--exclude <glob...>", "Skip files matching one or more glob patterns")
  .option("--max-files <n>", "Maximum number of files to ingest from a directory")
  .option("--include-third-party", "Also ingest repo files classified as third-party", false)
  .option("--include-resources", "Also ingest repo files classified as resources", false)
  .option("--include-generated", "Also ingest repo files classified as generated output", false)
  .option("--no-gitignore", "Ignore .gitignore rules when ingesting a directory")
  .option("--no-swarmvaultignore", "Ignore .swarmvaultignore rules when ingesting a directory")
  .option("--video", "Treat a URL input as a public video and transcribe extracted audio", false)
  .option("--resume <run-id>", "Re-run only the failed files from a prior ingest run id")
  .option("--commit", "Auto-commit wiki and state changes after ingest")
  .option("--no-redact", "Skip PII/secret redaction for this run (overrides config)")
  .action(
    async (
      input: string,
      options: {
        includeAssets?: boolean;
        maxAssetSize?: string;
        repoRoot?: string;
        include?: string[];
        exclude?: string[];
        maxFiles?: string;
        includeThirdParty?: boolean;
        includeResources?: boolean;
        includeGenerated?: boolean;
        gitignore?: boolean;
        swarmvaultignore?: boolean;
        video?: boolean;
        resume?: string;
        review?: boolean;
        guide?: boolean;
        answersFile?: string;
        commit?: boolean;
        redact?: boolean;
      }
    ) => {
      const guideAnswers = readGuideAnswersFile(options.answersFile);
      const vaultConfig = await loadVaultConfig(process.cwd()).catch(() => null);
      const guideEnabled = options.guide ?? vaultConfig?.config.profile.guidedIngestDefault ?? false;
      const maxAssetSize =
        typeof options.maxAssetSize === "string" && options.maxAssetSize.trim()
          ? parsePositiveInt(options.maxAssetSize, 0) || undefined
          : undefined;
      const maxFiles =
        typeof options.maxFiles === "string" && options.maxFiles.trim() ? parsePositiveInt(options.maxFiles, 0) || undefined : undefined;
      const extractClasses: SourceClass[] = [
        "first_party",
        ...(options.includeThirdParty ? (["third_party"] as const) : []),
        ...(options.includeResources ? (["resource"] as const) : []),
        ...(options.includeGenerated ? (["generated"] as const) : [])
      ];
      const commonOptions = {
        includeAssets: options.includeAssets,
        maxAssetSize,
        repoRoot: options.repoRoot,
        include: options.include,
        exclude: options.exclude,
        maxFiles,
        gitignore: options.gitignore,
        swarmvaultignore: options.swarmvaultignore,
        video: options.video,
        extractClasses,
        resume: options.resume,
        redact: options.redact,
        progress: !isJson()
      };
      const directoryResult = !/^https?:\/\//i.test(input)
        ? await stat(input)
            .then((inputStat) => (inputStat.isDirectory() ? ingestDirectory(process.cwd(), input, commonOptions) : null))
            .catch(() => null)
        : null;
      if (directoryResult) {
        const scope =
          options.review || guideEnabled
            ? await (async () => {
                const pathModule = await import("node:path");
                const absoluteInput = pathModule.resolve(process.cwd(), input);
                const sourceIds = (await listManifests(process.cwd()))
                  .filter((manifest) => {
                    if (!manifest.originalPath) {
                      return false;
                    }
                    const relative = pathModule.relative(absoluteInput, pathModule.resolve(manifest.originalPath));
                    return relative === "" || (!relative.startsWith("..") && !pathModule.isAbsolute(relative));
                  })
                  .map((manifest) => manifest.sourceId);
                return sourceIds.length
                  ? {
                      id: `directory-${absoluteInput.split(pathModule.sep).pop() ?? "source"}`,
                      title: absoluteInput.split(pathModule.sep).pop() ?? absoluteInput,
                      sourceIds,
                      kind: "directory"
                    }
                  : undefined;
              })()
            : undefined;
        const shouldStage = Boolean(scope && (directoryResult.imported.length || directoryResult.updated.length));
        const review =
          shouldStage && options.review && !guideEnabled
            ? await (async () => {
                await compileVault(process.cwd(), {});
                return await reviewSourceScope(process.cwd(), scope!);
              })()
            : undefined;
        const guide =
          shouldStage && guideEnabled
            ? await (async () => {
                await compileVault(process.cwd(), {});
                return await guideSourceScope(process.cwd(), scope!, { answers: guideAnswers });
              })()
            : undefined;
        const completedGuide = guide && !options.answersFile ? await completeGuideInteractively(guide, scope?.id ?? input) : guide;
        if (isJson()) {
          emitJson(
            completedGuide
              ? { ingest: directoryResult, guide: completedGuide }
              : review
                ? { ingest: directoryResult, review }
                : directoryResult
          );
        } else {
          const failedCount = directoryResult.failed?.length ?? 0;
          log(
            `Imported ${directoryResult.imported.length} file(s), updated ${directoryResult.updated.length}, skipped ${directoryResult.skipped.length}, failed ${failedCount}.`
          );
          if (failedCount && directoryResult.runId) {
            log(`Run id: ${directoryResult.runId}`);
            log(`Retry with: swarmvault ingest ${input} --resume ${directoryResult.runId}`);
            for (const failure of (directoryResult.failed ?? []).slice(0, 5)) {
              log(`  failed ${failure.stage}: ${failure.path}: ${failure.error}`);
            }
            if (failedCount > 5) log(`  ... ${failedCount - 5} more`);
          }
          if (review) {
            log(`Staged source review at ${review.reviewPath}.`);
          }
          if (completedGuide?.awaitingInput) {
            log(
              `Created guided session at ${completedGuide.sessionPath}. Resume with \`swarmvault source session ${completedGuide.sessionId}\`.`
            );
          } else if (completedGuide?.guidePath) {
            log(`Staged guided session at ${completedGuide.guidePath}.`);
          }
          const redactionLine = summarizeRedactions(directoryResult.redactions);
          if (redactionLine) {
            log(redactionLine);
          }
        }
        if (options.commit) {
          const msg = await autoCommitWikiChanges(process.cwd(), "ingest", input, { force: true });
          if (msg && !isJson()) log(`Committed: ${msg}`);
        }
        return;
      }
      const ingest = await ingestInputDetailed(process.cwd(), input, commonOptions);
      const scope = sourceScopeFromManifests(input, [...ingest.created, ...ingest.updated, ...ingest.unchanged]);
      const review =
        options.review && !guideEnabled && scope && (ingest.created.length || ingest.updated.length || ingest.unchanged.length)
          ? await (async () => {
              await compileVault(process.cwd(), {});
              return await reviewSourceScope(process.cwd(), scope);
            })()
          : undefined;
      const guide =
        guideEnabled && scope && (ingest.created.length || ingest.updated.length || ingest.unchanged.length)
          ? await (async () => {
              await compileVault(process.cwd(), {});
              return await guideSourceScope(process.cwd(), scope, { answers: guideAnswers });
            })()
          : undefined;
      const completedGuide = guide && !options.answersFile ? await completeGuideInteractively(guide, scope?.id ?? input) : guide;
      if (isJson()) {
        emitJson(completedGuide ? { ingest, guide: completedGuide } : review ? { ingest, review } : ingest);
      } else {
        const primary = [...ingest.created, ...ingest.updated, ...ingest.unchanged][0];
        if (ingest.created.length + ingest.updated.length + ingest.removed.length <= 1 && primary) {
          log(primary.sourceId);
        } else {
          log(
            `Created ${ingest.created.length}, updated ${ingest.updated.length}, unchanged ${ingest.unchanged.length}, removed ${ingest.removed.length}.`
          );
        }
        if (review) {
          log(`Staged source review at ${review.reviewPath}.`);
        }
        if (completedGuide?.awaitingInput) {
          log(
            `Created guided session at ${completedGuide.sessionPath}. Resume with \`swarmvault source session ${completedGuide.sessionId}\`.`
          );
        } else if (completedGuide?.guidePath) {
          log(`Staged guided session at ${completedGuide.guidePath}.`);
        }
        const redactionLine = summarizeRedactions(ingest.redactions);
        if (redactionLine) {
          log(redactionLine);
        }
      }
      if (options.commit) {
        const msg = await autoCommitWikiChanges(process.cwd(), "ingest", input, { force: true });
        if (msg && !isJson()) log(`Committed: ${msg}`);
      }
    }
  );

program
  .command("add")
  .description("Capture supported URLs into normalized markdown before ingesting them.")
  .argument("<input>", "Supported URL or bare arXiv id")
  .option("--author <name>", "Human author or curator for this capture")
  .option("--contributor <name>", "Additional contributor metadata for this capture")
  .option("--video", "Treat the URL as a public video and transcribe extracted audio", false)
  .option("--no-redact", "Skip PII/secret redaction for this capture (overrides config)")
  .action(async (input: string, options: { author?: string; contributor?: string; video?: boolean; redact?: boolean }) => {
    const result = await addInput(process.cwd(), input, {
      author: options.author,
      contributor: options.contributor,
      video: options.video,
      redact: options.redact
    });
    if (isJson()) {
      emitJson(result);
    } else {
      log(`${result.captureType}${result.fallback ? " (fallback)" : ""}: ${result.manifest.sourceId}`);
    }
  });

const source = program.command("source").description("Manage recurring local files, directories, public repos, and docs sources.");

source
  .command("add")
  .description("Register and sync a managed source from a local file, directory, public GitHub repo root URL, or docs hub URL.")
  .argument("<input>", "Local file path, directory path, public GitHub repo root URL, or docs hub URL")
  .option("--no-compile", "Register and sync without compiling the vault")
  .option("--no-brief", "Skip source brief generation after sync")
  .option("--review", "Stage a source review artifact after sync and compile", false)
  .option("--guide", "Stage a guided source integration bundle after sync and compile (default: from config)")
  .option("--no-guide", "Skip guided mode even if enabled in config")
  .option("--answers-file <path>", "JSON file with guided-session answers keyed by question id or listed in prompt order")
  .option("--max-pages <n>", "Maximum number of pages to crawl for docs sources")
  .option("--max-depth <n>", "Maximum crawl depth for docs sources")
  .option("--branch <name>", "GitHub branch to clone for public repo sources")
  .option("--ref <ref>", "Git ref, tag, or commit to check out after cloning a public repo source")
  .option("--checkout-dir <path>", "Persistent checkout directory for a public GitHub repo source")
  .action(
    async (
      input: string,
      options: {
        compile?: boolean;
        brief?: boolean;
        review?: boolean;
        guide?: boolean;
        answersFile?: string;
        maxPages?: string;
        maxDepth?: string;
        branch?: string;
        ref?: string;
        checkoutDir?: string;
      }
    ) => {
      const guideAnswers = readGuideAnswersFile(options.answersFile);
      const addConfig = await loadVaultConfig(process.cwd()).catch(() => null);
      const guideEnabled = options.guide ?? addConfig?.config.profile.guidedIngestDefault ?? false;
      const result = await addManagedSource(process.cwd(), input, {
        compile: options.compile,
        brief: options.brief,
        review: options.review,
        guide: guideEnabled,
        guideAnswers,
        maxPages: options.maxPages ? parsePositiveInt(options.maxPages, 0) || undefined : undefined,
        maxDepth: options.maxDepth ? parsePositiveInt(options.maxDepth, 0) || undefined : undefined,
        branch: options.branch,
        ref: options.ref,
        checkoutDir: options.checkoutDir
      });
      if (result.guide && !options.answersFile) {
        result.guide = await completeGuideInteractively(result.guide, result.source.id);
      }
      if (isJson()) {
        emitJson(result);
      } else {
        log(
          `Registered ${result.source.kind} source ${result.source.id}. Status: ${result.source.status}.` +
            `${result.compile ? ` Compiled ${result.compile.sourceCount} source(s).` : ""}` +
            `${result.briefGenerated ? ` Brief: ${result.source.briefPath}` : ""}` +
            `${result.review ? ` Review: ${result.review.reviewPath}` : ""}` +
            `${
              result.guide?.awaitingInput
                ? ` Session: ${result.guide.sessionPath}. Resume with \`swarmvault source session ${result.guide.sessionId}\`.`
                : result.guide?.guidePath
                  ? ` Guide: ${result.guide.guidePath}`
                  : ""
            }`
        );
      }
    }
  );

source
  .command("list")
  .description("List managed sources registered in this vault.")
  .action(async () => {
    const sources = await listManagedSourceRecords(process.cwd());
    if (isJson()) {
      emitJson(sources);
    } else if (sources.length === 0) {
      log("No managed sources registered.");
    } else {
      for (const entry of sources) {
        log(`${entry.id}  ${entry.kind}  ${entry.status}  ${entry.title}`);
      }
    }
  });

source
  .command("reload")
  .description("Re-sync one managed source or all managed sources, then optionally compile and refresh briefs.")
  .argument("[id]", "Managed source id")
  .option("--all", "Reload all managed sources", false)
  .option("--no-compile", "Re-sync without compiling the vault")
  .option("--no-brief", "Skip source brief generation after sync")
  .option("--review", "Stage a source review artifact after sync and compile", false)
  .option("--guide", "Stage a guided source integration bundle after sync and compile (default: from config)")
  .option("--no-guide", "Skip guided mode even if enabled in config")
  .option("--answers-file <path>", "JSON file with guided-session answers keyed by question id or listed in prompt order")
  .option("--max-pages <n>", "Maximum number of pages to crawl for docs sources")
  .option("--max-depth <n>", "Maximum crawl depth for docs sources")
  .action(
    async (
      id: string | undefined,
      options: {
        all?: boolean;
        compile?: boolean;
        brief?: boolean;
        review?: boolean;
        guide?: boolean;
        answersFile?: string;
        maxPages?: string;
        maxDepth?: string;
      }
    ) => {
      const guideAnswers = readGuideAnswersFile(options.answersFile);
      const reloadConfig = await loadVaultConfig(process.cwd()).catch(() => null);
      const guideEnabled = options.guide ?? reloadConfig?.config.profile.guidedIngestDefault ?? false;
      const result = await reloadManagedSources(process.cwd(), {
        id,
        all: options.all ?? false,
        compile: options.compile,
        brief: options.brief,
        review: options.review,
        guide: guideEnabled,
        guideAnswers,
        maxPages: options.maxPages ? parsePositiveInt(options.maxPages, 0) || undefined : undefined,
        maxDepth: options.maxDepth ? parsePositiveInt(options.maxDepth, 0) || undefined : undefined
      });
      if (!options.answersFile && result.guides.length === 1) {
        result.guides = [await completeGuideInteractively(result.guides[0]!, result.sources[0]?.id ?? id ?? "source")];
      }
      if (isJson()) {
        emitJson(result);
      } else {
        log(
          `Reloaded ${result.sources.length} source(s).` +
            `${result.compile ? ` Compiled ${result.compile.sourceCount} source(s).` : ""}` +
            `${result.briefPaths.length ? ` Briefs: ${result.briefPaths.length}.` : ""}` +
            `${result.reviews.length ? ` Reviews: ${result.reviews.length}.` : ""}` +
            `${result.guides.length ? ` Guides/Sessions: ${result.guides.length}.` : ""}`
        );
      }
    }
  );

source
  .command("delete")
  .description("Unregister a managed source and remove its transient sync state without deleting canonical vault content.")
  .argument("<id>", "Managed source id")
  .action(async (id: string) => {
    const result = await deleteManagedSource(process.cwd(), id);
    if (isJson()) {
      emitJson(result);
    } else {
      log(`Deleted managed source ${result.removed.id}. Canonical vault content was left in place.`);
    }
  });

source
  .command("review")
  .description("Stage a source review artifact for a managed source id or raw source id.")
  .argument("<id>", "Managed source id or raw source id")
  .action(async (id: string) => {
    const result = await reviewManagedSource(process.cwd(), id);
    if (isJson()) {
      emitJson(result);
    } else {
      log(`Staged source review at ${result.reviewPath}.`);
    }
  });

source
  .command("guide")
  .description("Create or resume a guided source session for a managed source id or raw source id.")
  .argument("<id>", "Managed source id or raw source id")
  .option("--answers-file <path>", "JSON file with guided-session answers keyed by question id or listed in prompt order")
  .action(async (id: string, options: { answersFile?: string }) => {
    const guideAnswers = readGuideAnswersFile(options.answersFile);
    let result = await guideManagedSource(process.cwd(), id, { answers: guideAnswers });
    if (!options.answersFile) {
      result = await completeGuideInteractively(result, id);
    }
    if (isJson()) {
      emitJson(result);
    } else {
      if (result.awaitingInput) {
        log(`Created guided session at ${result.sessionPath}. Resume with \`swarmvault source session ${result.sessionId}\`.`);
      } else {
        log(`Staged guided session at ${result.guidePath}.`);
      }
    }
  });

source
  .command("session")
  .description("Resume the latest guided source session for a managed source id, raw source id, source scope id, or session id.")
  .argument("<id>", "Managed source id, raw source id, source scope id, or guided session id")
  .option("--answers-file <path>", "JSON file with guided-session answers keyed by question id or listed in prompt order")
  .action(async (id: string, options: { answersFile?: string }) => {
    const guideAnswers = readGuideAnswersFile(options.answersFile);
    let result = await resumeSourceSession(process.cwd(), id, { answers: guideAnswers });
    if (!options.answersFile) {
      result = await completeGuideInteractively(result, id);
    }
    if (isJson()) {
      emitJson(result);
    } else if (result.awaitingInput) {
      log(`Updated guided session at ${result.sessionPath}. Resume with \`swarmvault source session ${result.sessionId}\` when ready.`);
    } else {
      log(`Staged guided session at ${result.guidePath}.`);
    }
  });

const inbox = program.command("inbox").description("Inbox and capture workflows.");
inbox
  .command("import")
  .description("Import supported files from the configured inbox directory.")
  .argument("[dir]", "Optional inbox directory override")
  .action(async (dir?: string) => {
    const result = await importInbox(process.cwd(), dir);
    if (isJson()) {
      emitJson(result);
    } else {
      log(
        `Imported ${result.imported.length} source(s) from ${result.inputDir}. Scanned: ${result.scannedCount}. Attachments: ${result.attachmentCount}. Skipped: ${result.skipped.length}.`
      );
    }
  });

program
  .command("compile")
  .description("Compile manifests into wiki pages, graph JSON, and search index.")
  .option("--approve", "Stage a review bundle without applying active page changes", false)
  .option("--commit", "Auto-commit wiki and state changes after compile")
  .option("--max-tokens <n>", "Cap wiki output by trimming lower-priority pages")
  .action(async (options: { approve?: boolean; commit?: boolean; maxTokens?: string }) => {
    const maxTokens = options.maxTokens ? parsePositiveInt(options.maxTokens, 0) || undefined : undefined;
    const result = await compileVault(process.cwd(), { approve: options.approve ?? false, maxTokens });
    if (isJson()) {
      emitJson(result);
    } else {
      if (result.staged) {
        log(`Staged ${result.changedPages.length} change(s) for review at ${result.approvalDir}.`);
      } else {
        log(`Compiled ${result.sourceCount} source(s), ${result.pageCount} page(s). Changed: ${result.changedPages.length}.`);
      }
      if (result.tokenStats) {
        log(
          `Token budget: ~${result.tokenStats.estimatedTokens} tokens, kept ${result.tokenStats.pagesKept} pages, dropped ${result.tokenStats.pagesDropped}.`
        );
      }
    }
    if (options.commit) {
      const msg = await autoCommitWikiChanges(process.cwd(), "compile", `${result.sourceCount} sources, ${result.pageCount} pages`, {
        force: true
      });
      if (msg && !isJson()) log(`Committed: ${msg}`);
    }
    await maybeEmitHeuristicNotice(["compile"]);
  });

program
  .command("consolidate")
  .description("Roll working-tier insights up into episodic, semantic, and procedural tiers.")
  .option("--dry-run", "Return decisions without writing any files", false)
  .action(async (options: { dryRun?: boolean }) => {
    const result = await consolidateVault(process.cwd(), { dryRun: options.dryRun ?? false });
    if (isJson()) {
      emitJson(result);
      return;
    }
    log(
      `${options.dryRun ? "Would consolidate" : "Consolidated"} ${result.newPages.length} new tier page(s); ${result.promoted.length} promotion(s).`
    );
    for (const decision of result.decisions) {
      log(decision);
    }
  });

program
  .command("query")
  .description("Query the compiled SwarmVault wiki.")
  .argument("<question>", "Question to ask SwarmVault")
  .option("--no-save", "Do not persist the answer to wiki/outputs")
  .option("--commit", "Auto-commit wiki changes after query")
  .option("--gap-fill", "Pull external web-search evidence when the local wiki has gaps (requires webSearch.tasks.queryProvider).")
  .option("--task <id>", "Attach this query output to an agent task")
  .option("--memory <id>", "Compatibility alias for --task")
  .addOption(
    new Option("--format <format>", "Output format").choices(["markdown", "report", "slides", "chart", "image"]).default("markdown")
  )
  .action(
    async (
      question: string,
      options: {
        save?: boolean;
        commit?: boolean;
        gapFill?: boolean;
        task?: string;
        memory?: string;
        format?: "markdown" | "report" | "slides" | "chart" | "image";
      }
    ) => {
      const result = await queryVault(process.cwd(), {
        question,
        save: options.save ?? true,
        format: options.format,
        gapFill: options.gapFill ?? false,
        memoryTaskId: options.task ?? options.memory
      });
      if (isJson()) {
        emitJson(result);
      } else {
        log(result.answer);
        if (result.savedPath) {
          log(`Saved to ${result.savedPath}`);
        }
      }
      if (options.commit) {
        const msg = await autoCommitWikiChanges(process.cwd(), "query", question.slice(0, 72), { force: true });
        if (msg && !isJson()) log(`Committed: ${msg}`);
      }
      await maybeEmitHeuristicNotice(["query"]);
    }
  );

program
  .command("chat")
  .description("Ask the compiled wiki in a persisted multi-turn chat session.")
  .argument("[question...]", "Question to ask in a chat session")
  .option("--resume [id]", "Resume a chat session by id/prefix, or the most recent session when no id is supplied")
  .option("--list", "List saved chat sessions", false)
  .option("--delete <id>", "Delete a saved chat session by id/prefix")
  .option("--save-output", "Also persist each answer as a regular wiki/outputs query page", false)
  .option("--gap-fill", "Pull external web-search evidence when the local wiki has gaps (requires webSearch.tasks.queryProvider).")
  .option("--max-history-turns <n>", "Number of prior turns to include as conversational context", "6")
  .addOption(
    new Option("--format <format>", "Answer format for generated turns")
      .choices(["markdown", "report", "slides", "chart", "image"])
      .default("markdown")
  )
  .action(
    async (
      questionParts: string[] | undefined,
      options: {
        resume?: boolean | string;
        list?: boolean;
        delete?: string;
        saveOutput?: boolean;
        gapFill?: boolean;
        maxHistoryTurns?: string;
        format?: "markdown" | "report" | "slides" | "chart" | "image";
      }
    ) => {
      if (options.list) {
        const sessions = await listChatSessions(process.cwd());
        if (isJson()) {
          emitJson(sessions);
        } else {
          logChatSessions(sessions);
        }
        return;
      }
      if (options.delete) {
        const deleted = await deleteChatSession(process.cwd(), options.delete);
        if (isJson()) {
          emitJson(deleted);
        } else {
          log(`Deleted chat session ${deleted.id}`);
        }
        return;
      }

      const question = (questionParts ?? []).join(" ").trim();
      if (!question) {
        await runInteractiveChat(options);
        return;
      }

      const result = await runChatQuestion(question, options);
      if (isJson()) {
        emitJson(result);
      } else {
        log(result.answer);
        log(`Session: ${result.session.id}`);
        log(`Saved transcript: ${result.markdownPath}`);
      }
      await maybeEmitHeuristicNotice(["chat"]);
    }
  );

const context = program.command("context").description("Build and manage token-bounded agent context packs.");

context
  .command("build")
  .description("Build a cited, token-bounded context pack for an agent task.")
  .argument("<goal>", "Task, question, or goal the agent needs context for")
  .option("--target <target>", "Optional page, node, path, project, or label to anchor the pack")
  .option("--budget <tokens>", "Approximate token budget for included context", String(8000))
  .option("--task <id>", "Attach the context pack to an agent task")
  .option("--memory <id>", "Compatibility alias for --task")
  .addOption(new Option("--format <format>", "Output format").choices(["markdown", "json", "llms"]).default("markdown"))
  .action(
    async (goal: string, options: { target?: string; budget?: string; task?: string; memory?: string; format?: ContextPackFormat }) => {
      const budgetTokens = parsePositiveInt(options.budget, 8000);
      const result = await buildContextPack(process.cwd(), {
        goal,
        target: options.target,
        budgetTokens,
        format: options.format,
        memoryTaskId: options.task ?? options.memory
      });
      if (isJson()) {
        emitJson(result);
        return;
      }
      log(result.rendered);
      log(`Saved context pack to ${result.markdownPath}`);
      log(`Saved context artifact to ${result.artifactPath}`);
    }
  );

context
  .command("list")
  .description("List saved context packs.")
  .action(async () => {
    const packs = await listContextPacks(process.cwd());
    if (isJson()) {
      emitJson(packs);
      return;
    }
    if (!packs.length) {
      log("No context packs.");
      return;
    }
    for (const pack of packs) {
      log(`${pack.id} — ${pack.goal} (${pack.itemCount} item(s), ${pack.omittedCount} omitted)`);
    }
  });

context
  .command("show")
  .description("Print a saved context pack.")
  .argument("<id>", "Context pack id")
  .addOption(new Option("--format <format>", "Output format").choices(["markdown", "json", "llms"]).default("markdown"))
  .action(async (id: string, options: { format?: ContextPackFormat }) => {
    const pack = await readContextPack(process.cwd(), id);
    if (!pack) {
      throw new Error(`Context pack not found: ${id}`);
    }
    if (isJson() || options.format === "json") {
      emitJson(pack);
      return;
    }
    log(options.format === "llms" ? renderContextPackLlms(pack) : renderContextPackMarkdown(pack));
  });

context
  .command("delete")
  .description("Delete a saved context pack artifact and markdown page.")
  .argument("<id>", "Context pack id")
  .action(async (id: string) => {
    const deleted = await deleteContextPack(process.cwd(), id);
    if (!deleted) {
      throw new Error(`Context pack not found: ${id}`);
    }
    if (isJson()) {
      emitJson(deleted);
      return;
    }
    log(`Deleted context pack ${deleted.id}.`);
  });

const memory = program.command("memory", { hidden: true }).description("Manage git-backed agent memory task ledger entries.");

memory
  .command("start")
  .description("Start a durable agent memory task and build its initial context pack.")
  .argument("<goal>", "Task goal to preserve in agent memory")
  .option("--target <target>", "Optional page, node, path, project, or label to anchor the initial context pack")
  .option("--budget <tokens>", "Approximate token budget for the initial context pack", String(8000))
  .option("--agent <name>", "Agent name to record on the task")
  .option("--context-pack <id>", "Attach an existing context pack instead of building a new one")
  .action(async (goal: string, options: { target?: string; budget?: string; agent?: string; contextPack?: string }) => {
    const result = await startMemoryTask(process.cwd(), {
      goal,
      target: options.target,
      budgetTokens: parsePositiveInt(options.budget, 8000),
      agent: options.agent,
      contextPackId: options.contextPack
    });
    if (isJson()) {
      emitJson(result);
      return;
    }
    log(result.task.id);
    log(`Saved memory task to ${result.markdownPath}`);
  });

memory
  .command("update")
  .description("Append a note, decision, path, context pack, or status change to a memory task.")
  .argument("<id>", "Memory task id")
  .option("--note <text>", "Append a task note")
  .option("--decision <text>", "Append a decision")
  .option("--changed-path <path>", "Record a changed file or wiki path")
  .option("--context-pack <id>", "Attach a context pack")
  .option("--session <id>", "Attach a session id")
  .option("--source <id>", "Attach a source id")
  .option("--page <id>", "Attach a page id")
  .option("--node <id>", "Attach a graph node id")
  .option("--git-ref <ref>", "Attach a git ref")
  .addOption(new Option("--status <status>", "Task status").choices(["active", "blocked", "completed", "archived"]))
  .action(
    async (
      id: string,
      options: {
        note?: string;
        decision?: string;
        changedPath?: string;
        contextPack?: string;
        session?: string;
        source?: string;
        page?: string;
        node?: string;
        gitRef?: string;
        status?: AgentMemoryTaskStatus;
      }
    ) => {
      const result = await updateMemoryTask(process.cwd(), id, {
        note: options.note,
        decision: options.decision,
        changedPath: options.changedPath,
        contextPackId: options.contextPack,
        sessionId: options.session,
        sourceId: options.source,
        pageId: options.page,
        nodeId: options.node,
        gitRef: options.gitRef,
        status: options.status
      });
      if (isJson()) {
        emitJson(result);
        return;
      }
      log(`Updated memory task ${result.task.id}.`);
    }
  );

memory
  .command("finish")
  .description("Finish a memory task with an outcome and optional follow-up.")
  .argument("<id>", "Memory task id")
  .requiredOption("--outcome <text>", "Outcome to record")
  .option("--follow-up <text>", "Follow-up to preserve for the next agent")
  .action(async (id: string, options: { outcome: string; followUp?: string }) => {
    const result = await finishMemoryTask(process.cwd(), id, {
      outcome: options.outcome,
      followUp: options.followUp
    });
    if (isJson()) {
      emitJson(result);
      return;
    }
    log(`Finished memory task ${result.task.id}.`);
  });

memory
  .command("list")
  .description("List saved agent memory tasks.")
  .action(async () => {
    const tasks = await listMemoryTasks(process.cwd());
    if (isJson()) {
      emitJson(tasks);
      return;
    }
    if (!tasks.length) {
      log("No memory tasks.");
      return;
    }
    for (const task of tasks) {
      log(`${task.id} — ${task.status} — ${task.goal}`);
    }
  });

memory
  .command("show")
  .description("Print a saved agent memory task.")
  .argument("<id>", "Memory task id")
  .action(async (id: string) => {
    const task = await readMemoryTask(process.cwd(), id);
    if (!task) {
      throw new Error(`Memory task not found: ${id}`);
    }
    if (isJson()) {
      emitJson(task);
      return;
    }
    log(`Task: ${task.title}`);
    log(`Status: ${task.status}`);
    log(`Goal: ${task.goal}`);
    if (task.outcome) log(`Outcome: ${task.outcome}`);
    if (task.followUps.length) log(`Follow-ups: ${task.followUps.join("; ")}`);
    log(`Markdown: ${task.markdownPath}`);
  });

memory
  .command("resume")
  .description("Render a memory task handoff for the next agent.")
  .argument("<id>", "Memory task id")
  .addOption(new Option("--format <format>", "Output format").choices(["markdown", "json", "llms"]).default("markdown"))
  .action(async (id: string, options: { format?: AgentMemoryResumeFormat }) => {
    const result = await resumeMemoryTask(process.cwd(), id, { format: options.format });
    if (isJson() || options.format === "json") {
      emitJson(result);
      return;
    }
    log(result.rendered);
  });

const task = program.command("task").description("Manage git-backed agent task ledger entries.");

task
  .command("start")
  .description("Start a durable agent task and build its initial context pack.")
  .argument("<goal>", "Task goal to preserve")
  .option("--target <target>", "Optional page, node, path, project, or label to anchor the initial context pack")
  .option("--budget <tokens>", "Approximate token budget for the initial context pack", String(8000))
  .option("--agent <name>", "Agent name to record on the task")
  .option("--context-pack <id>", "Attach an existing context pack instead of building a new one")
  .action(async (goal: string, options: { target?: string; budget?: string; agent?: string; contextPack?: string }) => {
    const result = await startMemoryTask(process.cwd(), {
      goal,
      target: options.target,
      budgetTokens: parsePositiveInt(options.budget, 8000),
      agent: options.agent,
      contextPackId: options.contextPack
    });
    if (isJson()) {
      emitJson(result);
      return;
    }
    log(result.task.id);
    log(`Saved task to ${result.markdownPath}`);
  });

task
  .command("update")
  .description("Append a note, decision, path, context pack, or status change to a task.")
  .argument("<id>", "Task id")
  .option("--note <text>", "Append a task note")
  .option("--decision <text>", "Append a decision")
  .option("--changed-path <path>", "Record a changed file or wiki path")
  .option("--context-pack <id>", "Attach a context pack")
  .option("--session <id>", "Attach a session id")
  .option("--source <id>", "Attach a source id")
  .option("--page <id>", "Attach a page id")
  .option("--node <id>", "Attach a graph node id")
  .option("--git-ref <ref>", "Attach a git ref")
  .addOption(new Option("--status <status>", "Task status").choices(["active", "blocked", "completed", "archived"]))
  .action(
    async (
      id: string,
      options: {
        note?: string;
        decision?: string;
        changedPath?: string;
        contextPack?: string;
        session?: string;
        source?: string;
        page?: string;
        node?: string;
        gitRef?: string;
        status?: AgentMemoryTaskStatus;
      }
    ) => {
      const result = await updateMemoryTask(process.cwd(), id, {
        note: options.note,
        decision: options.decision,
        changedPath: options.changedPath,
        contextPackId: options.contextPack,
        sessionId: options.session,
        sourceId: options.source,
        pageId: options.page,
        nodeId: options.node,
        gitRef: options.gitRef,
        status: options.status
      });
      if (isJson()) {
        emitJson(result);
        return;
      }
      log(`Updated task ${result.task.id}.`);
    }
  );

task
  .command("finish")
  .description("Finish a task with an outcome and optional follow-up.")
  .argument("<id>", "Task id")
  .requiredOption("--outcome <text>", "Outcome to record")
  .option("--follow-up <text>", "Follow-up to preserve for the next agent")
  .action(async (id: string, options: { outcome: string; followUp?: string }) => {
    const result = await finishMemoryTask(process.cwd(), id, {
      outcome: options.outcome,
      followUp: options.followUp
    });
    if (isJson()) {
      emitJson(result);
      return;
    }
    log(`Finished task ${result.task.id}.`);
  });

task
  .command("list")
  .description("List saved agent tasks.")
  .action(async () => {
    const tasks = await listMemoryTasks(process.cwd());
    if (isJson()) {
      emitJson(tasks);
      return;
    }
    if (!tasks.length) {
      log("No tasks.");
      return;
    }
    for (const entry of tasks) {
      log(`${entry.id} — ${entry.status} — ${entry.goal}`);
    }
  });

task
  .command("show")
  .description("Print a saved agent task.")
  .argument("<id>", "Task id")
  .action(async (id: string) => {
    const entry = await readMemoryTask(process.cwd(), id);
    if (!entry) {
      throw new Error(`Task not found: ${id}`);
    }
    if (isJson()) {
      emitJson(entry);
      return;
    }
    log(`Task: ${entry.title}`);
    log(`Status: ${entry.status}`);
    log(`Goal: ${entry.goal}`);
    if (entry.outcome) log(`Outcome: ${entry.outcome}`);
    if (entry.followUps.length) log(`Follow-ups: ${entry.followUps.join("; ")}`);
    log(`Markdown: ${entry.markdownPath}`);
  });

task
  .command("resume")
  .description("Render a task handoff for the next agent.")
  .argument("<id>", "Task id")
  .addOption(new Option("--format <format>", "Output format").choices(["markdown", "json", "llms"]).default("markdown"))
  .action(async (id: string, options: { format?: AgentMemoryResumeFormat }) => {
    const result = await resumeMemoryTask(process.cwd(), id, { format: options.format });
    if (isJson() || options.format === "json") {
      emitJson(result);
      return;
    }
    log(result.rendered);
  });

program
  .command("explore")
  .description("Run a save-first multi-step exploration loop against the vault.")
  .argument("<question>", "Root question to explore")
  .option("--steps <n>", "Maximum number of exploration steps", "3")
  .option("--gap-fill", "Pull external web-search evidence when the local wiki has gaps (requires webSearch.tasks.exploreProvider).")
  .option("--task <id>", "Attach this exploration to an agent task")
  .option("--memory <id>", "Compatibility alias for --task")
  .addOption(
    new Option("--format <format>", "Output format for step pages")
      .choices(["markdown", "report", "slides", "chart", "image"])
      .default("markdown")
  )
  .action(
    async (
      question: string,
      options: {
        steps?: string;
        gapFill?: boolean;
        task?: string;
        memory?: string;
        format?: "markdown" | "report" | "slides" | "chart" | "image";
      }
    ) => {
      const stepCount = parsePositiveInt(options.steps, 3);
      const result = await exploreVault(process.cwd(), {
        question,
        steps: stepCount,
        format: options.format,
        gapFill: options.gapFill ?? false,
        memoryTaskId: options.task ?? options.memory
      });
      if (isJson()) {
        emitJson(result);
      } else {
        log(`Exploration hub saved to ${result.hubPath}`);
        log(`Completed ${result.stepCount} step(s).`);
      }
      await maybeEmitHeuristicNotice(["explore"]);
    }
  );

program
  .command("benchmark")
  .description("Measure graph-guided context reduction against a naive full-corpus read.")
  .option("--question <text...>", "Optional custom benchmark question(s)")
  .action(async (options: { question?: string[] }) => {
    const result = await benchmarkVault(process.cwd(), {
      questions: options.question
    });
    if (isJson()) {
      emitJson(result);
    } else {
      log(`Corpus tokens: ${result.corpusTokens}`);
      log(`Average query tokens: ${result.avgQueryTokens}`);
      const ratioPercent = (result.reductionRatio * 100).toFixed(1);
      log(`Reduction ratio: ${ratioPercent}%`);
      if (result.reductionRatio < 0) {
        log(
          "Note: graph-guided context is larger than the full corpus on this vault. The benchmark is only meaningful once the corpus exceeds the graph traversal budget."
        );
      }
    }
  });

const exportCommand = program.command("export").description("Export portable SwarmVault artifacts.");

exportCommand
  .command("ai")
  .description("Export static AI handoff files for agents, crawlers, and documentation systems.")
  .option("--out <dir>", "Output directory", path.join("wiki", "exports", "ai"))
  .option("--max-full-chars <n>", "Maximum characters to include in llms-full.txt", "5000000")
  .option("--no-page-siblings", "Skip per-page .txt and .json sibling files")
  .action(async (options: { out?: string; maxFullChars?: string; pageSiblings?: boolean }) => {
    const result = await exportAiPack(process.cwd(), {
      outDir: options.out,
      maxFullChars: parsePositiveInt(options.maxFullChars, 5_000_000),
      pageSiblings: options.pageSiblings ?? true
    });
    if (isJson()) {
      emitJson(result);
      return;
    }
    log(`Exported AI handoff pack to ${result.outputDir}`);
    log(`Files: ${result.files.length}; pages: ${result.pageCount}; nodes: ${result.nodeCount}; edges: ${result.edgeCount}`);
    if (result.truncatedFullText) {
      log("llms-full.txt was truncated; rerun with --max-full-chars for a larger export.");
    }
  });

program
  .command("lint")
  .description("Run anti-drift and wiki-health checks.")
  .option("--deep", "Run LLM-powered advisory lint (default: from config)")
  .option("--no-deep", "Skip deep lint even if enabled in config")
  .option("--web", "Augment deep lint with configured web search", false)
  .option("--conflicts", "Filter to contradiction findings only", false)
  .option("--decay", "Filter to decay-related findings only", false)
  .option("--tiers", "Filter to consolidation-tier findings only", false)
  .action(async (options: { deep?: boolean; web?: boolean; conflicts?: boolean; decay?: boolean; tiers?: boolean }) => {
    const lintConfig = await loadVaultConfig(process.cwd()).catch(() => null);
    const deepEnabled = options.decay || options.tiers ? false : (options.deep ?? lintConfig?.config.profile.deepLintDefault ?? false);
    const findings = await lintVault(process.cwd(), {
      deep: deepEnabled,
      web: options.web ?? false,
      conflicts: options.conflicts ?? false,
      decay: options.decay ?? false,
      tiers: options.tiers ?? false
    });
    if (isJson()) {
      emitJson(findings);
      return;
    }
    if (!findings.length) {
      log("No findings.");
      return;
    }
    for (const finding of findings) {
      log(`[${finding.severity}] ${finding.code}: ${finding.message}${finding.pagePath ? ` (${finding.pagePath})` : ""}`);
    }
  });

const graph = program.command("graph").description("Graph-related commands.").enablePositionalOptions();
const graphPush = graph.command("push").description("Push the compiled graph into external sinks.");

graph
  .command("update")
  .alias("refresh")
  .description("Refresh code-derived graph artifacts from tracked repo roots, one explicit repo path, or explicit files.")
  .argument("[path]", "Optional repo root to refresh instead of configured/tracked roots")
  .option("--file <path>", "Refresh only this file (repeatable); skips the full tracked-root walk", collectRepeated, [])
  .option("--lint", "Run lint after the refresh cycle", false)
  .option("--force", "Allow graph updates even when node or edge counts shrink sharply", false)
  .action(runGraphUpdateCommand);

graph
  .command("tree")
  .description("Write a collapsible source/module/symbol tree for the compiled graph.")
  .option("--output <html>", "Output HTML path (default: wiki/graph/tree.html)")
  .option("--root <path>", "Vault root to read instead of the current directory")
  .option("--label <name>", "Tree title")
  .option("--max-children <n>", "Maximum children to render per tree node", "250")
  .action(runGraphTreeCommand);

graph
  .command("merge")
  .description("Merge SwarmVault or node-link JSON graph files into one namespaced graph artifact.")
  .argument("<graphs...>", "Graph JSON files to merge")
  .requiredOption("--out <path>", "Output graph JSON path")
  .option("--label <name>", "Label/prefix to use when merging one graph")
  .action(runGraphMergeCommand);

graph
  .command("status")
  .description("Read-only check for graph/report presence and tracked repo changes.")
  .argument("[path]", "Optional repo root to check instead of configured/tracked roots")
  .action(showGraphStatusCommand);

graph
  .command("stats")
  .description("Summarize compiled graph counts, node types, evidence classes, and relation mix.")
  .action(async () => {
    const stats = await graphStatsVault(process.cwd());
    if (isJson()) {
      emitJson(stats);
      return;
    }
    log(
      `Graph stats: ${stats.counts.nodes} nodes, ${stats.counts.edges} edges, ${stats.counts.pages} pages, ${stats.counts.hyperedges} hyperedges, ${stats.counts.communities} communities.`
    );
    const nodeTypes = topCountEntries(stats.nodeTypes as Record<string, number>);
    if (nodeTypes.length) {
      log(`Node types: ${nodeTypes.map(([name, count]) => `${name}=${count}`).join(", ")}`);
    }
    const evidence = topCountEntries(stats.evidenceClasses as Record<string, number>);
    if (evidence.length) {
      log(`Evidence: ${evidence.map(([name, count]) => `${name}=${count}`).join(", ")}`);
    }
    const relations = topCountEntries(stats.edgeRelations);
    if (relations.length) {
      log(`Top relations: ${relations.map(([name, count]) => `${name}=${count}`).join(", ")}`);
    }
  });

graph
  .command("validate")
  .description("Validate a compiled graph artifact for dangling references, duplicate ids, and confidence bounds.")
  .argument("[graph]", "Optional graph JSON path; defaults to the current vault graph")
  .option("--strict", "Treat warnings as failures", false)
  .action(async (graphPath: string | undefined, options: { strict?: boolean }) => {
    const result = await validateGraphVault(process.cwd(), {
      graphPath,
      strict: options.strict ?? false
    });
    if (isJson()) {
      emitJson(result);
    } else {
      log(result.summary);
      for (const issue of result.issues) {
        const location = issue.path ? ` ${issue.path}` : "";
        log(`[${issue.severity}] ${issue.code}${location}: ${issue.message}`);
      }
    }
    if (!result.ok) {
      process.exitCode = 1;
    }
  });

graph
  .command("cluster")
  .alias("clusters")
  .description("Recompute graph communities, degrees, god-node flags, and graph report artifacts without re-ingesting sources.")
  .option("--resolution <number>", "Override the Louvain community resolution for this run")
  .action((options: { resolution?: string }) => runGraphClusterCommand(options));

graphPush
  .command("neo4j")
  .description("Push the compiled graph directly into Neo4j over Bolt/Aura.")
  .option("--uri <bolt-uri>", "Neo4j Bolt or Aura URI")
  .option("--username <user>", "Neo4j username")
  .option("--password-env <env-var>", "Environment variable containing the Neo4j password")
  .option("--database <name>", "Neo4j database name")
  .option("--vault-id <id>", "Stable vault identifier used for shared-database namespacing")
  .option("--batch-size <n>", "Maximum rows to write per Neo4j transaction batch")
  .option("--include-third-party", "Also push third-party repo material", false)
  .option("--include-resources", "Also push resource-like content", false)
  .option("--include-generated", "Also push generated output", false)
  .option("--dry-run", "Show what would be pushed without writing to Neo4j", false)
  .action(
    async (options: {
      uri?: string;
      username?: string;
      passwordEnv?: string;
      database?: string;
      vaultId?: string;
      batchSize?: string;
      includeThirdParty?: boolean;
      includeResources?: boolean;
      includeGenerated?: boolean;
      dryRun?: boolean;
    }) => {
      const batchSize =
        typeof options.batchSize === "string" && options.batchSize.trim() ? parsePositiveInt(options.batchSize, 0) || undefined : undefined;
      const includeClasses: SourceClass[] = [
        "first_party",
        ...(options.includeThirdParty ? (["third_party"] as const) : []),
        ...(options.includeResources ? (["resource"] as const) : []),
        ...(options.includeGenerated ? (["generated"] as const) : [])
      ];
      const result = await pushGraphNeo4j(process.cwd(), {
        uri: options.uri,
        username: options.username,
        passwordEnv: options.passwordEnv,
        database: options.database,
        vaultId: options.vaultId,
        batchSize,
        includeClasses,
        dryRun: options.dryRun ?? false
      });
      if (isJson()) {
        emitJson(result);
      } else {
        log(
          `${result.dryRun ? "Planned" : "Pushed"} ${result.counts.nodes} nodes, ${result.counts.relationships} relationships, ${result.counts.hyperedges} hyperedges, and ${result.counts.groupMembers} group-member links to ${result.uri}/${result.database} as ${result.vaultId}.`
        );
        if (result.skipped.nodes || result.skipped.relationships || result.skipped.hyperedges) {
          log(
            `Skipped ${result.skipped.nodes} node(s), ${result.skipped.relationships} relationship(s), and ${result.skipped.hyperedges} hyperedge(s) outside the selected source classes.`
          );
        }
        for (const warning of result.warnings) {
          log(`Warning: ${warning}`);
        }
      }
    }
  );

graph
  .command("serve")
  .description("Serve the local graph viewer.")
  .option("--port <port>", "Port override")
  .option("--full", "Disable overview sampling and render the full graph", false)
  .action(async (options: { port?: string; full?: boolean }) => {
    const port = options.port ? parsePositiveInt(options.port, 0) || undefined : undefined;
    const server = await startGraphServer(process.cwd(), port, { full: options.full ?? false });
    if (isJson()) {
      emitJson({ port: server.port, url: `http://localhost:${server.port}` });
    } else {
      log(`Graph viewer running at http://localhost:${server.port}`);
      log(`Browser clipper: http://localhost:${server.port}/api/bookmarklet`);
    }
    process.on("SIGINT", async () => {
      try {
        await server.close();
      } catch {}
      process.exit(0);
    });
  });

graph
  .command("export")
  .description(
    "Export the graph as HTML, report, SVG, GraphML, Cypher, JSON, callflow HTML, Obsidian vault, or Obsidian canvas. Combine flags to write multiple formats in one run."
  )
  .option("--html <output>", "Output HTML file path")
  .option("--html-standalone <output>", "Output lightweight standalone HTML file path (vis.js, no build tooling)")
  .option("--report <output>", "Output self-contained HTML report (graph stats, key nodes, communities)")
  .option("--svg <output>", "Output SVG file path")
  .option("--graphml <output>", "Output GraphML file path")
  .option("--cypher <output>", "Output Cypher file path")
  .option("--neo4j <output>", "Compatibility alias for --cypher, writing a Neo4j Cypher import file")
  .option("--json <output>", "Output JSON file path")
  .option("--callflow <output>", "Output directed callflow HTML file path")
  .option("--obsidian <output>", "Output Obsidian vault directory path")
  .option("--canvas <output>", "Output Obsidian canvas file path")
  .option("--full", "Include the full graph in HTML export (default; queries traverse complete graph)", true)
  .option("--overview", "Use overview sampling for HTML export (smaller file, queries limited to sampled nodes)", false)
  .action(
    async (options: {
      html?: string;
      htmlStandalone?: string;
      report?: string;
      svg?: string;
      graphml?: string;
      cypher?: string;
      neo4j?: string;
      json?: string;
      callflow?: string;
      obsidian?: string;
      canvas?: string;
      full?: boolean;
      overview?: boolean;
    }) => {
      const useFullGraph = options.overview ? false : (options.full ?? true);
      const targets = [
        options.html ? ({ format: "html", outputPath: options.html } as const) : null,
        options.htmlStandalone ? ({ format: "html-standalone", outputPath: options.htmlStandalone } as const) : null,
        options.report ? ({ format: "report", outputPath: options.report } as const) : null,
        options.svg ? ({ format: "svg", outputPath: options.svg } as const) : null,
        options.graphml ? ({ format: "graphml", outputPath: options.graphml } as const) : null,
        options.cypher ? ({ format: "cypher", outputPath: options.cypher } as const) : null,
        options.neo4j ? ({ format: "cypher", outputPath: options.neo4j } as const) : null,
        options.json ? ({ format: "json", outputPath: options.json } as const) : null,
        options.callflow ? ({ format: "callflow", outputPath: options.callflow } as const) : null,
        options.obsidian ? ({ format: "obsidian", outputPath: options.obsidian } as const) : null,
        options.canvas ? ({ format: "canvas", outputPath: options.canvas } as const) : null
      ].filter((target): target is NonNullable<typeof target> => Boolean(target));

      if (targets.length === 0) {
        throw new Error(
          "Pass at least one of --html, --html-standalone, --report, --svg, --graphml, --cypher, --neo4j, --json, --callflow, --obsidian, or --canvas."
        );
      }

      const results: Array<{ format: string; outputPath: string; fileCount?: number }> = [];
      for (const target of targets) {
        if (target.format === "html") {
          const outputPath = await exportGraphHtml(process.cwd(), target.outputPath, { full: useFullGraph });
          results.push({ format: target.format, outputPath });
        } else if (target.format === "report") {
          const result = await exportGraphReportHtml(process.cwd(), target.outputPath);
          results.push({ format: result.format, outputPath: result.outputPath });
        } else if (target.format === "obsidian") {
          const result = await exportObsidianVault(process.cwd(), target.outputPath);
          results.push({ format: result.format, outputPath: result.outputPath, fileCount: result.fileCount });
        } else if (target.format === "canvas") {
          const result = await exportObsidianCanvas(process.cwd(), target.outputPath);
          results.push({ format: result.format, outputPath: result.outputPath });
        } else {
          const result = await exportGraphFormat(process.cwd(), target.format, target.outputPath);
          results.push({ format: result.format, outputPath: result.outputPath });
        }
      }

      if (isJson()) {
        emitJson(results.length === 1 ? results[0] : { exports: results });
      } else {
        for (const result of results) {
          const suffix = result.fileCount ? ` (${result.fileCount} files)` : "";
          log(`Exported graph ${result.format} to ${result.outputPath}${suffix}`);
        }
      }
    }
  );

graph
  .command("share")
  .description("Print a shareable summary of the compiled graph.")
  .option("--post", "Print only the short social post text", false)
  .option("--svg [path]", "Write the visual SVG share card, defaulting to wiki/graph/share-card.svg")
  .option("--bundle [dir]", "Write the portable share kit bundle, defaulting to wiki/graph/share-kit")
  .action(async (options: { post?: boolean; svg?: boolean | string; bundle?: boolean | string }) => {
    const outputModeCount = [options.post, options.svg, options.bundle].filter(Boolean).length;
    if (outputModeCount > 1) {
      throw new Error("Choose one graph share output mode: --post, --svg, or --bundle.");
    }
    const { paths } = await loadVaultConfig(process.cwd());
    const raw = await readFile(paths.graphPath, "utf-8");
    const graph: GraphArtifact = JSON.parse(raw);
    const report = await readGraphReport(process.cwd());
    const artifact = buildGraphShareArtifact({
      graph,
      report,
      vaultName: path.basename(paths.rootDir)
    });
    if (options.svg) {
      const svgPath =
        typeof options.svg === "string" ? path.resolve(process.cwd(), options.svg) : path.join(paths.wikiDir, "graph", "share-card.svg");
      await mkdir(path.dirname(svgPath), { recursive: true });
      await writeFile(svgPath, renderGraphShareSvg(artifact), "utf8");
      if (isJson()) {
        emitJson({ ...artifact, svgPath });
        return;
      }
      log(`Wrote SVG share card to ${svgPath}`);
      return;
    }
    if (options.bundle) {
      const bundlePath =
        typeof options.bundle === "string" ? path.resolve(process.cwd(), options.bundle) : path.join(paths.wikiDir, "graph", "share-kit");
      const bundleFiles = await writeShareBundle(bundlePath, renderGraphShareBundleFiles(artifact));
      if (isJson()) {
        emitJson({ ...artifact, bundlePath, bundleFiles });
        return;
      }
      log(`Wrote share kit to ${bundlePath}`);
      return;
    }
    if (isJson()) {
      emitJson(artifact);
      return;
    }
    log(options.post ? artifact.shortPost : renderGraphShareMarkdown(artifact));
  });

graph
  .command("query")
  .description("Traverse the compiled graph deterministically from local search seeds.")
  .argument("<question>", "Question or graph search seed")
  .option("--dfs", "Prefer a depth-first traversal instead of breadth-first", false)
  .option("--budget <n>", "Maximum number of graph nodes to summarize")
  .option("--relation <name>", "Only traverse edges with this relation name (repeatable)", collectRepeated, [])
  .option(
    "--context <group>",
    "Relation group context: calls, imports, types, data, rationale, or evidence (repeatable)",
    collectRepeated,
    []
  )
  .option("--evidence <class>", "Evidence class: extracted, inferred, or ambiguous (repeatable)", collectRepeated, [])
  .option("--node-type <type>", "Prefer traversal around this graph node type (repeatable)", collectRepeated, [])
  .option("--language <lang>", "Prefer traversal around this code language (repeatable)", collectRepeated, [])
  .action(
    async (
      question: string,
      options: {
        dfs?: boolean;
        budget?: string;
        relation?: string[];
        context?: string[];
        evidence?: string[];
        nodeType?: string[];
        language?: string[];
      }
    ) => {
      const budget = options.budget ? parsePositiveInt(options.budget, 0) || undefined : undefined;
      const filters: GraphQueryFilters = {
        relations: options.relation,
        relationGroups: options.context as GraphQueryFilters["relationGroups"],
        evidenceClasses: options.evidence as GraphQueryFilters["evidenceClasses"],
        nodeTypes: options.nodeType as GraphQueryFilters["nodeTypes"],
        languages: options.language as GraphQueryFilters["languages"]
      };
      const result = await queryGraphVault(process.cwd(), question, {
        traversal: options.dfs ? "dfs" : "bfs",
        budget,
        filters
      });
      if (isJson()) {
        emitJson(result);
        return;
      }
      log(result.summary);
      // Inline the top match's wiki page so one query answers most
      // where-is/what-calls questions without a follow-up file read.
      if (result.topMatchPagePath) {
        const page = await readPage(process.cwd(), result.topMatchPagePath).catch(() => null);
        if (page?.content) {
          const limit = 1600;
          const excerpt =
            page.content.length > limit
              ? `${page.content.slice(0, limit)}\n… (truncated — read wiki/${result.topMatchPagePath} for the rest)`
              : page.content;
          log(`\n--- Top match page: wiki/${result.topMatchPagePath} ---\n${excerpt}`);
        }
      }
    }
  );

graph
  .command("path")
  .description("Find the shortest graph path between two nodes or pages.")
  .argument("<from>", "Source node/page label or id")
  .argument("<to>", "Target node/page label or id")
  .action(async (from: string, to: string) => {
    const result = await pathGraphVault(process.cwd(), from, to);
    if (isJson()) {
      emitJson(result);
      return;
    }
    log(result.summary);
  });

graph
  .command("explain")
  .description("Explain a graph node, its page, community, and neighbors.")
  .argument("<target>", "Node/page label or id")
  .action(async (target: string) => {
    const result = await explainGraphVault(process.cwd(), target);
    if (isJson()) {
      emitJson(result);
      return;
    }
    log(result.summary);
  });

graph
  .command("callers")
  .description("List the callers of a symbol with file:line call-site evidence from graph call edges.")
  .argument("<target>", "Symbol label or node id")
  .action(async (target: string) => {
    const result = await listGraphCallers(process.cwd(), target);
    if (isJson()) {
      emitJson(result);
      return;
    }
    log(result.summary);
  });

graph
  .command("god-nodes")
  .description("List the highest-connectivity non-source graph nodes.")
  .option("--limit <n>", "Maximum number of nodes to return", "10")
  .action(async (options: { limit?: string }) => {
    const limit = parsePositiveInt(options.limit, 10);
    const result = await listGodNodes(process.cwd(), limit);
    if (isJson()) {
      emitJson(result);
      return;
    }
    for (const node of result) {
      log(`${node.label} degree=${node.degree ?? 0} bridge=${node.bridgeScore ?? 0}`);
    }
  });

graph
  .command("blast")
  .description("Show the blast radius of changing a file or module.")
  .argument("<target>", "File path, module label, or module id")
  .option("--depth <n>", "Maximum traversal depth", "3")
  .action(async (target: string, options: { depth?: string }) => {
    const depth = parsePositiveInt(options.depth, 3);
    const result = await blastRadiusVault(process.cwd(), target, { maxDepth: depth });
    if (isJson()) {
      emitJson(result);
      return;
    }
    log(result.summary);
    for (const mod of result.affectedModules) {
      log(`  ${"  ".repeat(mod.depth - 1)}${mod.label} (depth ${mod.depth})`);
    }
  });

graph
  .command("cycles")
  .description("Find directed cycles in the compiled graph, defaulting to import edges.")
  .option("--relation <name>", "Relation name to follow (repeatable; default: imports)", collectRepeated, [])
  .option("--limit <n>", "Maximum cycles to report", "25")
  .option("--max-depth <n>", "Maximum cycle depth", "25")
  .action(async (options: { relation?: string[]; limit?: string; maxDepth?: string }) => {
    const { paths } = await loadVaultConfig(process.cwd());
    const raw = await readFile(paths.graphPath, "utf-8");
    const graphArtifact: GraphArtifact = JSON.parse(raw);
    const result = findGraphCycles(graphArtifact, {
      relations: options.relation?.length ? options.relation : ["imports"],
      limit: parsePositiveInt(options.limit, 25),
      maxDepth: parsePositiveInt(options.maxDepth, 25)
    });
    if (isJson()) {
      emitJson(result);
      return;
    }
    log(result.summary);
    for (const cycle of result.cycles) {
      log(`- ${cycle.labels.join(" -> ")} -> ${cycle.labels[0]} (${cycle.relations.join(", ")})`);
    }
  });

graph
  .command("supersession")
  .description("Record that one page has been replaced by another (writes a superseded_by edge).")
  .argument("<pageId>", "Page id or path of the older page")
  .argument("<replacedById>", "Page id or path of the replacement page")
  .action(async (pageId: string, replacedById: string) => {
    const result = await createSupersessionEdge(process.cwd(), pageId, replacedById);
    if (isJson()) {
      emitJson(result);
      return;
    }
    log(`Superseded ${result.oldPageId} by ${result.newPageId} (edge ${result.edgeId}).`);
  });

const review = program.command("review").description("Review staged compile approval bundles.");
review
  .command("list")
  .description("List staged approval bundles and their resolution status.")
  .action(async () => {
    const approvals = await listApprovals(process.cwd());
    if (isJson()) {
      emitJson(approvals);
      return;
    }
    if (!approvals.length) {
      log("No approval bundles.");
      return;
    }
    for (const approval of approvals) {
      log(
        `${approval.approvalId}${approval.bundleType ? ` [${approval.bundleType}]` : ""}${approval.title ? ` ${approval.title}` : ""} pending=${approval.pendingCount} accepted=${approval.acceptedCount} rejected=${approval.rejectedCount} created=${approval.createdAt}`
      );
    }
  });

review
  .command("show")
  .description("Show the entries inside a staged approval bundle.")
  .argument("<approvalId>", "Approval bundle identifier")
  .option("--diff", "Show unified diff for each entry", false)
  .action(async (approvalId: string, options: { diff?: boolean }) => {
    const approval = await readApproval(process.cwd(), approvalId, { diff: options.diff });
    if (isJson()) {
      emitJson(approval);
      return;
    }
    log(
      `${approval.approvalId}${approval.bundleType ? ` [${approval.bundleType}]` : ""}${approval.title ? ` ${approval.title}` : ""} pending=${approval.pendingCount} accepted=${approval.acceptedCount} rejected=${approval.rejectedCount}`
    );
    for (const entry of approval.entries) {
      log(
        `- ${entry.status} ${entry.changeType}${entry.label ? ` [${entry.label}]` : ""} ${entry.pageId} ${entry.nextPath ?? entry.previousPath ?? ""}`.trim()
      );
      if (entry.changeSummary) log(`  Summary: ${entry.changeSummary}`);
      if (entry.diff) {
        log("");
        log(entry.diff);
        log("");
      }
    }
  });

review
  .command("accept")
  .description("Accept all pending entries, or selected entries, from a staged approval bundle.")
  .argument("<approvalId>", "Approval bundle identifier")
  .argument("[targets...]", "Optional page ids or paths to accept")
  .action(async (approvalId: string, targets: string[]) => {
    const result = await acceptApproval(process.cwd(), approvalId, targets);
    if (isJson()) {
      emitJson(result);
    } else {
      log(`Accepted ${result.updatedEntries.length} entr${result.updatedEntries.length === 1 ? "y" : "ies"} from ${approvalId}.`);
    }
  });

review
  .command("reject")
  .description("Reject all pending entries, or selected entries, from a staged approval bundle.")
  .argument("<approvalId>", "Approval bundle identifier")
  .argument("[targets...]", "Optional page ids or paths to reject")
  .action(async (approvalId: string, targets: string[]) => {
    const result = await rejectApproval(process.cwd(), approvalId, targets);
    if (isJson()) {
      emitJson(result);
    } else {
      log(`Rejected ${result.updatedEntries.length} entr${result.updatedEntries.length === 1 ? "y" : "ies"} from ${approvalId}.`);
    }
  });

const candidate = program.command("candidate").description("Candidate page workflows.");
candidate
  .command("list")
  .description("List staged concept and entity candidates.")
  .action(async () => {
    const candidates = await listCandidates(process.cwd());
    if (isJson()) {
      emitJson(candidates);
      return;
    }
    if (!candidates.length) {
      log("No candidates.");
      return;
    }
    for (const entry of candidates) {
      log(`${entry.pageId} ${entry.path} -> ${entry.activePath}`);
    }
  });

candidate
  .command("promote")
  .description("Promote a candidate into its active concept or entity path.")
  .argument("<target>", "Candidate page id or path")
  .action(async (target: string) => {
    const result = await promoteCandidate(process.cwd(), target);
    if (isJson()) {
      emitJson(result);
    } else {
      log(`Promoted ${result.pageId} to ${result.path}`);
    }
  });

candidate
  .command("archive")
  .description("Archive a candidate by removing it from the active candidate set.")
  .argument("<target>", "Candidate page id or path")
  .action(async (target: string) => {
    const result = await archiveCandidate(process.cwd(), target);
    if (isJson()) {
      emitJson(result);
    } else {
      log(`Archived ${result.pageId}`);
    }
  });

candidate
  .command("auto-promote")
  .description("Apply configured auto-promotion rules to staged candidates. Requires candidate.autoPromote.enabled in config.")
  .option("--dry-run", "Score candidates without moving files", false)
  .action(async (options: { dryRun?: boolean }) => {
    const result = await runAutoPromotion(process.cwd(), { dryRun: options.dryRun ?? false });
    if (isJson()) {
      emitJson(result);
      return;
    }
    log(
      `${result.dryRun ? "Dry-run" : "Promoted"} ${result.promotedPageIds.length} of ${result.decisions.length} candidates. Session: ${result.sessionPath ?? "none"}`
    );
    for (const decision of result.decisions) {
      const mark = decision.promote ? (result.promotedPageIds.includes(decision.pageId) ? "+" : "~") : "-";
      log(`  ${mark} ${decision.pageId} score=${decision.score.toFixed(2)} ${decision.reasons.join("; ")}`);
    }
  });

candidate
  .command("preview-scores")
  .description("Show promotion scores for staged candidates without promoting.")
  .action(async () => {
    const decisions = await previewCandidatePromotions(process.cwd());
    if (isJson()) {
      emitJson(decisions);
      return;
    }
    if (!decisions.length) {
      log("No candidates to score.");
      return;
    }
    for (const decision of decisions) {
      const verdict = decision.promote ? "promote" : "skip";
      log(`${verdict} ${decision.pageId} score=${decision.score.toFixed(2)} ${decision.reasons.join("; ")}`);
    }
  });

const provider = program.command("provider").description("Configure provider adapters.");
provider
  .command("setup")
  .description("Interactive setup for a provider (currently: local-whisper). Checks for required binaries and downloads models.")
  .option("--local-whisper", "Set up the local Whisper (whisper.cpp) provider", false)
  .option("--model <model>", "Whisper model to install (e.g. tiny.en, base.en, small.en)", "base.en")
  .option("--apply", "Skip confirmation prompts and download/install automatically", false)
  .option("--set-audio-provider", "Force tasks.audioProvider to local-whisper even if another provider is already configured", false)
  .action(async (options: { localWhisper?: boolean; model?: string; apply?: boolean; setAudioProvider?: boolean }) => {
    if (!options.localWhisper) {
      throw new Error("Specify a provider to set up (currently: --local-whisper).");
    }
    const modelName = (options.model ?? "base.en").trim();
    if (!modelName) {
      throw new Error("Model name cannot be empty.");
    }
    const status = await summarizeLocalWhisperSetup({ modelName });

    if (isJson()) {
      emitJson({ ...status, apply: Boolean(options.apply), configWrite: null });
      return;
    }

    log(`whisper.cpp binary: ${status.binary.found ? status.binary.path : "NOT FOUND"}`);
    if (!status.binary.found) {
      log(status.binary.installHint);
      log("Re-run once whisper.cpp is on $PATH.");
      process.exitCode = 1;
      return;
    }

    log(`Model "${modelName}": ${status.model.exists ? status.model.expectedPath : "missing"}`);

    if (!status.model.exists) {
      const sizeHint = status.model.approximateSize ? ` (~${status.model.approximateSize})` : "";
      log(`Download plan: ${status.model.downloadUrl}${sizeHint} -> ${status.model.expectedPath}`);
      const proceed = options.apply === true || (await confirmInteractive(`Download ggml-${modelName}.bin now?`));
      if (!proceed) {
        log("Skipped download. Run with --apply (or confirm y) to download.");
        process.exitCode = 1;
        return;
      }
      const downloaded = await downloadWhisperModel({
        modelName,
        onProgress: (progress) => {
          if (progress.totalBytes) {
            const percent = Math.floor((progress.downloadedBytes / progress.totalBytes) * 100);
            process.stderr.write(`\r[swarmvault] downloading ggml-${modelName}.bin: ${percent}%`);
          }
        }
      });
      process.stderr.write("\n");
      log(`Downloaded ${downloaded.bytes} bytes to ${downloaded.path}.`);
    }

    const registration = await registerLocalWhisperProvider({
      rootDir: process.cwd(),
      model: modelName,
      setAsAudioProvider: options.setAudioProvider ? true : undefined
    });
    if (registration.providerWasAdded) {
      log(`Registered provider "local-whisper" in ${registration.configPath}.`);
    } else if (registration.providerWasUpdated) {
      log(`Updated existing "local-whisper" provider entry in ${registration.configPath}.`);
    } else {
      log(`Provider "local-whisper" already configured in ${registration.configPath}.`);
    }
    if (registration.audioProviderSet) {
      log(`Set tasks.audioProvider = "local-whisper".`);
    } else if (registration.previousAudioProvider && registration.previousAudioProvider !== "local-whisper") {
      log(`Left tasks.audioProvider = "${registration.previousAudioProvider}" untouched (use --set-audio-provider to override).`);
    }
  });

provider
  .command("add")
  .description("Add or update a named provider in swarmvault.config.json.")
  .argument("<id>", "Provider id")
  .requiredOption("--type <type>", `Provider type: ${providerTypes.join(", ")}`)
  .requiredOption("--model <model>", "Provider model name")
  .option("--base-url <url>", "OpenAI-compatible base URL")
  .option("--api-key-env <name>", "Environment variable that holds the provider API key")
  .option("--capability <capability>", `Provider capability (${providerCapabilities.join(", ")})`, collectRepeated, [])
  .option("--task <task>", `Assign provider to task (${providerTaskKeys.join(", ")})`, collectRepeated, [])
  .option("--api-style <style>", "OpenAI-compatible API style: responses or chat")
  .option("--module <path>", "Custom provider module path")
  .option("--binary-path <path>", "Local provider binary path")
  .option("--model-path <path>", "Local model file path")
  .option("--threads <n>", "Local provider thread count")
  .action(
    async (
      id: string,
      options: {
        type: string;
        model: string;
        baseUrl?: string;
        apiKeyEnv?: string;
        capability?: string[];
        task?: string[];
        apiStyle?: string;
        module?: string;
        binaryPath?: string;
        modelPath?: string;
        threads?: string;
      }
    ) => {
      const apiStyle = options.apiStyle as "responses" | "chat" | undefined;
      if (apiStyle && apiStyle !== "responses" && apiStyle !== "chat") {
        throw new Error("--api-style must be responses or chat.");
      }
      const threads = options.threads ? parsePositiveInt(options.threads, 0) || undefined : undefined;
      const result = await addProviderConfig({
        rootDir: process.cwd(),
        providerId: id,
        provider: {
          type: parseProviderType(options.type),
          model: options.model,
          baseUrl: options.baseUrl,
          apiKeyEnv: options.apiKeyEnv,
          capabilities: options.capability?.map(parseProviderCapability),
          apiStyle,
          module: options.module,
          binaryPath: options.binaryPath,
          modelPath: options.modelPath,
          threads
        },
        tasks: options.task?.map(parseProviderTask)
      });
      if (isJson()) {
        emitJson(result);
        return;
      }
      log(`${result.added ? "Added" : result.updated ? "Updated" : "Kept"} provider ${result.providerId} in ${result.configPath}.`);
      if (result.updatedTasks.length) {
        log(`Assigned tasks: ${result.updatedTasks.join(", ")}`);
      }
    }
  );

provider
  .command("list")
  .description("List configured providers and task assignments.")
  .action(async () => {
    const entries = await listProviderConfigEntries(process.cwd());
    if (isJson()) {
      emitJson(entries);
      return;
    }
    if (!entries.length) {
      log("No providers configured.");
      return;
    }
    for (const entry of entries) {
      const tasks = entry.assignedTasks.length ? ` tasks=${entry.assignedTasks.join(",")}` : "";
      const key = entry.apiKeyEnv ? ` key=${entry.apiKeyEnv}` : "";
      log(`${entry.id} type=${entry.type} model=${entry.model}${key}${tasks}`);
    }
  });

provider
  .command("show")
  .description("Show one configured provider.")
  .argument("<id>", "Provider id")
  .action(async (id: string) => {
    const entry = await getProviderConfigEntry(process.cwd(), id);
    if (!entry) {
      throw new Error(`Provider ${id} is not configured.`);
    }
    if (isJson()) {
      emitJson(entry);
      return;
    }
    log(`${entry.id}`);
    log(`type=${entry.type}`);
    log(`model=${entry.model}`);
    if (entry.baseUrl) log(`baseUrl=${entry.baseUrl}`);
    if (entry.apiKeyEnv) log(`apiKeyEnv=${entry.apiKeyEnv}`);
    if (entry.capabilities.length) log(`capabilities=${entry.capabilities.join(",")}`);
    if (entry.assignedTasks.length) log(`tasks=${entry.assignedTasks.join(",")}`);
  });

provider
  .command("remove")
  .description("Remove a configured provider and reassign its tasks to a fallback provider.")
  .argument("<id>", "Provider id")
  .option("--fallback <id>", "Fallback provider for tasks currently assigned to the removed provider")
  .action(async (id: string, options: { fallback?: string }) => {
    const result = await removeProviderConfig({
      rootDir: process.cwd(),
      providerId: id,
      fallbackProviderId: options.fallback
    });
    if (isJson()) {
      emitJson(result);
      return;
    }
    log(`${result.removed ? "Removed" : "No provider named"} ${id}.`);
    if (result.reassignedTasks.length) {
      log(`Reassigned tasks to ${result.fallbackProviderId}: ${result.reassignedTasks.join(", ")}`);
    }
    if (result.clearedTasks.length) {
      log(`Cleared task assignments: ${result.clearedTasks.join(", ")}`);
    }
  });

async function confirmInteractive(message: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = (await rl.question(`${message} [y/N] `)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

const watch = program
  .command("watch")
  .description("Watch the inbox directory and optionally tracked repos, or run one refresh cycle immediately.")
  .argument("[path]", "Optional repo root to watch or refresh instead of config/auto-discovery")
  .option("--lint", "Run lint after each compile cycle", false)
  .option("--repo", "Also refresh tracked repo sources and watch their repo roots", false)
  .option("--once", "Run one import/refresh cycle immediately instead of starting a watcher", false)
  .option("--code-only", "Only re-extract code sources (AST-only, no LLM re-analysis)", false)
  .option("--debounce <ms>", "Debounce window in milliseconds", "900")
  .option("--root <path>", "Watch this repo root instead of config/auto-discovery (repeat for multiple)", collectRepeated, [] as string[])
  .option("--force", "Allow graph updates even when node or edge counts shrink sharply", false)
  .action(
    async (
      targetPath: string | undefined,
      options: {
        lint?: boolean;
        repo?: boolean;
        once?: boolean;
        codeOnly?: boolean;
        debounce?: string;
        root?: string[];
        force?: boolean;
      }
    ) => {
      const debounceMs = parsePositiveInt(options.debounce, 900);
      const rootOverrides = [...(targetPath ? [targetPath] : []), ...(options.root ?? [])];
      const overrideRoots = rootOverrides.length > 0 ? rootOverrides : undefined;
      const repoMode = options.repo || Boolean(targetPath);
      if (options.once) {
        const result = await runWatchCycle(process.cwd(), {
          lint: options.lint ?? false,
          repo: repoMode,
          codeOnly: options.codeOnly ?? false,
          debounceMs,
          force: options.force ?? false,
          overrideRoots
        });
        if (isJson()) {
          emitJson(result);
        } else {
          log(
            `Refreshed inbox${repoMode ? " and tracked repos" : ""}. Imported ${result.importedCount}, repo imported ${result.repoImportedCount}, repo updated ${result.repoUpdatedCount}, repo removed ${result.repoRemovedCount}.`
          );
        }
        return;
      }
      const { paths } = await loadVaultConfig(process.cwd());
      const controller = await watchVault(process.cwd(), {
        lint: options.lint ?? false,
        repo: repoMode,
        codeOnly: options.codeOnly ?? false,
        debounceMs,
        force: options.force ?? false,
        overrideRoots
      });
      if (isJson()) {
        emitJson({ status: "watching", inboxDir: paths.inboxDir, repo: repoMode });
      } else {
        log(`Watching inbox${repoMode ? " and tracked repos" : ""} for changes. Press Ctrl+C to stop.`);
      }
      process.on("SIGINT", async () => {
        try {
          await controller.close();
        } catch {}
        process.exit(0);
      });
    }
  );

watch
  .command("list-roots")
  .description("Print the effective watched repo roots resolved from config and auto-discovery.")
  .action(async () => {
    const roots = await listWatchedRoots(process.cwd());
    if (isJson()) {
      emitJson({ roots });
      return;
    }
    if (roots.length === 0) {
      log("No watched repo roots.");
      return;
    }
    for (const entry of roots) {
      log(entry);
    }
  });

watch
  .command("add-root <path>")
  .description("Persist a repo root into swarmvault.config.json watch.repoRoots.")
  .action(async (pathValue: string) => {
    const resolved = await addWatchedRoot(process.cwd(), pathValue);
    if (isJson()) {
      emitJson({ added: resolved });
      return;
    }
    log(`Watching ${resolved}`);
  });

watch
  .command("remove-root <path>")
  .description("Remove a repo root from swarmvault.config.json watch.repoRoots.")
  .action(async (pathValue: string) => {
    const removed = await removeWatchedRoot(process.cwd(), pathValue);
    if (isJson()) {
      emitJson({ removed });
      return;
    }
    log(removed ? `Removed ${pathValue}` : `${pathValue} was not in watch.repoRoots.`);
  });

async function showWatchStatus(): Promise<void> {
  const result = await getWatchStatus(process.cwd());
  if (isJson()) {
    emitJson(result);
    return;
  }
  log(`Watched repo roots: ${result.watchedRepoRoots.length}`);
  log(`Pending semantic refresh: ${result.pendingSemanticRefresh.length}`);
  for (const entry of result.pendingSemanticRefresh.slice(0, 8)) {
    log(`- ${entry.changeType} ${entry.path}`);
  }
}

watch.command("status").description("Show the latest watch run plus pending semantic refresh entries.").action(showWatchStatus);

program.command("watch-status").description("Show the latest watch run plus pending semantic refresh entries.").action(showWatchStatus);

program
  .command("check-update", { hidden: true })
  .description("Compatibility alias for graph status: read-only graph/report freshness and tracked repo change check.")
  .argument("[path]", "Optional repo root to check instead of configured/tracked roots")
  .action(showGraphStatusCommand);

program
  .command("update", { hidden: true })
  .description("Compatibility alias for graph update: refresh code-derived graph artifacts from tracked repo roots.")
  .argument("[path]", "Optional repo root to refresh instead of configured/tracked roots")
  .option("--file <path>", "Refresh only this file (repeatable); skips the full tracked-root walk", collectRepeated, [])
  .option("--lint", "Run lint after the refresh cycle", false)
  .option("--force", "Allow graph updates even when node or edge counts shrink sharply", false)
  .action(runGraphUpdateCommand);

program
  .command("cluster-only", { hidden: true })
  .description("Compatibility alias for graph cluster: recompute graph communities and report artifacts without re-ingesting.")
  .argument("[vault]", "Optional vault root to cluster instead of the current directory")
  .option("--resolution <number>", "Override the Louvain community resolution for this run")
  .action((vaultPath: string | undefined, options: { resolution?: string }) =>
    runGraphClusterCommand(options, vaultPath ? path.resolve(process.cwd(), vaultPath) : process.cwd())
  );

program
  .command("tree", { hidden: true })
  .description("Compatibility alias for graph tree: write a collapsible source/module/symbol tree for the compiled graph.")
  .option("--output <html>", "Output HTML path (default: wiki/graph/tree.html)")
  .option("--root <path>", "Vault root to read instead of the current directory")
  .option("--label <name>", "Tree title")
  .option("--max-children <n>", "Maximum children to render per tree node", "250")
  .action(runGraphTreeCommand);

program
  .command("merge-graphs", { hidden: true })
  .description("Compatibility alias for graph merge: combine graph JSON files into one namespaced graph artifact.")
  .argument("<graphs...>", "Graph JSON files to merge")
  .requiredOption("--out <path>", "Output graph JSON path")
  .option("--label <name>", "Label/prefix to use when merging one graph")
  .action(runGraphMergeCommand);

const hook = program.command("hook").description("Install local git hooks that keep tracked repos and the vault in sync.");
hook
  .command("install")
  .description("Install post-commit and post-checkout hooks for the nearest git repository, or an explicit repo below the vault root.")
  .argument("[repo]", "Optional git repo path when the tracked repo lives below the vault root")
  .action(async (repo: string | undefined) => {
    const status = await installGitHooks(process.cwd(), { repoPath: repo });
    if (isJson()) {
      emitJson(status);
      return;
    }
    log(`Installed hooks in ${status.repoRoot}`);
  });

hook
  .command("uninstall")
  .description("Remove the SwarmVault-managed git hook blocks from the nearest git repository or an explicit repo path.")
  .argument("[repo]", "Optional git repo path when the tracked repo lives below the vault root")
  .action(async (repo: string | undefined) => {
    const status = await uninstallGitHooks(process.cwd(), { repoPath: repo });
    if (isJson()) {
      emitJson(status);
      return;
    }
    log(`Removed SwarmVault hook blocks from ${status.repoRoot ?? "the current workspace"}`);
  });

hook
  .command("status")
  .description("Show whether SwarmVault-managed git hooks are installed.")
  .argument("[repo]", "Optional git repo path when the tracked repo lives below the vault root")
  .action(async (repo: string | undefined) => {
    const status = await getGitHookStatus(process.cwd(), { repoPath: repo });
    if (isJson()) {
      emitJson(status);
      return;
    }
    if (!status.repoRoot) {
      log("No git repository found.");
      return;
    }
    log(`repo=${status.repoRoot}`);
    log(`post-commit=${status.postCommit}`);
    log(`post-checkout=${status.postCheckout}`);
  });

const schedule = program.command("schedule").description("Run scheduled vault maintenance jobs.");
schedule
  .command("list")
  .description("List configured schedule jobs and their next run state.")
  .action(async () => {
    const schedules = await listSchedules(process.cwd());
    if (isJson()) {
      emitJson(schedules);
      return;
    }
    if (!schedules.length) {
      log("No schedules configured.");
      return;
    }
    for (const entry of schedules) {
      log(
        `${entry.jobId} enabled=${entry.enabled} task=${entry.taskType} next=${entry.nextRunAt ?? "n/a"} last=${entry.lastRunAt ?? "never"} status=${entry.lastStatus ?? "n/a"} approval=${entry.lastApprovalId ?? "none"}`
      );
    }
  });

schedule
  .command("run")
  .description("Run one configured schedule job immediately.")
  .argument("<jobId>", "Schedule identifier")
  .action(async (jobId: string) => {
    const result = await runSchedule(process.cwd(), jobId);
    if (isJson()) {
      emitJson(result);
      return;
    }
    log(
      `${jobId} ${result.success ? "completed" : "failed"} (${result.taskType})${result.approvalId ? ` approval=${result.approvalId}` : ""}${
        result.error ? ` error=${result.error}` : ""
      }`
    );
  });

schedule
  .command("serve")
  .description("Run the local schedule loop.")
  .option("--poll <ms>", "Polling interval in milliseconds", "30000")
  .action(async (options: { poll?: string }) => {
    const pollMs = parsePositiveInt(options.poll, 30_000);
    const controller = await serveSchedules(process.cwd(), pollMs);
    if (isJson()) {
      emitJson({ status: "serving", pollMs });
    } else {
      log("Serving schedules. Press Ctrl+C to stop.");
    }
    process.on("SIGINT", async () => {
      try {
        await controller.close();
      } catch {}
      process.exit(0);
    });
  });

program
  .command("migrate")
  .description("Detect vault version and plan or apply schema/config/graph migrations.")
  .option("--target <version>", "Limit migrations to those at or below this target version")
  .option("--apply", "Write migration changes to disk (default is dry-run)", false)
  .option("--dry-run", "Report planned changes without writing (overrides --apply)", false)
  .action(async (options: { target?: string; apply?: boolean; dryRun?: boolean }) => {
    const dryRun = options.dryRun === true ? true : options.apply !== true;
    const result = await runMigration(process.cwd(), { targetVersion: options.target, dryRun });
    if (isJson()) {
      emitJson(result);
      return;
    }
    log(
      `Vault version: ${result.fromVersion ?? "unknown"} → ${result.toVersion} (${result.planned} step${result.planned === 1 ? "" : "s"} planned, ${result.applied.length} applied, ${result.skipped.length} skipped${dryRun ? "; dry-run" : ""})`
    );
    for (const entry of result.applied) {
      log(`applied ${entry.id}: ${entry.changed.length} change${entry.changed.length === 1 ? "" : "s"}`);
    }
    for (const entry of result.skipped) {
      log(`skip    ${entry.id}: ${entry.reason}`);
    }
  });

program
  .command("mcp")
  .description("Run SwarmVault as a local MCP server over stdio.")
  .action(async () => {
    if (isJson()) {
      process.stderr.write(`${JSON.stringify({ status: "running", transport: "stdio" })}\n`);
    }
    const controller = await startMcpServer(process.cwd());
    process.on("SIGINT", async () => {
      try {
        await controller.close();
      } catch {}
      process.exit(0);
    });
  });

const install = program.command("install").description("Install SwarmVault instructions for an agent in the current project.");

install
  .command("status")
  .description("Show whether SwarmVault instructions are installed for an agent.")
  .requiredOption("--agent <agent>", "Agent name")
  .option("--hook", "Include hook/plugin targets in the status check", false)
  .option("--mcp", "Include MCP config targets in the status check", false)
  .option("--scope <scope>", "Install scope to inspect: project or user", "project")
  .action(async (options: { agent: AgentType; hook?: boolean; mcp?: boolean; scope?: string }) => {
    const scope = options.scope === "user" ? "user" : "project";
    const result = await getAgentInstallStatus(process.cwd(), options.agent, {
      hook: options.hook ?? false,
      mcp: options.mcp ?? false,
      scope
    });
    if (isJson()) {
      emitJson(result);
      return;
    }
    log(`${result.agent} ${result.installed ? "installed" : "not installed"} (${result.scope}${result.hook ? ", hook" : ""})`);
    for (const target of result.targets) {
      log(`${target.exists ? "ok" : "missing"} ${target.path}`);
    }
  });

install
  .option(
    "--agent <agent>",
    "claude, codex, cursor, gemini, goose, opencode, copilot, aider, droid, pi, trae, claw, kiro, kilo, hermes, antigravity, vscode, amp, augment, adal, bob, cline, codebuddy, command-code, continue, cortex, crush, deepagents, devin, firebender, iflow, junie, kilo-code, kimi, kode, mcpjam, mistral-vibe, mux, neovate, openclaw, openhands, pochi, qoder, qwen-code, replit, roo-code, trae-cn, warp, windsurf, or zencoder"
  )
  .option("--hook", "Also install hook/plugin guidance when the target agent supports it", false)
  .option("--mcp", "Also register the SwarmVault MCP server in the agent's project MCP config", false)
  .option(
    "--graph-first [mode]",
    "Opt in to graph-first search enforcement for installed hooks: deny (default when the flag is passed), context, or off; persisted as hooks.graphFirst"
  )
  .option("--scope <scope>", "Install scope: project or user", "project")
  .action(async (options: { agent?: AgentType; hook?: boolean; mcp?: boolean; graphFirst?: string | boolean; scope?: string }) => {
    if (!options.agent) {
      throw new Error("Specify --agent <agent>.");
    }
    const hookCapableAgents = new Set(["codex", "claude", "opencode", "gemini", "copilot", "kilo"]);
    if (options.hook && !hookCapableAgents.has(options.agent)) {
      throw new Error("--hook is only supported for --agent codex, claude, opencode, gemini, copilot, or kilo");
    }
    if (options.mcp && options.agent !== "claude") {
      throw new Error("--mcp is currently only supported for --agent claude (project-level .mcp.json)");
    }
    let graphFirst: "deny" | "context" | "off" | undefined;
    if (options.graphFirst !== undefined) {
      const mode = options.graphFirst === true ? "deny" : String(options.graphFirst).toLowerCase();
      if (mode !== "deny" && mode !== "context" && mode !== "off") {
        throw new Error("--graph-first accepts deny, context, or off");
      }
      graphFirst = mode;
    }
    const scope = options.scope === "user" ? "user" : "project";
    const result = await installAgent(process.cwd(), options.agent, {
      hook: options.hook ?? false,
      mcp: options.mcp ?? false,
      graphFirst,
      scope
    });
    if (isJson()) {
      emitJson({ ...result, hook: options.hook ?? false, mcp: options.mcp ?? false, graphFirst: graphFirst ?? null, scope });
    } else {
      log(`Installed rules into ${result.target}`);
      if (graphFirst) {
        log(`Graph-first hook mode set to "${graphFirst}" in swarmvault.config.json.`);
      } else if (options.hook) {
        log('Hooks run in advisory mode by default; add --graph-first to opt in to search enforcement (hooks.graphFirst: "deny").');
      }
      if (result.targets.length > 1) {
        log(`Also wrote: ${result.targets.filter((entry) => entry !== result.target).join(", ")}`);
      }
      for (const notice of result.notices ?? []) {
        log(notice);
      }
      for (const warning of result.warnings ?? []) {
        emitNotice(warning);
      }
    }
  });

program
  .command("demo")
  .description("Try SwarmVault with a bundled sample vault — zero config, zero API keys.")
  .option("--port <port>", "Port for the graph viewer")
  .option("--no-serve", "Skip launching the graph viewer after compile")
  .action(async (options: { port?: string; serve?: boolean }) => {
    const { mkdtemp, writeFile, mkdir } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");

    const demoDir = await mkdtemp(path.join(tmpdir(), "swarmvault-demo-"));
    if (!isJson()) {
      log(`Creating demo vault in ${demoDir}`);
    }

    const rawDir = path.join(demoDir, "raw", "sources");
    await mkdir(rawDir, { recursive: true });

    await writeFile(
      path.join(rawDir, "llm-wiki-pattern.md"),
      [
        "# The LLM Wiki Pattern",
        "",
        "Most AI tools answer a question then throw away the work. The LLM Wiki pattern",
        "keeps a durable wiki between you and raw sources. The LLM does the bookkeeping —",
        "updating cross-references, noting contradictions, maintaining consistency — while",
        "you do the thinking.",
        "",
        "## Three Layers",
        "",
        "1. **Raw sources** — immutable documents: books, articles, papers, transcripts, code.",
        "2. **The wiki** — LLM-generated markdown: summaries, entity pages, concept pages, cross-references.",
        "3. **The schema** — rules for how the wiki is organized and what matters in your domain.",
        "",
        "## Why This Beats RAG",
        "",
        "RAG re-derives knowledge on every query. The wiki compiles knowledge once and compounds",
        "it over time. Good answers get filed back as new pages, so exploration builds on itself.",
        "",
        "## Key Operations",
        "",
        "- **Ingest** — read a source, write summaries, update cross-references",
        "- **Query** — search the wiki, synthesize answers, file results back",
        "- **Lint** — health-check for contradictions, orphans, stale claims",
        ""
      ].join("\n")
    );

    await writeFile(
      path.join(rawDir, "knowledge-graphs.md"),
      [
        "# Knowledge Graphs for AI",
        "",
        "A knowledge graph represents information as typed nodes and edges with provenance.",
        "Unlike flat document stores, graphs let you traverse relationships, detect communities,",
        "and find surprising connections between concepts.",
        "",
        "## Node Types",
        "",
        "- **Sources** — the raw documents that feed the graph",
        "- **Concepts** — abstract ideas extracted from sources",
        "- **Entities** — named things: people, tools, organizations",
        "- **Modules** — code units with import/export relationships",
        "",
        "## Edge Semantics",
        "",
        "Every edge carries an evidence class: `extracted` (directly found), `inferred`",
        "(derived by reasoning), or `conflicted` (contradictory evidence). This provenance",
        "tracking prevents hallucination from compounding silently.",
        "",
        "## Contradiction Detection",
        "",
        "When two sources make conflicting claims, the graph flags the contradiction rather",
        "than silently picking one. This is critical for research wikis where outdated claims",
        "from older papers may conflict with newer findings.",
        "",
        "RAG systems do not track contradictions because they re-derive everything per query.",
        "A compiled wiki with a graph layer can detect and surface them automatically.",
        ""
      ].join("\n")
    );

    await writeFile(
      path.join(rawDir, "local-first-tools.md"),
      [
        "# Local-First AI Tools",
        "",
        "Local-first means your data stays on your machine by default. No cloud dependency,",
        "no API keys required for basic operation. Privacy is the default, not an option.",
        "",
        "## Advantages",
        "",
        "- **Privacy** — sensitive documents never leave your machine",
        "- **Speed** — no network latency for search and graph operations",
        "- **Reliability** — works offline, no service outages",
        "- **Cost** — no per-query API charges for basic workflows",
        "",
        "## The Heuristic Provider",
        "",
        "A heuristic provider uses deterministic text analysis — keyword extraction, TF-IDF,",
        "structural parsing — instead of LLM inference. It produces lower-quality summaries",
        "but runs instantly with zero setup. This makes it ideal for first-run experiences",
        "and air-gapped environments.",
        "",
        "For sharper concept extraction, pair with a local LLM via Ollama. This keeps",
        "everything on-device while getting model-backed analysis.",
        ""
      ].join("\n")
    );

    await initVault(demoDir, {});
    await ingestDirectory(demoDir, rawDir, {});
    await compileVault(demoDir, {});

    const { paths } = await loadVaultConfig(demoDir);
    const shareCardPath = path.join(demoDir, "wiki", "graph", "share-card.md");
    const shareCardSvgPath = path.join(demoDir, "wiki", "graph", "share-card.svg");
    const shareKitPath = path.join(demoDir, "wiki", "graph", "share-kit");

    let graphStats = "";
    try {
      const raw = await readFile(paths.graphPath, "utf-8");
      const graph: GraphArtifact = JSON.parse(raw);
      graphStats = ` (${graph.nodes.length} nodes, ${graph.edges.length} edges)`;
    } catch {}

    if (!isJson()) {
      log("");
      log(`Demo vault created${graphStats}.`);
      log("");
      log("What just happened:");
      log("  1. Created 3 sample sources about LLM wikis, knowledge graphs, and local-first tools");
      log("  2. Ingested and compiled them into a knowledge graph");
      log("  3. Generated wiki pages with cross-references and a graph report");
      log("");
      log(`Vault location: ${demoDir}`);
      log(`Share card: ${shareCardPath}`);
      log(`Visual card: ${shareCardSvgPath}`);
      log(`Share kit: ${shareKitPath}`);
    }

    if (options.serve !== false) {
      const port = options.port ? parsePositiveInt(options.port, 0) || undefined : undefined;
      const server = await startGraphServer(demoDir, port, { full: false });
      if (isJson()) {
        emitJson({
          demoDir,
          graphStats: graphStats.trim(),
          shareCardPath,
          shareCardSvgPath,
          shareKitPath,
          port: server.port,
          url: `http://localhost:${server.port}`
        });
      } else {
        log(`Graph viewer running at http://localhost:${server.port}`);
        log("");
        log("Try next:");
        log(`  cd ${demoDir}`);
        log("  swarmvault graph share --post");
        log('  swarmvault query "How does contradiction detection work?"');
        log("  swarmvault lint");
      }
      process.on("SIGINT", async () => {
        try {
          await server.close();
        } catch {}
        process.exit(0);
      });
    } else if (isJson()) {
      emitJson({ demoDir, graphStats: graphStats.trim(), shareCardPath, shareCardSvgPath, shareKitPath });
    } else {
      log("");
      log("Try next:");
      log(`  cd ${demoDir}`);
      log("  swarmvault graph share --post");
      log("  swarmvault graph serve");
      log('  swarmvault query "How does contradiction detection work?"');
    }
  });

program
  .command("diff")
  .description("Show what changed in the knowledge graph since the last compile.")
  .action(async () => {
    const rootDir = process.cwd();
    const { paths } = await loadVaultConfig(rootDir);

    let currentGraph: GraphArtifact;
    try {
      const raw = await readFile(paths.graphPath, "utf-8");
      currentGraph = JSON.parse(raw);
    } catch {
      if (isJson()) {
        emitJson({ error: "No compiled graph found. Run swarmvault compile first." });
      } else {
        log("No compiled graph found. Run swarmvault compile first.");
      }
      return;
    }

    // Try to get previous graph from git
    let previousGraph: GraphArtifact | undefined;
    const { execFileSync } = await import("node:child_process");
    try {
      const relPath = paths.graphPath.replace(`${rootDir}/`, "");
      const previousRaw = execFileSync("git", ["show", `HEAD:${relPath}`], {
        cwd: rootDir,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"]
      });
      previousGraph = JSON.parse(previousRaw);
    } catch {
      // No git history or not in a git repo — show current state summary instead
    }

    if (!previousGraph) {
      if (isJson()) {
        emitJson({
          status: "no-baseline",
          current: {
            nodes: currentGraph.nodes.length,
            edges: currentGraph.edges.length,
            pages: currentGraph.pages.length,
            communities: currentGraph.communities?.length ?? 0
          }
        });
      } else {
        log("No previous graph found (not in a git repo or no prior commit).");
        log("");
        log("Current graph:");
        log(`  ${currentGraph.nodes.length} nodes, ${currentGraph.edges.length} edges, ${currentGraph.pages.length} pages`);
        if (currentGraph.communities?.length) {
          log(`  ${currentGraph.communities.length} communities`);
        }
        const conflicted = currentGraph.edges.filter((e) => e.status === "conflicted");
        if (conflicted.length) {
          log(`  ${conflicted.length} conflicted edges`);
        }
      }
      return;
    }

    const diff = graphDiff(previousGraph, currentGraph);

    if (isJson()) {
      emitJson(diff);
      return;
    }

    if (diff.summary === "No changes") {
      log("No changes since last commit.");
      return;
    }

    log(diff.summary);
    log("");

    if (diff.addedNodes.length) {
      log("Added nodes:");
      for (const node of diff.addedNodes) {
        log(`  + [${node.type}] ${node.label}`);
      }
      log("");
    }

    if (diff.removedNodes.length) {
      log("Removed nodes:");
      for (const node of diff.removedNodes) {
        log(`  - [${node.type}] ${node.label}`);
      }
      log("");
    }

    if (diff.addedPages.length) {
      log("Added pages:");
      for (const page of diff.addedPages) {
        log(`  + [${page.kind}] ${page.title} (${page.path})`);
      }
      log("");
    }

    if (diff.removedPages.length) {
      log("Removed pages:");
      for (const page of diff.removedPages) {
        log(`  - [${page.kind}] ${page.title} (${page.path})`);
      }
      log("");
    }

    if (diff.addedEdges.length) {
      log(`Added edges: ${diff.addedEdges.length}`);
      for (const edge of diff.addedEdges.slice(0, 20)) {
        log(`  + ${edge.source} -[${edge.relation}]-> ${edge.target} (${edge.evidenceClass})`);
      }
      if (diff.addedEdges.length > 20) {
        log(`  ... and ${diff.addedEdges.length - 20} more`);
      }
      log("");
    }

    if (diff.removedEdges.length) {
      log(`Removed edges: ${diff.removedEdges.length}`);
      for (const edge of diff.removedEdges.slice(0, 20)) {
        log(`  - ${edge.source} -[${edge.relation}]-> ${edge.target}`);
      }
      if (diff.removedEdges.length > 20) {
        log(`  ... and ${diff.removedEdges.length - 20} more`);
      }
    }
  });

program
  .command("doctor")
  .description("Diagnose vault health across graph, retrieval, review queues, watch state, and migrations.")
  .option("--repair", "Run safe repairs such as rebuilding stale retrieval artifacts", false)
  .action(async (options: { repair?: boolean }) => {
    const report = await doctorVault(process.cwd(), { repair: options.repair });
    if (isJson()) {
      emitJson(report);
      return;
    }
    log(`Vault health: ${report.status}${report.repaired.length ? ` (repaired: ${report.repaired.join(", ")})` : ""}`);
    log(
      `Sources ${report.counts.sources} | Managed ${report.counts.managedSources} | Pages ${report.counts.pages} | Nodes ${report.counts.nodes} | Edges ${report.counts.edges}`
    );
    if (report.recommendations.length) {
      log("Recommended next actions:");
      for (const recommendation of report.recommendations) {
        const action = recommendation.command ? ` ${recommendation.command}` : "";
        log(`  [${recommendation.priority}] ${recommendation.label}:${action}`);
        if (recommendation.description) {
          log(`    ${recommendation.description}`);
        }
      }
    }
    for (const check of report.checks) {
      log(`[${check.status}] ${check.label}: ${check.summary}`);
      if (check.detail) {
        log(`  ${check.detail}`);
      }
      for (const action of check.actions ?? []) {
        log(`  Try: ${action.command} - ${action.description}`);
      }
    }
  });

const retrieval = program.command("retrieval").description("Inspect and repair the local retrieval index.");

retrieval
  .command("status")
  .description("Show retrieval index health and configuration.")
  .action(async () => {
    const status = await getRetrievalStatus(process.cwd());
    if (isJson()) {
      emitJson(status);
      return;
    }
    log(`Retrieval backend: ${status.configured.backend}`);
    log(`Index: ${status.indexExists ? "present" : "missing"} (${status.indexPath})`);
    log(`Manifest: ${status.manifestExists ? "present" : "missing"} (${status.manifestPath})`);
    log(`Graph: ${status.graphExists ? "present" : "missing"}`);
    log(`Pages indexed: ${status.pageCount}`);
    log(`State: ${status.stale ? "stale" : "fresh"}`);
    for (const warning of status.warnings) {
      log(`Warning: ${warning}`);
    }
  });

retrieval
  .command("rebuild")
  .description("Rebuild the local retrieval index from the current graph.")
  .action(async () => {
    const status = await rebuildRetrievalIndex(process.cwd());
    if (isJson()) {
      emitJson(status);
      return;
    }
    log(`Rebuilt retrieval index at ${status.indexPath}`);
    log(`Pages indexed: ${status.pageCount}`);
  });

retrieval
  .command("doctor")
  .description("Diagnose retrieval index problems and optionally repair them.")
  .option("--repair", "Rebuild stale or missing retrieval artifacts", false)
  .action(async (options: { repair?: boolean }) => {
    const result = await doctorRetrieval(process.cwd(), { repair: options.repair });
    if (isJson()) {
      emitJson(result);
      return;
    }
    log(`Retrieval health: ${result.ok ? "ok" : "needs attention"}`);
    if (result.repaired) {
      log("Repaired retrieval index.");
    }
    if (result.actions.length) {
      log(`Suggested action(s): ${result.actions.join(", ")}`);
    }
    for (const warning of result.status.warnings) {
      log(`Warning: ${warning}`);
    }
  });

program
  .command("scan", { hidden: true })
  .description("Quick-start: initialize, ingest, compile, and serve a graph viewer in one command.")
  .argument("<input>", "Directory or public GitHub repo root URL to scan")
  .option("--port <port>", "Port for the graph viewer")
  .option("--no-serve", "Skip launching the graph viewer after compile")
  .option("--no-viz", "Compatibility alias for --no-serve; skip launching the graph viewer after compile")
  .option("--mcp", "Start the MCP stdio server after compile instead of launching the graph viewer", false)
  .option("--branch <name>", "GitHub branch to clone when scanning a public repo URL")
  .option("--ref <ref>", "Git ref, tag, or commit to check out when scanning a public repo URL")
  .option("--checkout-dir <path>", "Persistent checkout directory for a public GitHub repo scan")
  .option("--install-agent-rules", "Install configured agent rule files during initialization", false)
  .action(runScanCommand);

program
  .command("clone", { hidden: true })
  .description("Compatibility alias for scan: initialize, clone/register a public repo URL, and compile it into the vault.")
  .argument("<input>", "Public GitHub repo URL or local directory to scan")
  .option("--port <port>", "Port for the graph viewer")
  .option("--no-serve", "Skip launching the graph viewer after compile")
  .option("--no-viz", "Compatibility alias for --no-serve; skip launching the graph viewer after compile")
  .option("--mcp", "Start the MCP stdio server after compile instead of launching the graph viewer", false)
  .option("--branch <name>", "GitHub branch to clone when scanning a public repo URL")
  .option("--ref <ref>", "Git ref, tag, or commit to check out when scanning a public repo URL")
  .option("--checkout-dir <path>", "Persistent checkout directory for a public GitHub repo scan")
  .option("--install-agent-rules", "Install configured agent rule files during initialization", false)
  .action(runScanCommand);

function enableStructuredJsonOnSubcommands(command: Command): void {
  for (const subcommand of command.commands) {
    const hasJsonOption = subcommand.options.some((option) => option.attributeName() === "json");
    if (!hasJsonOption) {
      subcommand.option("--json", "Emit structured JSON output", false);
    }
    enableStructuredJsonOnSubcommands(subcommand);
  }
}

enableStructuredJsonOnSubcommands(program);

program.hook("preAction", (_command, actionCommand) => {
  activeCommand = actionCommand;
});

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (isJson()) {
    emitJson({ error: message });
  } else {
    process.stderr.write(`${message}\n`);
  }
  process.exit(1);
});
