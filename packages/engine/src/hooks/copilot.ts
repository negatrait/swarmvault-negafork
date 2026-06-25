// TODO: Port model-specific hook logic and state handling to Go. | Porting Priority: MEDIUM-HIGH (Near-leaf, Depth: 1/10)
// Standalone GitHub Copilot hook script. Bundled by tsup into
// dist/hooks/copilot.js and installed into user projects as
// `.github/hooks/swarmvault-graph-first.js`.

import {
  buildDenyReason,
  collectCandidatePaths,
  hasReport,
  hasSeenReport,
  isBroadSearchTool,
  isNarrowSearch,
  isReportPath,
  isVaultArtifactSearch,
  markReportRead,
  readHookInput,
  resetSession,
  resolveGraphFirstMode,
  resolveInputCwd,
  resolveToolName
} from "./marker-state.js";

const AGENT_KEY = "copilot";

function emit(value: unknown): void {
  if (value !== undefined) {
    process.stdout.write(`${JSON.stringify(value)}\n`);
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "";
  const input = await readHookInput();
  const cwd = resolveInputCwd(input);

  if (!(await hasReport(cwd))) {
    emit({});
    process.exit(0);
  }

  if (mode === "session-start") {
    await resetSession(cwd, AGENT_KEY);
    emit({});
    process.exit(0);
  }

  const toolName = resolveToolName(input);
  if (collectCandidatePaths(input).some((value) => isReportPath(value, cwd))) {
    await markReportRead(cwd, AGENT_KEY);
    emit({});
    process.exit(0);
  }

  const graphFirstMode = await resolveGraphFirstMode(cwd);
  if (
    graphFirstMode === "deny" &&
    isBroadSearchTool(toolName) &&
    !isVaultArtifactSearch(input, cwd) &&
    !(await isNarrowSearch(input)) &&
    !(await hasSeenReport(cwd, AGENT_KEY))
  ) {
    await markReportRead(cwd, AGENT_KEY);
    emit({
      permissionDecision: "deny",
      permissionDecisionReason: buildDenyReason(toolName, input)
    });
    process.exit(0);
  }

  emit({});
}

await main();
