// TODO: Port model-specific hook logic and state handling to Go.
// Standalone Codex hook script. Bundled by tsup into
// dist/hooks/codex.js and installed into user projects as
// `.codex/hooks/swarmvault-graph-first.js`.

import {
  buildDenyReason,
  buildGraphFirstNote,
  collectCandidatePaths,
  hasReport,
  hasSeenReport,
  isBroadSearchInput,
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

const AGENT_KEY = "codex";

function emit(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function note(message: string): { priority: "IMPORTANT"; message: string } {
  return {
    priority: "IMPORTANT",
    message
  };
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
    emit(note(buildGraphFirstNote(await readWatchStaleness(cwd))));
    process.exit(0);
  }

  if (collectCandidatePaths(input).some((value) => isReportPath(value, cwd))) {
    await markReportRead(cwd, AGENT_KEY);
    emit({});
    process.exit(0);
  }

  const graphFirstMode = await resolveGraphFirstMode(cwd);
  if (
    graphFirstMode !== "off" &&
    isBroadSearchInput(input) &&
    !isVaultArtifactSearch(input, cwd) &&
    !(await isNarrowSearch(input)) &&
    !(await hasSeenReport(cwd, AGENT_KEY))
  ) {
    await markReportRead(cwd, AGENT_KEY);
    emit(note(buildDenyReason(resolveToolName(input), input)));
    process.exit(0);
  }

  emit({});
}

await main();
