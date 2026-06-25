// TODO: Port model-specific hook logic and state handling to Go. | Porting Priority: MEDIUM-HIGH (Near-leaf, Depth: 1/10)
// Standalone Claude Code hook script. Bundled by tsup into
// dist/hooks/claude.js and installed into user projects as
// `.claude/hooks/swarmvault-graph-first.js`. Must not import from engine
// code — tsup inlines only the shared marker-state helpers.

import { spawn } from "node:child_process";
import {
  buildDenyReason,
  buildGraphFirstNote,
  collectCandidatePaths,
  collectEditedFilePaths,
  hasFlag,
  hasReport,
  hasSeenReport,
  isBroadSearchInput,
  isNarrowSearch,
  isReportPath,
  isVaultArtifactSearch,
  markFlag,
  markReportRead,
  readHookInput,
  readWatchStaleness,
  resetSession,
  resolveGraphFirstMode,
  resolveInputCwd,
  resolveToolName
} from "./marker-state.js";

const AGENT_KEY = "claude";

function emit(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function denyFlagName(toolName: string): string {
  return `deny-search-${(toolName || "unknown").toLowerCase()}`;
}

async function handleSessionStart(cwd: string): Promise<void> {
  await resetSession(cwd, AGENT_KEY);
  const staleness = await readWatchStaleness(cwd);
  emit({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: buildGraphFirstNote(staleness)
    }
  });
}

async function handlePostEdit(cwd: string, input: unknown): Promise<void> {
  const editedPaths = collectEditedFilePaths(input, cwd);
  if (editedPaths.length > 0) {
    try {
      const child = spawn("swarmvault", ["graph", "update", ...editedPaths.flatMap((p) => ["--file", p]), "--json"], {
        cwd,
        detached: true,
        stdio: "ignore"
      });
      child.unref();
    } catch {
      // The CLI not being on PATH must never break the agent's edit loop.
    }
  }
  emit({});
}

async function handlePreToolUse(cwd: string, input: unknown): Promise<void> {
  if (collectCandidatePaths(input).some((value) => isReportPath(value, cwd))) {
    await markReportRead(cwd, AGENT_KEY);
    emit({});
    return;
  }

  const mode = await resolveGraphFirstMode(cwd);
  if (mode === "off" || !isBroadSearchInput(input)) {
    emit({});
    return;
  }

  if (isVaultArtifactSearch(input, cwd) || (await isNarrowSearch(input))) {
    emit({});
    return;
  }

  const toolName = resolveToolName(input);
  const flag = denyFlagName(toolName);
  if (mode === "deny" && !(await hasFlag(cwd, AGENT_KEY, flag))) {
    await markFlag(cwd, AGENT_KEY, flag);
    emit({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: buildDenyReason(toolName, input)
      }
    });
    return;
  }

  if (!(await hasSeenReport(cwd, AGENT_KEY))) {
    await markReportRead(cwd, AGENT_KEY);
    emit({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        additionalContext: buildDenyReason(toolName, input)
      }
    });
    return;
  }

  emit({});
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "";
  const input = await readHookInput();
  const cwd = resolveInputCwd(input);

  // "off" disables the whole integration, not just search redirection.
  if (!(await hasReport(cwd)) || (await resolveGraphFirstMode(cwd)) === "off") {
    emit({});
    process.exit(0);
  }

  if (mode === "session-start") {
    await handleSessionStart(cwd);
    process.exit(0);
  }

  if (mode === "post-edit") {
    await handlePostEdit(cwd, input);
    process.exit(0);
  }

  await handlePreToolUse(cwd, input);
  process.exit(0);
}

await main();
