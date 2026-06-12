import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const hookPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "hooks", "claude.js");

interface HookRunResult {
  output: Record<string, unknown>;
  raw: string;
}

async function runHook(mode: string, input: Record<string, unknown>, env: Record<string, string> = {}): Promise<HookRunResult> {
  const child = execFileAsync(process.execPath, [hookPath, mode], {
    env: { ...process.env, ...env }
  });
  child.child.stdin?.write(JSON.stringify(input));
  child.child.stdin?.end();
  const { stdout } = await child;
  const raw = stdout.trim();
  return { output: raw ? (JSON.parse(raw) as Record<string, unknown>) : {}, raw };
}

function hookOutput(result: HookRunResult): Record<string, unknown> {
  return (result.output.hookSpecificOutput ?? {}) as Record<string, unknown>;
}

describe("claude graph-first hook", () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await fs.mkdtemp(path.join(os.tmpdir(), "swarmvault-claude-hook-"));
    await fs.mkdir(path.join(workspace, "wiki", "graph"), { recursive: true });
    await fs.writeFile(path.join(workspace, "wiki", "graph", "report.md"), "# Graph report\n", "utf8");
    // Enforcement is opt-in; these fixtures opt in the way `install
    // --graph-first` does so the deny flow can be exercised.
    await fs.writeFile(path.join(workspace, "swarmvault.config.json"), `${JSON.stringify({ hooks: { graphFirst: "deny" } })}\n`, "utf8");
  });

  afterEach(async () => {
    await fs.rm(workspace, { recursive: true, force: true });
  });

  async function startSession(): Promise<HookRunResult> {
    return runHook("session-start", { hook_event_name: "SessionStart", cwd: workspace });
  }

  it("emits empty output when no report exists", async () => {
    const bare = await fs.mkdtemp(path.join(os.tmpdir(), "swarmvault-claude-hook-bare-"));
    try {
      const result = await runHook("session-start", { cwd: bare });
      expect(result.output).toEqual({});
    } finally {
      await fs.rm(bare, { recursive: true, force: true });
    }
  });

  it("emits graph-first context at session start", async () => {
    const result = await startSession();
    const specific = hookOutput(result);
    expect(specific.hookEventName).toBe("SessionStart");
    expect(String(specific.additionalContext)).toContain("swarmvault graph query");
    expect(String(specific.additionalContext)).toContain("Read source files directly only");
  });

  it("includes pending semantic refresh counts in the session note", async () => {
    const watchDir = path.join(workspace, "state", "watch");
    await fs.mkdir(watchDir, { recursive: true });
    await fs.writeFile(
      path.join(watchDir, "pending-semantic-refresh.json"),
      JSON.stringify([
        { id: "x", path: "docs/readme.md", changeType: "modified", detectedAt: new Date().toISOString(), repoRoot: workspace }
      ]),
      "utf8"
    );
    const result = await startSession();
    expect(String(hookOutput(result).additionalContext)).toContain("semantic refresh");
  });

  it("stays advisory by default when no graph-first opt-in exists", async () => {
    await fs.rm(path.join(workspace, "swarmvault.config.json"), { force: true });
    await startSession();
    const result = await runHook("pre-tool-use", {
      tool_name: "Grep",
      tool_input: { pattern: "anything" },
      cwd: workspace
    });
    const specific = hookOutput(result);
    expect(specific.permissionDecision).not.toBe("deny");
    expect(String(specific.additionalContext ?? "")).toContain("graph");
  });

  it("does not flag search tools that filter piped output", async () => {
    await startSession();
    const result = await runHook("pre-tool-use", {
      tool_name: "Bash",
      tool_input: { command: 'swarmvault graph status | grep -E "State"' },
      cwd: workspace
    });
    expect(result.output).toEqual({});
  });

  it("denies the first Grep and allows the retry", async () => {
    await startSession();
    const grepInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Grep",
      tool_input: { pattern: "createMcpServer" },
      cwd: workspace
    };

    const first = await runHook("pre-tool-use", grepInput);
    const firstSpecific = hookOutput(first);
    expect(firstSpecific.permissionDecision).toBe("deny");
    expect(String(firstSpecific.permissionDecisionReason)).toContain('swarmvault graph query "createMcpServer"');

    const second = await runHook("pre-tool-use", grepInput);
    expect(hookOutput(second).permissionDecision).not.toBe("deny");
  });

  it("tracks deny-once per tool class", async () => {
    await startSession();
    const grep = await runHook("pre-tool-use", {
      tool_name: "Grep",
      tool_input: { pattern: "alpha" },
      cwd: workspace
    });
    expect(hookOutput(grep).permissionDecision).toBe("deny");

    const glob = await runHook("pre-tool-use", {
      tool_name: "Glob",
      tool_input: { pattern: "**/*.ts" },
      cwd: workspace
    });
    expect(hookOutput(glob).permissionDecision).toBe("deny");
  });

  it("never denies searches scoped to vault artifacts", async () => {
    await startSession();
    const result = await runHook("pre-tool-use", {
      tool_name: "Grep",
      tool_input: { pattern: "page_id", path: path.join(workspace, "wiki") },
      cwd: workspace
    });
    expect(hookOutput(result).permissionDecision).not.toBe("deny");
  });

  it("never denies a single-file grep", async () => {
    await startSession();
    const filePath = path.join(workspace, "main.ts");
    await fs.writeFile(filePath, "export const x = 1;\n", "utf8");
    const result = await runHook("pre-tool-use", {
      tool_name: "Grep",
      tool_input: { pattern: "x", path: filePath },
      cwd: workspace
    });
    expect(hookOutput(result).permissionDecision).not.toBe("deny");
  });

  it("treats broad bash searches like broad tool searches", async () => {
    await startSession();
    const result = await runHook("pre-tool-use", {
      tool_name: "Bash",
      tool_input: { command: "rg createMcpServer src" },
      cwd: workspace
    });
    expect(hookOutput(result).permissionDecision).toBe("deny");
  });

  it("does not deny non-search bash commands", async () => {
    await startSession();
    const result = await runHook("pre-tool-use", {
      tool_name: "Bash",
      tool_input: { command: "swarmvault graph query auth --json" },
      cwd: workspace
    });
    expect(result.output).toEqual({});
  });

  it("respects SWARMVAULT_GRAPH_FIRST=off", async () => {
    await startSession();
    const result = await runHook(
      "pre-tool-use",
      { tool_name: "Grep", tool_input: { pattern: "anything" }, cwd: workspace },
      { SWARMVAULT_GRAPH_FIRST: "off" }
    );
    expect(result.output).toEqual({});
  });

  it("respects hooks.graphFirst=context in swarmvault.config.json", async () => {
    await startSession();
    await fs.writeFile(path.join(workspace, "swarmvault.config.json"), JSON.stringify({ hooks: { graphFirst: "context" } }), "utf8");
    const result = await runHook("pre-tool-use", {
      tool_name: "Grep",
      tool_input: { pattern: "anything" },
      cwd: workspace
    });
    const specific = hookOutput(result);
    expect(specific.permissionDecision).not.toBe("deny");
    expect(String(specific.additionalContext ?? "")).toContain("graph");
  });

  it("marks the report as read instead of denying when the report is the target", async () => {
    await startSession();
    const result = await runHook("pre-tool-use", {
      tool_name: "Grep",
      tool_input: { pattern: "anything", path: path.join(workspace, "wiki", "graph", "report.md") },
      cwd: workspace
    });
    expect(result.output).toEqual({});
  });

  it("emits empty output for post-edit without breaking on missing CLI", async () => {
    await startSession();
    const result = await runHook(
      "post-edit",
      {
        tool_name: "Edit",
        tool_input: { file_path: path.join(workspace, "src", "main.ts") },
        cwd: workspace
      },
      { PATH: "/nonexistent" }
    );
    expect(result.output).toEqual({});
  });

  it("ignores vault artifact paths in post-edit", async () => {
    await startSession();
    const result = await runHook("post-edit", {
      tool_name: "Write",
      tool_input: { file_path: path.join(workspace, "wiki", "outputs", "answer.md") },
      cwd: workspace
    });
    expect(result.output).toEqual({});
  });
});
