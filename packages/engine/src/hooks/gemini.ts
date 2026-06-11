// Standalone Gemini CLI hook script. Bundled by tsup into
// dist/hooks/gemini.js and installed into user projects as
// `.gemini/hooks/swarmvault-graph-first.js`.

import {
  buildDenyReason,
  buildGraphFirstNote,
  collectCandidatePaths,
  hasReport,
  hasSeenReport,
  isBroadSearchTool,
  isNarrowSearch,
  isReportPath,
  isVaultArtifactSearch,
  markReportRead,
  readHookInput,
  readWatchStaleness,
  resetSession,
  resolveGraphFirstMode,
  resolveInputCwd,
  resolveToolName
} from "./marker-state.js";

const AGENT_KEY = "gemini";

function emit(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
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
    const graphFirstNote = buildGraphFirstNote(await readWatchStaleness(cwd));
    emit({
      systemMessage: graphFirstNote,
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: graphFirstNote
      }
    });
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
    graphFirstMode !== "off" &&
    isBroadSearchTool(toolName) &&
    !isVaultArtifactSearch(input, cwd) &&
    !(await isNarrowSearch(input)) &&
    !(await hasSeenReport(cwd, AGENT_KEY))
  ) {
    await markReportRead(cwd, AGENT_KEY);
    emit({ systemMessage: buildDenyReason(toolName, input) });
    process.exit(0);
  }

  emit({});
}

await main();
