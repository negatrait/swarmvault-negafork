import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { initWorkspace } from "./config.js";
import type { AgentInstallStatus, AgentType, InstallAgentOptions, InstallAgentResult } from "./types.js";
import { runGoSidecar } from "./subprocess.js";
import { ensureDir, fileExists } from "./utils.js";

/**
 * Resolves the directory containing the bundled hook scripts. At runtime
 * the engine is loaded from `dist/index.js`, and the tsup build emits hook
 * bundles alongside it under `dist/hooks/`. When the engine is running
 * from source (e.g. during vitest), the path points at the built hooks in
 * the engine package's dist folder instead.
 */
function resolveHooksDir(): string {
  // import.meta.url points at either dist/index.js (prod) or the source
  // file that's running under vitest. In both cases the built hooks live
  // under the engine package's dist/hooks/.
  const moduleUrl = import.meta.url;
  const modulePath = fileURLToPath(moduleUrl);
  const moduleDir = path.dirname(modulePath);
  // Case 1: moduleDir is `.../packages/engine/dist` (production build).
  // Case 2: moduleDir is `.../packages/engine/src` (running from source in tests).
  if (moduleDir.endsWith(`${path.sep}dist`)) {
    return path.join(moduleDir, "hooks");
  }
  if (moduleDir.endsWith(`${path.sep}src`)) {
    return path.resolve(moduleDir, "..", "dist", "hooks");
  }
  // Fallback: sibling dist/hooks of the module directory.
  return path.resolve(moduleDir, "hooks");
}

const BUILT_HOOKS_DIR = resolveHooksDir();
const hookContentCache = new Map<string, string>();

/**
 * Reads a bundled hook script from `dist/hooks/` and caches the result.
 * Throws a descriptive error if the hook is missing (usually because the
 * engine hasn't been built yet).
 */
async function readBuiltHook(hookFile: string): Promise<string> {
  const cached = hookContentCache.get(hookFile);
  if (cached !== undefined) {
    return cached;
  }
  const hookPath = path.join(BUILT_HOOKS_DIR, hookFile);
  try {
    const content = await fs.readFile(hookPath, "utf8");
    hookContentCache.set(hookFile, content);
    return content;
  } catch (error) {
    throw new Error(
      `SwarmVault hook bundle not found at ${hookPath}. ` +
        `Run 'pnpm --filter @swarmvaultai/engine build' so the hook scripts are emitted to dist/hooks/. ` +
        `Underlying error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

const managedStart = "<!-- swarmvault:managed:start -->";
const managedEnd = "<!-- swarmvault:managed:end -->";
const legacyManagedStart = "<!-- vault:managed:start -->";
const legacyManagedEnd = "<!-- vault:managed:end -->";

const claudePreToolUseMatchers = ["Grep|Glob", "Bash"] as const;
const claudePostEditMatcher = "Edit|Write|MultiEdit|NotebookEdit";
const claudeSessionMatchers = ["startup", "resume", "clear", "compact"] as const;

const geminiSessionMatcher = "startup";
const geminiSearchMatcher = "glob|grep|search|find";
const copilotHookVersion = 1;
const codexSearchMatcher = "Bash";

type JsonWarningResult<T> = {
  data: T;
  warnings: string[];
};

type ClaudeHookEntry = {
  matcher?: string;
  hooks?: Array<{ type?: string; command?: string }>;
};

type ClaudeSettings = {
  hooks?: {
    SessionStart?: ClaudeHookEntry[];
    PreToolUse?: ClaudeHookEntry[];
    PostToolUse?: ClaudeHookEntry[];
  };
};

type McpConfig = {
  mcpServers?: Record<string, { command?: string; args?: string[]; [key: string]: unknown }>;
  [key: string]: unknown;
};

type GeminiSettings = {
  hooks?: {
    SessionStart?: Array<{
      matcher?: string;
      hooks?: Array<{ name?: string; type?: string; command?: string }>;
    }>;
    BeforeTool?: Array<{
      matcher?: string;
      hooks?: Array<{ name?: string; type?: string; command?: string }>;
    }>;
  };
};

type CodexSettings = {
  hooks?: {
    SessionStart?: Array<{
      matcher?: string;
      hooks?: Array<{ type?: string; command?: string }>;
    }>;
    PreToolUse?: Array<{
      matcher?: string;
      hooks?: Array<{ type?: string; command?: string }>;
    }>;
  };
};

type CopilotHookConfig = {
  version?: number;
  hooks?: {
    sessionStart?: Array<{
      type?: string;
      bash?: string;
      powershell?: string;
      cwd?: string;
      timeoutSec?: number;
    }>;
    preToolUse?: Array<{
      matcher?: string;
      type?: string;
      bash?: string;
      powershell?: string;
      cwd?: string;
      timeoutSec?: number;
    }>;
  };
};

type PluginConfig = {
  plugins?: unknown;
  [key: string]: unknown;
};

const agentFileKinds = {
  agents: "AGENTS.md",
  claude: "CLAUDE.md",
  gemini: "GEMINI.md",
  cursor: ".cursor/rules/swarmvault.mdc",
  aider: "CONVENTIONS.md",
  copilot: ".github/copilot-instructions.md",
  trae: ".trae/rules/swarmvault.md",
  claw: ".claw/skills/swarmvault/SKILL.md",
  droid: ".factory/rules/swarmvault.md",
  kiro: ".kiro/skills/swarmvault/SKILL.md",
  kiroSteering: ".kiro/steering/swarmvault.md",
  antigravityRules: ".agents/rules/swarmvault.md",
  antigravityWorkflow: ".agents/workflows/swarmvault.md",
  devinRules: ".windsurf/rules/swarmvault.md",
  vscode: ".github/chatmodes/swarmvault.chatmode.md"
} as const;

const legacyAntigravityFileKinds = {
  antigravityRules: ".agent/rules/swarmvault.md",
  antigravityWorkflow: ".agent/workflows/swarmvault.md"
} as const;

// Project-level skill bundle directories for agents that follow the
// swarmskills convention (rooted at <project>/<dir>/swarmvault/SKILL.md).
// Paths mirror swarmskills' adapter table so a vault installed for these
// agents lines up with skill bundles managed by swarmskills.
const SKILL_BUNDLE_AGENTS: Record<string, string> = {
  amp: ".config/agents/skills",
  augment: ".augment/skills",
  adal: ".adal/skills",
  bob: ".bob/skills",
  cline: ".agents/skills",
  codebuddy: ".codebuddy/skills",
  "command-code": ".commandcode/skills",
  continue: ".continue/skills",
  cortex: ".snowflake/cortex/skills",
  crush: ".config/crush/skills",
  deepagents: ".deepagents/agent/skills",
  devin: ".devin/skills",
  firebender: ".firebender/skills",
  iflow: ".iflow/skills",
  junie: ".junie/skills",
  "kilo-code": ".kilocode/skills",
  kimi: ".config/agents/skills",
  kode: ".kode/skills",
  mcpjam: ".mcpjam/skills",
  "mistral-vibe": ".vibe/skills",
  mux: ".mux/skills",
  neovate: ".neovate/skills",
  openclaw: ".openclaw/skills",
  openhands: ".openhands/skills",
  pochi: ".pochi/skills",
  qoder: ".qoder/skills",
  "qwen-code": ".qwen/skills",
  replit: ".config/agents/skills",
  "roo-code": ".roo/skills",
  "trae-cn": ".trae-cn/skills",
  warp: ".agents/skills",
  windsurf: ".codeium/windsurf/skills",
  zencoder: ".zencoder/skills"
};

const PROJECT_SKILL_TARGETS: Partial<Record<AgentType, string[]>> = {
  antigravity: [".agents/skills"],
  amp: [".amp/skills"],
  claude: [".claude/skills"],
  codex: [".agents/skills"],
  copilot: [".copilot/skills"],
  devin: [".devin/skills"],
  gemini: [".gemini/skills"],
  kimi: [".kimi/skills"],
  opencode: [".opencode/skills"],
  pi: [".pi/agent/skills"],
  vscode: [".copilot/skills"]
};

const USER_SKILL_TARGETS: Partial<Record<AgentType, string>> = {
  antigravity: path.join(".gemini", "config", "skills"),
  amp: path.join(".amp", "skills"),
  claude: path.join(".claude", "skills"),
  codex: path.join(".codex", "skills"),
  copilot: path.join(".copilot", "skills"),
  devin: path.join(".config", "devin", "skills"),
  gemini: path.join(".gemini", "skills"),
  kimi: path.join(".kimi", "skills"),
  kilo: path.join(".config", "kilo", "skills"),
  opencode: path.join(".config", "opencode", "skills"),
  pi: path.join(".pi", "agent", "skills"),
  vscode: path.join(".copilot", "skills")
};

function skillBundleTarget(rootDir: string, agent: AgentType): string | null {
  const relativeSkillsDir = SKILL_BUNDLE_AGENTS[agent];
  if (!relativeSkillsDir) return null;
  return path.join(rootDir, relativeSkillsDir, "swarmvault", "SKILL.md");
}

function skillBundlePath(baseDir: string, relativeSkillsDir: string): string {
  return path.join(baseDir, relativeSkillsDir, "swarmvault", "SKILL.md");
}

function projectSkillTargets(rootDir: string, agent: AgentType): string[] {
  return (PROJECT_SKILL_TARGETS[agent] ?? []).map((relativeSkillsDir) => skillBundlePath(rootDir, relativeSkillsDir));
}

function userSkillTarget(agent: AgentType): string | null {
  const relativeSkillsDir = USER_SKILL_TARGETS[agent];
  return relativeSkillsDir ? skillBundlePath(os.homedir(), relativeSkillsDir) : null;
}

const hermesUserSkillRelative = path.join(".hermes", "skills", "swarmvault", "SKILL.md");

function hermesUserSkillPath(): string {
  return path.join(os.homedir(), hermesUserSkillRelative);
}

function kiloUserCommandPath(): string {
  return path.join(os.homedir(), ".config", "kilo", "command", "swarmvault.md");
}

const SWARMVAULT_RULE_BULLETS = [
  "- Read `swarmvault.schema.md` before compile or query style work. It is the canonical schema path.",
  "- Treat `raw/` as immutable source input.",
  "- Treat `wiki/` as generated markdown owned by the agent and compiler workflow.",
  "- If `SWARMVAULT_OUT` is set, resolve generated artifact paths like `raw/`, `wiki/`, and `state/` under that directory.",
  "- Read `wiki/graph/report.md` before broad file searching when it exists; otherwise start with `wiki/index.md`.",
  "- For code and graph questions (where is X, what calls Y, structure, impact), prefer `swarmvault graph query`, `swarmvault graph path`, and `swarmvault graph explain` over broad grep/glob searching; read source files directly only when editing them or when the graph lacks detail.",
  "- Preserve frontmatter fields including `page_id`, `source_ids`, `node_ids`, `freshness`, and `source_hashes`.",
  "- When asked for durable research, reviews, or handoff artifacts, save the answer into `wiki/outputs/`; answer quick questions directly in chat without writing files.",
  "- Prefer `swarmvault ingest`, `swarmvault compile`, `swarmvault query`, and `swarmvault lint` for SwarmVault maintenance tasks."
];

// Frozen pre-3.17 wording of changed bullets, kept only so legacy-file
// cleanup can still recognize content written by older releases.
const PRE_GRAPH_FIRST_BULLET =
  "- For graph questions, prefer `swarmvault graph query`, `swarmvault graph path`, and `swarmvault graph explain` before broad grep/glob searching.";
const PRE_GRAPH_FIRST_SAVE_BULLET = "- Save high-value answers back into `wiki/outputs/` instead of leaving them only in chat.";

const PRE_GRAPH_FIRST_RULE_BULLETS = SWARMVAULT_RULE_BULLETS.map((bullet) => {
  if (bullet.startsWith("- For code and graph questions")) return PRE_GRAPH_FIRST_BULLET;
  if (bullet.startsWith("- When asked for durable research")) return PRE_GRAPH_FIRST_SAVE_BULLET;
  return bullet;
});

const LEGACY_SWARMVAULT_RULE_BULLETS = PRE_GRAPH_FIRST_RULE_BULLETS.filter((bullet) => !bullet.includes("SWARMVAULT_OUT"));

function buildManagedBlock(target: keyof typeof agentFileKinds): string {
  const heading =
    target === "aider" ? "# SwarmVault Conventions" : target === "copilot" ? "# SwarmVault Repository Instructions" : "# SwarmVault Rules";
  const extra =
    target === "copilot"
      ? [
          "",
          "For architecture, structure, relationship, add/modify/find, or component-location questions, read the graph report first when it exists. Use source files after that when the graph lacks detail, is stale, or you are making a specific edit."
        ]
      : target === "claude"
        ? [
            "",
            'For architecture, structure, where-is, what-calls, or impact questions, query the graph first: `swarmvault graph query "<seed>"` (top matches + inline page excerpt), `swarmvault graph explain "<node>"`, or `swarmvault graph blast <target>` for impact. Avoid `--json` — the plain output is far smaller. Trust the graph answer for orientation; read source files only when you are editing them or the graph lacks the detail you need. Check freshness with `swarmvault graph status` and refresh with `swarmvault graph update` (add `--file <path>` for single files).'
          ]
        : [];
  return [managedStart, heading, "", ...SWARMVAULT_RULE_BULLETS, ...extra, managedEnd, ""].join("\n");
}

function buildSkillFrontmatter(): string {
  const frontmatter = YAML.stringify({
    name: "swarmvault",
    description: "SwarmVault graph-first workflow. Use to read the compiled wiki and query the knowledge graph before broad file search."
  }).trimEnd();
  return ["---", frontmatter, "---"].join("\n");
}

function buildSkillBody(): string {
  return [
    "# SwarmVault",
    "",
    "SwarmVault compiles curated sources in `raw/` into a queryable wiki in `wiki/` and a knowledge graph in `state/graph.json`.",
    "",
    "## Rules",
    "",
    ...SWARMVAULT_RULE_BULLETS,
    "",
    "## Entry points",
    "",
    "- `swarmvault ingest <path>` — register a new source",
    "- `swarmvault compile` — refresh wiki pages and graph",
    '- `swarmvault query "<question>"` — save-first multi-step query',
    "- `swarmvault graph query|path|explain` — deterministic graph traversal",
    "- `swarmvault lint` — wiki health and contradiction checks",
    ""
  ].join("\n");
}

function buildStandaloneSkillFile(): string {
  return `${buildSkillFrontmatter()}\n\n${buildSkillBody()}`;
}

function buildKiroSteeringFile(): string {
  const frontmatter = YAML.stringify({
    inclusion: "always",
    description: "Always-on SwarmVault rules."
  }).trimEnd();
  return ["---", frontmatter, "---", "", "# SwarmVault Rules", "", ...SWARMVAULT_RULE_BULLETS, ""].join("\n");
}

function buildAntigravityRulesFile(ruleBullets = SWARMVAULT_RULE_BULLETS): string {
  const frontmatter = YAML.stringify({
    alwaysApply: true,
    description: "SwarmVault graph-first repository rules."
  }).trimEnd();
  return [
    "---",
    frontmatter,
    "---",
    "",
    "# SwarmVault Rules",
    "",
    ...ruleBullets,
    "",
    "> MCP navigation hint: SwarmVault exposes a local MCP server via `swarmvault mcp`. Wire it into your Antigravity MCP config to query the graph without shelling out."
  ].join("\n");
}

function buildAntigravityWorkflowFile(): string {
  const frontmatter = YAML.stringify({
    command: "swarmvault",
    description: "Compile, query, and lint the SwarmVault vault."
  }).trimEnd();
  return [
    "---",
    frontmatter,
    "---",
    "",
    "# /swarmvault",
    "",
    "Run SwarmVault against the current directory.",
    "",
    "## Steps",
    "",
    "1. If no vault exists, run `swarmvault init`.",
    "2. For new sources, run `swarmvault ingest <path>`.",
    "3. Run `swarmvault compile` to refresh the wiki and graph.",
    "4. For follow-up questions, prefer `swarmvault query`, `swarmvault graph query`, `swarmvault graph path`, `swarmvault graph explain`.",
    "5. Save high-value answers to `wiki/outputs/`.",
    ""
  ].join("\n");
}

function buildKiloCommandFile(): string {
  return [
    "# /swarmvault",
    "",
    "Use SwarmVault's graph-first workflow in the current project.",
    "",
    "1. If no vault exists, run `swarmvault init`.",
    "2. Read `wiki/graph/report.md` before broad source search when it exists.",
    "3. Prefer `swarmvault graph query`, `swarmvault graph path`, and `swarmvault graph explain` for structure questions.",
    "4. Run `swarmvault compile` after adding or refreshing sources.",
    ""
  ].join("\n");
}

function buildKiloPluginFile(): string {
  return [
    "export default async function SwarmVaultPlugin({ project }) {",
    "  return {",
    "    name: 'swarmvault-graph-first',",
    "    async beforeToolUse(event) {",
    "      const toolName = event?.tool?.name ?? event?.toolName ?? '';",
    "      if (!['bash', 'shell', 'terminal', 'search', 'grep', 'glob'].includes(String(toolName).toLowerCase())) return;",
    "      const root = project?.root ?? process.cwd();",
    "      return {",
    "        message: `SwarmVault graph-first: from $" +
      "{root}, answer structure questions with swarmvault graph query/explain/path or swarmvault query instead of broad search; wiki/graph/report.md has the orientation report. Read source files only when editing them or when the graph lacks detail.`",
    "      };",
    "    }",
    "  };",
    "}",
    ""
  ].join("\n");
}

function buildVscodeChatmodeFile(): string {
  const frontmatter = YAML.stringify({
    description: "SwarmVault graph-first workflow for VS Code Copilot Chat.",
    tools: ["codebase", "terminal"]
  }).trimEnd();
  return [
    "---",
    frontmatter,
    "---",
    "",
    "# SwarmVault mode",
    "",
    "You are working inside a SwarmVault vault. Follow these rules before other actions:",
    "",
    "For any question about this repo's architecture, structure, components, relationships, or where/how to add or modify code, first read `wiki/graph/report.md` when it exists. If `SWARMVAULT_OUT` is set, read `$SWARMVAULT_OUT/wiki/graph/report.md` instead.",
    "",
    ...SWARMVAULT_RULE_BULLETS,
    "",
    "Use the terminal tool to run `swarmvault` commands. Prefer graph queries over broad grep/glob. Read source files after the graph when you are modifying/debugging specific code, the graph lacks needed detail, or the graph is stale.",
    ""
  ].join("\n");
}

function buildCursorRule(): string {
  const frontmatter = YAML.stringify({
    description: "SwarmVault graph-first repository instructions.",
    alwaysApply: true
  }).trimEnd();
  return ["---", frontmatter, "---", "", buildManagedBlock("cursor").trimEnd(), ""].join("\n");
}

function supportsAgentHook(agent: AgentType): boolean {
  return agent === "codex" || agent === "claude" || agent === "opencode" || agent === "gemini" || agent === "copilot" || agent === "kilo";
}

function installScope(agent: AgentType, options: InstallAgentOptions = {}): "project" | "user" {
  if (options.scope) return options.scope;
  return agent === "hermes" ? "user" : "project";
}

function primaryTargetPathForAgent(rootDir: string, agent: AgentType, options: InstallAgentOptions = {}): string {
  if (installScope(agent, options) === "user") {
    if (agent === "hermes") return hermesUserSkillPath();
    const target = userSkillTarget(agent);
    if (target) return target;
  }
  switch (agent) {
    case "kilo":
    case "codex":
    case "goose":
    case "pi":
    case "opencode":
      return path.join(rootDir, agentFileKinds.agents);
    case "claude":
      return path.join(rootDir, agentFileKinds.claude);
    case "gemini":
      return path.join(rootDir, agentFileKinds.gemini);
    case "cursor":
      return path.join(rootDir, agentFileKinds.cursor);
    case "aider":
      return path.join(rootDir, agentFileKinds.aider);
    case "copilot":
      return path.join(rootDir, agentFileKinds.copilot);
    case "trae":
      return path.join(rootDir, agentFileKinds.trae);
    case "claw":
      return path.join(rootDir, agentFileKinds.claw);
    case "droid":
      return path.join(rootDir, agentFileKinds.droid);
    case "kiro":
      return path.join(rootDir, agentFileKinds.kiro);
    case "hermes":
      return hermesUserSkillPath();
    case "antigravity":
      return path.join(rootDir, agentFileKinds.antigravityRules);
    case "vscode":
      return path.join(rootDir, agentFileKinds.vscode);
    default: {
      const bundleTarget = skillBundleTarget(rootDir, agent);
      if (bundleTarget) return bundleTarget;
      throw new Error(`Unsupported agent ${String(agent)}`);
    }
  }
}

function hookScriptPathForAgent(rootDir: string, agent: AgentType): string | null {
  switch (agent) {
    case "codex":
      return path.join(rootDir, ".codex", "hooks", "swarmvault-graph-first.js");
    case "claude":
      return path.join(rootDir, ".claude", "hooks", "swarmvault-graph-first.js");
    case "opencode":
      return path.join(rootDir, ".opencode", "plugins", "swarmvault-graph-first.js");
    case "kilo":
      return path.join(rootDir, ".kilo", "plugins", "swarmvault.js");
    case "gemini":
      return path.join(rootDir, ".gemini", "hooks", "swarmvault-graph-first.js");
    case "copilot":
      return path.join(rootDir, ".github", "hooks", "swarmvault-graph-first.js");
    default:
      return null;
  }
}

function hookConfigPathForAgent(rootDir: string, agent: AgentType): string | null {
  switch (agent) {
    case "codex":
      return path.join(rootDir, ".codex", "hooks.json");
    case "claude":
      return path.join(rootDir, ".claude", "settings.json");
    case "gemini":
      return path.join(rootDir, ".gemini", "settings.json");
    case "opencode":
      return path.join(rootDir, ".opencode", "opencode.json");
    case "kilo":
      return path.join(rootDir, ".kilo", "kilo.json");
    case "copilot":
      return path.join(rootDir, ".github", "hooks", "swarmvault-graph-first.json");
    default:
      return null;
  }
}

function targetsForAgent(rootDir: string, agent: AgentType, options: InstallAgentOptions = {}): string[] {
  const scope = installScope(agent, options);
  const targets = [primaryTargetPathForAgent(rootDir, agent, options)];

  if (scope === "user") {
    if (agent === "kilo") {
      targets.push(kiloUserCommandPath());
    }
    if (agent === "hermes") {
      targets.push(path.join(rootDir, agentFileKinds.agents));
    }
    if (agent === "claude" && options.hook) {
      targets.push(claudeUserSettingsPath(), claudeUserHookScriptPath());
    }
    return [...new Set(targets)];
  }

  if (agent === "claude" && options.mcp) {
    targets.push(path.join(rootDir, ".mcp.json"));
  }

  if (options.scope === "project") {
    targets.push(...projectSkillTargets(rootDir, agent));
  }

  if (agent === "copilot") {
    targets.push(path.join(rootDir, agentFileKinds.agents));
  }

  if (agent === "vscode") {
    targets.push(path.join(rootDir, agentFileKinds.copilot));
  }

  if (agent === "aider") {
    targets.push(path.join(rootDir, ".aider.conf.yml"));
  }

  if (agent === "kiro") {
    targets.push(path.join(rootDir, agentFileKinds.kiroSteering));
  }

  if (agent === "hermes") {
    targets.push(path.join(rootDir, agentFileKinds.agents));
  }

  if (agent === "antigravity") {
    targets.push(path.join(rootDir, agentFileKinds.antigravityWorkflow));
  }

  if (agent === "devin") {
    targets.push(path.join(rootDir, agentFileKinds.devinRules));
  }

  if (options.hook && supportsAgentHook(agent)) {
    const configPath = hookConfigPathForAgent(rootDir, agent);
    const scriptPath = hookScriptPathForAgent(rootDir, agent);
    if (configPath) {
      targets.push(configPath);
    }
    if (scriptPath) {
      targets.push(scriptPath);
    }
  }

  return [...new Set(targets)];
}

async function upsertManagedBlock(filePath: string, block: string): Promise<void> {
  const existing = (await fileExists(filePath)) ? await fs.readFile(filePath, "utf8") : "";
  if (!existing) {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, `${block}\n`, "utf8");
    return;
  }

  const startIndex = existing.includes(managedStart) ? existing.indexOf(managedStart) : existing.indexOf(legacyManagedStart);
  const endIndex = existing.includes(managedEnd) ? existing.indexOf(managedEnd) : existing.indexOf(legacyManagedEnd);
  if (startIndex !== -1 && endIndex !== -1) {
    const next = `${existing.slice(0, startIndex)}${block}${existing.slice(endIndex + managedEnd.length)}`;
    await fs.writeFile(filePath, next, "utf8");
    return;
  }

  await fs.writeFile(filePath, `${existing.trimEnd()}\n\n${block}\n`, "utf8");
}

async function writeOwnedFile(filePath: string, content: string, executable = false): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, {
    encoding: "utf8",
    mode: executable ? 0o755 : 0o644
  });
  if (executable) {
    await fs.chmod(filePath, 0o755);
  }
}

async function removeLegacyOwnedFile(filePath: string, ownedContents: string[], warningLabel: string): Promise<string | null> {
  if (!(await fileExists(filePath))) {
    return null;
  }
  const existing = await fs.readFile(filePath, "utf8");
  if (ownedContents.some((content) => content.trim() === existing.trim())) {
    await fs.rm(filePath, { force: true });
    return null;
  }
  return `${warningLabel} already exists at ${filePath}. Left it unchanged because it no longer matches SwarmVault's managed content.`;
}

async function cleanupLegacyAntigravityFiles(rootDir: string): Promise<string[]> {
  const legacyRulesPath = path.join(rootDir, legacyAntigravityFileKinds.antigravityRules);
  const legacyWorkflowPath = path.join(rootDir, legacyAntigravityFileKinds.antigravityWorkflow);
  const warnings = await Promise.all([
    removeLegacyOwnedFile(
      legacyRulesPath,
      [
        buildAntigravityRulesFile(),
        buildAntigravityRulesFile(PRE_GRAPH_FIRST_RULE_BULLETS),
        buildAntigravityRulesFile(LEGACY_SWARMVAULT_RULE_BULLETS)
      ],
      "Legacy Antigravity rules file"
    ),
    removeLegacyOwnedFile(legacyWorkflowPath, [buildAntigravityWorkflowFile()], "Legacy Antigravity workflow file")
  ]);
  return warnings.filter((warning): warning is string => Boolean(warning));
}

async function readJsonWithWarnings<T extends object>(filePath: string, fallback: T, label: string): Promise<JsonWarningResult<T>> {
  if (!(await fileExists(filePath))) {
    return { data: fallback, warnings: [] };
  }
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as T;
    return { data: parsed, warnings: [] };
  } catch {
    return {
      data: fallback,
      warnings: [`Could not parse ${label}. Left the existing file unchanged.`]
    };
  }
}

function stripJsonComments(source: string): string {
  let output = "";
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index] ?? "";
    const next = source[index + 1] ?? "";

    if (inLineComment) {
      if (current === "\n" || current === "\r") {
        inLineComment = false;
        output += current;
      }
      continue;
    }

    if (inBlockComment) {
      if (current === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      } else if (current === "\n" || current === "\r") {
        output += current;
      }
      continue;
    }

    if (inString) {
      output += current;
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === '"') {
        inString = false;
      }
      continue;
    }

    if (current === '"') {
      inString = true;
      output += current;
      continue;
    }

    if (current === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (current === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    output += current;
  }

  return output;
}

async function readJsonOrJsoncWithWarnings<T extends object>(
  jsonPath: string,
  jsoncPath: string,
  fallback: T,
  label: string
): Promise<JsonWarningResult<T>> {
  if (await fileExists(jsonPath)) {
    return readJsonWithWarnings(jsonPath, fallback, label);
  }
  if (!(await fileExists(jsoncPath))) {
    return { data: fallback, warnings: [] };
  }
  try {
    const parsed = JSON.parse(stripJsonComments(await fs.readFile(jsoncPath, "utf8"))) as T;
    return { data: parsed, warnings: [] };
  } catch {
    return {
      data: fallback,
      warnings: [`Could not parse ${label}. Left the existing file unchanged.`]
    };
  }
}

function withPluginEntry(config: PluginConfig, pluginEntry: string): PluginConfig {
  const existing = Array.isArray(config.plugins) ? config.plugins.filter((entry): entry is string => typeof entry === "string") : [];
  return {
    ...config,
    plugins: existing.includes(pluginEntry) ? existing : [...existing, pluginEntry]
  };
}

function isSwarmvaultClaudeEntry(entry: ClaudeHookEntry): boolean {
  return JSON.stringify(entry).includes("swarmvault-graph-first.js");
}

/**
 * Merge the SwarmVault hook entries into a Claude settings file. Existing
 * SwarmVault-owned entries whose matcher or command no longer matches the
 * current layout are migrated (removed and re-added); user-owned entries are
 * never touched.
 */
function mergeClaudeHookSettings(settings: ClaudeSettings, scriptCommandPath: string): ClaudeSettings {
  const sessionCommand = `node "${scriptCommandPath}" session-start`;
  const preToolUseCommand = `node "${scriptCommandPath}" pre-tool-use`;
  const postEditCommand = `node "${scriptCommandPath}" post-edit`;

  const hooks = settings.hooks ?? {};
  const keepForeign = (entries: ClaudeHookEntry[] | undefined) => (entries ?? []).filter((entry) => !isSwarmvaultClaudeEntry(entry));

  const sessionStart = keepForeign(hooks.SessionStart);
  for (const matcher of claudeSessionMatchers) {
    sessionStart.push({ matcher, hooks: [{ type: "command", command: sessionCommand }] });
  }

  const preToolUse = keepForeign(hooks.PreToolUse);
  for (const matcher of claudePreToolUseMatchers) {
    preToolUse.push({ matcher, hooks: [{ type: "command", command: preToolUseCommand }] });
  }

  const postToolUse = keepForeign(hooks.PostToolUse);
  postToolUse.push({ matcher: claudePostEditMatcher, hooks: [{ type: "command", command: postEditCommand }] });

  return { ...settings, hooks: { ...hooks, SessionStart: sessionStart, PreToolUse: preToolUse, PostToolUse: postToolUse } };
}

async function installClaudeHook(rootDir: string): Promise<{ path: string; warnings: string[] }> {
  const settingsPath = path.join(rootDir, ".claude", "settings.json");
  const scriptPath = path.join(rootDir, ".claude", "hooks", "swarmvault-graph-first.js");
  await writeOwnedFile(scriptPath, await readBuiltHook("claude.js"), true);
  await ensureDir(path.dirname(settingsPath));

  const { data: settings, warnings } = await readJsonWithWarnings<ClaudeSettings>(settingsPath, {}, ".claude/settings.json");
  if (warnings.length > 0 && (await fileExists(settingsPath))) {
    return { path: settingsPath, warnings };
  }

  const merged = mergeClaudeHookSettings(settings, "$CLAUDE_PROJECT_DIR/.claude/hooks/swarmvault-graph-first.js");
  await fs.writeFile(settingsPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return { path: settingsPath, warnings: [] };
}

function claudeUserSettingsPath(): string {
  return path.join(os.homedir(), ".claude", "settings.json");
}

function claudeUserHookScriptPath(): string {
  return path.join(os.homedir(), ".claude", "hooks", "swarmvault-graph-first.js");
}

/**
 * User-scope hook install into ~/.claude. Safe globally: the hook script
 * no-ops in any cwd without a compiled `wiki/graph/report.md`.
 */
async function installClaudeUserHook(): Promise<{ paths: string[]; warnings: string[] }> {
  const settingsPath = claudeUserSettingsPath();
  const scriptPath = claudeUserHookScriptPath();
  await writeOwnedFile(scriptPath, await readBuiltHook("claude.js"), true);
  await ensureDir(path.dirname(settingsPath));

  const { data: settings, warnings } = await readJsonWithWarnings<ClaudeSettings>(settingsPath, {}, "~/.claude/settings.json");
  if (warnings.length > 0 && (await fileExists(settingsPath))) {
    return { paths: [settingsPath, scriptPath], warnings };
  }

  const merged = mergeClaudeHookSettings(settings, "$HOME/.claude/hooks/swarmvault-graph-first.js");
  await fs.writeFile(settingsPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return { paths: [settingsPath, scriptPath], warnings: [] };
}

const ARTIFACT_DIRS = ["raw", "wiki", "state", "agent", "inbox"];
const GITIGNORE_HYGIENE_MARKER = "# swarmvault artifacts";

/**
 * Keep vault artifacts from breaking the host project: stored source copies
 * under raw/ are real .ts/.js files, so they must be excluded from the
 * project's git tracking, TypeScript program, and linters. Returns notices
 * describing what was changed plus warnings for what needs manual edits.
 */
async function ensureHostProjectHygiene(rootDir: string): Promise<{ notices: string[]; warnings: string[] }> {
  const notices: string[] = [];
  const warnings: string[] = [];

  if (process.env.SWARMVAULT_OUT?.trim()) {
    return { notices, warnings };
  }

  // .gitignore managed block (git repos only).
  if (await fileExists(path.join(rootDir, ".git"))) {
    const gitignorePath = path.join(rootDir, ".gitignore");
    const existing = (await fileExists(gitignorePath)) ? await fs.readFile(gitignorePath, "utf8") : "";
    if (!existing.includes(GITIGNORE_HYGIENE_MARKER)) {
      const block = `\n${GITIGNORE_HYGIENE_MARKER}\n${ARTIFACT_DIRS.map((dir) => `${dir}/`).join("\n")}\nswarmvault.config.json\nswarmvault.schema.md\n`;
      await fs.writeFile(gitignorePath, `${existing.replace(/\n*$/, "\n")}${block}`, "utf8");
      notices.push("Added SwarmVault artifact directories to .gitignore.");
    }
  }

  // tsconfig.json exclude patch (strict JSON only — JSONC with comments is
  // left untouched so user comments are never destroyed).
  const tsconfigPath = path.join(rootDir, "tsconfig.json");
  if (await fileExists(tsconfigPath)) {
    const source = await fs.readFile(tsconfigPath, "utf8");
    let parsed: Record<string, unknown> | null = null;
    try {
      const candidate = JSON.parse(source);
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
        parsed = candidate as Record<string, unknown>;
      }
    } catch {
      parsed = null;
    }
    if (parsed) {
      const exclude = Array.isArray(parsed.exclude) ? parsed.exclude.filter((entry): entry is string => typeof entry === "string") : [];
      const missing = ARTIFACT_DIRS.filter(
        (dir) => !exclude.includes(dir) && !exclude.includes(`${dir}/`) && !exclude.includes(`./${dir}`)
      );
      if (missing.length > 0) {
        parsed.exclude = [...exclude, ...missing];
        await fs.writeFile(tsconfigPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
        notices.push(`Excluded SwarmVault artifact directories from tsconfig.json (${missing.join(", ")}).`);
      }
    } else {
      let parsesAsJsonc = false;
      try {
        JSON.parse(stripJsonComments(source));
        parsesAsJsonc = true;
      } catch {
        parsesAsJsonc = false;
      }
      if (parsesAsJsonc) {
        warnings.push(
          `tsconfig.json contains comments, so it was left unchanged — add ${ARTIFACT_DIRS.join(", ")} to its "exclude" array manually so vault artifacts are not type-checked.`
        );
      }
    }
  }

  // Linters: detection-only advisory; JS config files are never edited.
  const eslintConfigs = ["eslint.config.mjs", "eslint.config.js", "eslint.config.ts", ".eslintrc.json", ".eslintrc.js"];
  for (const candidate of eslintConfigs) {
    if (await fileExists(path.join(rootDir, candidate))) {
      const content = await fs.readFile(path.join(rootDir, candidate), "utf8");
      if (
        !ARTIFACT_DIRS.some((dir) => content.includes(`"${dir}/**"`) || content.includes(`'${dir}/**'`) || content.includes(`"${dir}"`))
      ) {
        warnings.push(
          `Add SwarmVault artifact directories (${ARTIFACT_DIRS.map((dir) => `${dir}/**`).join(", ")}) to the ignore list in ${candidate} so stored source copies are not linted.`
        );
      }
      break;
    }
  }

  return { notices, warnings };
}

/**
 * Persist the graph-first hook mode into swarmvault.config.json so the
 * installed hooks pick it up. Enforcement ("deny") is an explicit install-time
 * opt-in; without it the hooks stay advisory ("context").
 */
async function persistGraphFirstMode(rootDir: string, mode: "deny" | "context" | "off"): Promise<{ warnings: string[] }> {
  const configPath = path.join(rootDir, "swarmvault.config.json");
  if (!(await fileExists(configPath))) {
    return { warnings: [`No swarmvault.config.json at ${rootDir}; run swarmvault init or set hooks.graphFirst manually.`] };
  }
  try {
    const parsed = JSON.parse(await fs.readFile(configPath, "utf8")) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("config is not an object");
    }
    const hooks =
      parsed.hooks && typeof parsed.hooks === "object" && !Array.isArray(parsed.hooks) ? (parsed.hooks as Record<string, unknown>) : {};
    hooks.graphFirst = mode;
    parsed.hooks = hooks;
    await fs.writeFile(configPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    return { warnings: [] };
  } catch {
    return { warnings: ["Could not update swarmvault.config.json; set hooks.graphFirst manually."] };
  }
}

/** Register the SwarmVault MCP server in the project's `.mcp.json`. */
async function installClaudeMcp(rootDir: string): Promise<{ path: string; warnings: string[] }> {
  const mcpConfigPath = path.join(rootDir, ".mcp.json");
  const { data: config, warnings } = await readJsonWithWarnings<McpConfig>(mcpConfigPath, {}, ".mcp.json");
  if (warnings.length > 0 && (await fileExists(mcpConfigPath))) {
    return { path: mcpConfigPath, warnings };
  }
  const mcpServers = config.mcpServers ?? {};
  if (!mcpServers.swarmvault) {
    mcpServers.swarmvault = { command: "swarmvault", args: ["mcp"] };
  }
  await writeOwnedFile(mcpConfigPath, `${JSON.stringify({ ...config, mcpServers }, null, 2)}\n`);
  return { path: mcpConfigPath, warnings: [] };
}

async function installGeminiHook(rootDir: string): Promise<{ paths: string[]; warnings: string[] }> {
  const settingsPath = path.join(rootDir, ".gemini", "settings.json");
  const scriptPath = path.join(rootDir, ".gemini", "hooks", "swarmvault-graph-first.js");
  await writeOwnedFile(scriptPath, await readBuiltHook("gemini.js"), true);

  const { data: settings, warnings } = await readJsonWithWarnings<GeminiSettings>(settingsPath, {}, ".gemini/settings.json");
  if (warnings.length > 0 && (await fileExists(settingsPath))) {
    return { paths: [settingsPath, scriptPath], warnings };
  }

  const hooks = settings.hooks ?? {};
  const sessionStart = hooks.SessionStart ?? [];
  const beforeTool = hooks.BeforeTool ?? [];
  const sessionCommand = "node .gemini/hooks/swarmvault-graph-first.js session-start";
  const beforeToolCommand = "node .gemini/hooks/swarmvault-graph-first.js before-tool";

  if (
    !sessionStart.some((entry) => entry.matcher === geminiSessionMatcher && JSON.stringify(entry).includes("swarmvault-graph-first.js"))
  ) {
    sessionStart.push({
      matcher: geminiSessionMatcher,
      hooks: [{ name: "swarmvault-graph-first", type: "command", command: sessionCommand }]
    });
  }

  if (!beforeTool.some((entry) => entry.matcher === geminiSearchMatcher && JSON.stringify(entry).includes("swarmvault-graph-first.js"))) {
    beforeTool.push({
      matcher: geminiSearchMatcher,
      hooks: [{ name: "swarmvault-graph-first", type: "command", command: beforeToolCommand }]
    });
  }

  settings.hooks = {
    ...hooks,
    SessionStart: sessionStart,
    BeforeTool: beforeTool
  };

  await writeOwnedFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  return { paths: [settingsPath, scriptPath], warnings: [] };
}

async function installCodexHook(rootDir: string): Promise<{ paths: string[]; warnings: string[] }> {
  const settingsPath = path.join(rootDir, ".codex", "hooks.json");
  const scriptPath = path.join(rootDir, ".codex", "hooks", "swarmvault-graph-first.js");
  await writeOwnedFile(scriptPath, await readBuiltHook("codex.js"), true);

  const { data: settings, warnings } = await readJsonWithWarnings<CodexSettings>(settingsPath, {}, ".codex/hooks.json");
  if (warnings.length > 0 && (await fileExists(settingsPath))) {
    return { paths: [settingsPath, scriptPath], warnings };
  }

  const hooks = settings.hooks ?? {};
  const sessionStart = hooks.SessionStart ?? [];
  const preToolUse = hooks.PreToolUse ?? [];
  const sessionCommand = "node .codex/hooks/swarmvault-graph-first.js session-start";
  const preToolUseCommand = "node .codex/hooks/swarmvault-graph-first.js pre-tool-use";

  if (!sessionStart.some((entry) => JSON.stringify(entry).includes("swarmvault-graph-first.js"))) {
    sessionStart.push({
      hooks: [{ type: "command", command: sessionCommand }]
    });
  }

  if (!preToolUse.some((entry) => entry.matcher === codexSearchMatcher && JSON.stringify(entry).includes("swarmvault-graph-first.js"))) {
    preToolUse.push({
      matcher: codexSearchMatcher,
      hooks: [{ type: "command", command: preToolUseCommand }]
    });
  }

  settings.hooks = {
    ...hooks,
    SessionStart: sessionStart,
    PreToolUse: preToolUse
  };

  await writeOwnedFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  return { paths: [settingsPath, scriptPath], warnings: [] };
}

async function mergeAiderConfig(rootDir: string): Promise<{ path: string; warnings: string[] }> {
  const configPath = path.join(rootDir, ".aider.conf.yml");
  const readTarget = "CONVENTIONS.md";
  if (!(await fileExists(configPath))) {
    const document = new YAML.Document();
    document.set("read", [readTarget]);
    await writeOwnedFile(configPath, `${document.toString()}`);
    return { path: configPath, warnings: [] };
  }

  try {
    const source = await fs.readFile(configPath, "utf8");
    const document = YAML.parseDocument(source);
    if (document.errors.length > 0) {
      return {
        path: configPath,
        warnings: ["Could not parse .aider.conf.yml. Left the existing file unchanged; add `read: CONVENTIONS.md` manually."]
      };
    }
    const currentRead = document.get("read", true);
    const values =
      typeof currentRead === "string"
        ? [currentRead]
        : Array.isArray(currentRead)
          ? currentRead.filter((item): item is string => typeof item === "string")
          : [];
    if (!values.includes(readTarget)) {
      document.set("read", [...values, readTarget]);
      await writeOwnedFile(configPath, `${document.toString()}`);
    }
    return { path: configPath, warnings: [] };
  } catch {
    return {
      path: configPath,
      warnings: ["Could not parse .aider.conf.yml. Left the existing file unchanged; add `read: CONVENTIONS.md` manually."]
    };
  }
}

async function installCopilotHook(rootDir: string): Promise<{ paths: string[]; warnings: string[] }> {
  const hooksDir = path.join(rootDir, ".github", "hooks");
  const scriptPath = path.join(hooksDir, "swarmvault-graph-first.js");
  const configPath = path.join(hooksDir, "swarmvault-graph-first.json");
  await writeOwnedFile(scriptPath, await readBuiltHook("copilot.js"), true);

  const config: CopilotHookConfig = {
    version: copilotHookVersion,
    hooks: {
      sessionStart: [
        {
          type: "command",
          bash: "node .github/hooks/swarmvault-graph-first.js session-start",
          powershell: "node .github/hooks/swarmvault-graph-first.js session-start",
          cwd: ".",
          timeoutSec: 10
        }
      ],
      preToolUse: [
        {
          matcher: "glob|grep",
          type: "command",
          bash: "node .github/hooks/swarmvault-graph-first.js pre-tool-use",
          powershell: "node .github/hooks/swarmvault-graph-first.js pre-tool-use",
          cwd: ".",
          timeoutSec: 10
        }
      ]
    }
  };

  await writeOwnedFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return { paths: [configPath, scriptPath], warnings: [] };
}

async function installOpenCodeHook(rootDir: string): Promise<{ paths: string[]; warnings: string[] }> {
  const pluginPath = path.join(rootDir, ".opencode", "plugins", "swarmvault-graph-first.js");
  const configPath = path.join(rootDir, ".opencode", "opencode.json");
  await writeOwnedFile(pluginPath, await readBuiltHook("opencode.js"));
  const { data: config, warnings } = await readJsonWithWarnings<PluginConfig>(configPath, {}, ".opencode/opencode.json");
  if (warnings.length > 0 && (await fileExists(configPath))) {
    return { paths: [pluginPath, configPath], warnings };
  }
  await writeOwnedFile(configPath, `${JSON.stringify(withPluginEntry(config, "./plugins/swarmvault-graph-first.js"), null, 2)}\n`);
  return { paths: [pluginPath, configPath], warnings: [] };
}

async function installKiloHook(rootDir: string): Promise<{ paths: string[]; warnings: string[] }> {
  const pluginPath = path.join(rootDir, ".kilo", "plugins", "swarmvault.js");
  const configPath = path.join(rootDir, ".kilo", "kilo.json");
  const jsoncPath = path.join(rootDir, ".kilo", "kilo.jsonc");
  await writeOwnedFile(pluginPath, buildKiloPluginFile());
  const { data: config, warnings } = await readJsonOrJsoncWithWarnings<PluginConfig>(
    configPath,
    jsoncPath,
    {},
    ".kilo/kilo.json or .kilo/kilo.jsonc"
  );
  if (warnings.length > 0 && ((await fileExists(configPath)) || (await fileExists(jsoncPath)))) {
    return { paths: [pluginPath, configPath], warnings };
  }
  await writeOwnedFile(configPath, `${JSON.stringify(withPluginEntry(config, "./plugins/swarmvault.js"), null, 2)}\n`);
  return { paths: [pluginPath, configPath], warnings: [] };
}

function stableKeyForAgent(rootDir: string, agent: AgentType): string {
  if (agent === "codex" || agent === "goose" || agent === "pi") {
    return `shared:${path.join(rootDir, agentFileKinds.agents)}`;
  }
  return `${agent}:${crypto
    .createHash("sha1")
    .update(targetsForAgent(rootDir, agent, { hook: supportsAgentHook(agent) }).join("\n"))
    .digest("hex")}`;
}

export async function installAgent(rootDir: string, agent: AgentType, options: InstallAgentOptions = {}): Promise<InstallAgentResult> {
  await initWorkspace(rootDir);
  const scope = installScope(agent, options);
  const target = primaryTargetPathForAgent(rootDir, agent, options);
  const warnings: string[] = [];

  if (scope === "user") {
    if (agent === "hermes") {
      await upsertManagedBlock(path.join(rootDir, agentFileKinds.agents), buildManagedBlock("agents"));
      await writeOwnedFile(hermesUserSkillPath(), buildStandaloneSkillFile());
    } else {
      const userTarget = userSkillTarget(agent);
      if (!userTarget) {
        throw new Error(`User-scope install is not supported for agent ${String(agent)}`);
      }
      await writeOwnedFile(userTarget, buildStandaloneSkillFile());
      if (agent === "kilo") {
        await writeOwnedFile(kiloUserCommandPath(), buildKiloCommandFile());
      }
      if (agent === "claude" && options.hook) {
        const result = await installClaudeUserHook();
        warnings.push(...result.warnings);
      }
    }
    if (options.graphFirst) {
      const result = await persistGraphFirstMode(rootDir, options.graphFirst);
      warnings.push(...result.warnings);
    }
    const targets = targetsForAgent(rootDir, agent, options);
    return warnings.length > 0 ? { agent, target, targets, warnings } : { agent, target, targets };
  }

  switch (agent) {
    case "kilo":
    case "codex":
    case "goose":
    case "pi":
    case "opencode":
      await upsertManagedBlock(path.join(rootDir, agentFileKinds.agents), buildManagedBlock("agents"));
      break;
    case "claude":
      await upsertManagedBlock(target, buildManagedBlock("claude"));
      break;
    case "gemini":
      await upsertManagedBlock(target, buildManagedBlock("gemini"));
      break;
    case "cursor":
      await writeOwnedFile(target, buildCursorRule());
      break;
    case "aider":
      await upsertManagedBlock(target, buildManagedBlock("aider"));
      break;
    case "copilot":
      await upsertManagedBlock(path.join(rootDir, agentFileKinds.agents), buildManagedBlock("agents"));
      await upsertManagedBlock(target, buildManagedBlock("copilot"));
      break;
    case "trae":
      await writeOwnedFile(target, buildManagedBlock("trae"));
      break;
    case "claw":
      await writeOwnedFile(target, buildManagedBlock("claw"));
      break;
    case "droid":
      await writeOwnedFile(target, buildManagedBlock("droid"));
      break;
    case "kiro":
      await writeOwnedFile(target, buildStandaloneSkillFile());
      await writeOwnedFile(path.join(rootDir, agentFileKinds.kiroSteering), buildKiroSteeringFile());
      break;
    case "hermes":
      await upsertManagedBlock(path.join(rootDir, agentFileKinds.agents), buildManagedBlock("agents"));
      await writeOwnedFile(hermesUserSkillPath(), buildStandaloneSkillFile());
      break;
    case "antigravity":
      await writeOwnedFile(target, buildAntigravityRulesFile());
      await writeOwnedFile(path.join(rootDir, agentFileKinds.antigravityWorkflow), buildAntigravityWorkflowFile());
      warnings.push(...(await cleanupLegacyAntigravityFiles(rootDir)));
      break;
    case "vscode":
      await writeOwnedFile(target, buildVscodeChatmodeFile());
      await upsertManagedBlock(path.join(rootDir, agentFileKinds.copilot), buildManagedBlock("copilot"));
      break;
    default: {
      if (SKILL_BUNDLE_AGENTS[agent]) {
        await writeOwnedFile(target, buildStandaloneSkillFile());
        break;
      }
      throw new Error(`Unsupported agent ${String(agent)}`);
    }
  }

  if (agent === "aider") {
    const aiderResult = await mergeAiderConfig(rootDir);
    warnings.push(...aiderResult.warnings);
  }

  if (options.scope === "project") {
    for (const skillTarget of projectSkillTargets(rootDir, agent)) {
      await writeOwnedFile(skillTarget, buildStandaloneSkillFile());
    }
  }

  if (agent === "devin") {
    await writeOwnedFile(path.join(rootDir, agentFileKinds.devinRules), buildManagedBlock("devinRules"));
  }

  if (options.hook && supportsAgentHook(agent)) {
    if (agent === "codex") {
      const result = await installCodexHook(rootDir);
      warnings.push(...result.warnings);
    }
    if (agent === "claude") {
      const result = await installClaudeHook(rootDir);
      warnings.push(...result.warnings);
    }
    if (agent === "opencode") {
      const result = await installOpenCodeHook(rootDir);
      warnings.push(...result.warnings);
    }
    if (agent === "kilo") {
      const result = await installKiloHook(rootDir);
      warnings.push(...result.warnings);
    }
    if (agent === "gemini") {
      const result = await installGeminiHook(rootDir);
      warnings.push(...result.warnings);
    }
    if (agent === "copilot") {
      const result = await installCopilotHook(rootDir);
      warnings.push(...result.warnings);
    }
  }

  if (options.mcp && agent === "claude") {
    const result = await installClaudeMcp(rootDir);
    warnings.push(...result.warnings);
  }

  if (options.graphFirst) {
    const result = await persistGraphFirstMode(rootDir, options.graphFirst);
    warnings.push(...result.warnings);
  }

  const hygiene = await ensureHostProjectHygiene(rootDir);
  warnings.push(...hygiene.warnings);

  const targets = targetsForAgent(rootDir, agent, options);
  const base: InstallAgentResult = { agent, target, targets };
  if (hygiene.notices.length > 0) {
    base.notices = hygiene.notices;
  }
  return warnings.length > 0 ? { ...base, warnings } : base;
}

export async function getAgentInstallStatus(
  rootDir: string,
  agent: AgentType,
  options: InstallAgentOptions = {}
): Promise<AgentInstallStatus> {
  if (process.env.USE_GO_PORT === "true") {
    return runGoSidecar("agents", { action: "getAgentInstallStatus", args: { rootDir, agent, options } });
  }
  const target = primaryTargetPathForAgent(rootDir, agent, options);
  const targets = targetsForAgent(rootDir, agent, options);
  const targetStatuses = await Promise.all(
    targets.map(async (targetPath) => ({
      path: targetPath,
      exists: await fileExists(targetPath)
    }))
  );
  return {
    agent,
    scope: installScope(agent, options),
    hook: options.hook ?? false,
    target,
    targets: targetStatuses,
    installed: targetStatuses.length > 0 && targetStatuses.every((entry) => entry.exists)
  };
}

export async function installConfiguredAgents(rootDir: string): Promise<InstallAgentResult[]> {
  const { config } = await initWorkspace(rootDir);
  const dedupedAgents = new Map<string, AgentType>();

  for (const agent of config.agents) {
    const key = stableKeyForAgent(rootDir, agent);
    if (!dedupedAgents.has(key)) {
      dedupedAgents.set(key, agent);
    }
  }

  return Promise.all(
    [...dedupedAgents.values()].map((agent) =>
      installAgent(rootDir, agent, {
        hook: supportsAgentHook(agent)
      })
    )
  );
}
