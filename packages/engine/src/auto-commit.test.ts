import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { autoCommitWikiChanges } from "./auto-commit.js";

const execFileAsync = promisify(execFile);

async function git(rootDir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd: rootDir });
  return stdout.trim();
}

async function setupTestGitRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "swarmvault-test-"));
  await mkdir(join(dir, "wiki"), { recursive: true });
  await mkdir(join(dir, "state"), { recursive: true });

  const defaultConfigStr = JSON.stringify({
    providers: {
      local: {
        type: "heuristic",
        model: "heuristic-v1",
        capabilities: ["chat", "structured", "vision", "local"]
      }
    },
    tasks: {
      compileProvider: "local",
      queryProvider: "local",
      lintProvider: "local",
      visionProvider: "local",
      imageProvider: "local"
    }
  });

  await writeFile(join(dir, "swarmvault.config.json"), JSON.stringify({ autoCommit: true, ...JSON.parse(defaultConfigStr) }));

  await git(dir, "init");
  await git(dir, "config", "user.email", "test@example.com");
  await git(dir, "config", "user.name", "Test User");

  await writeFile(join(dir, "wiki", "init.md"), "init");
  await git(dir, "add", ".");
  await git(dir, "commit", "-m", "init");

  return dir;
}

const runTests = () => {
  it("skips when autoCommit is false and no force", async () => {
    const dir = await setupTestGitRepo();
    const defaultConfigStr = JSON.stringify({
      providers: {
        local: {
          type: "heuristic",
          model: "heuristic-v1",
          capabilities: ["chat", "structured", "vision", "local"]
        }
      },
      tasks: {
        compileProvider: "local",
        queryProvider: "local",
        lintProvider: "local",
        visionProvider: "local",
        imageProvider: "local"
      }
    });
    await writeFile(join(dir, "swarmvault.config.json"), JSON.stringify({ autoCommit: false, ...JSON.parse(defaultConfigStr) }));
    const msg = await autoCommitWikiChanges(dir, "test", "detail", {});
    expect(msg).toBeNull();
    await rm(dir, { recursive: true, force: true });
  });

  it("commits when forced even if autoCommit is false", async () => {
    const dir = await setupTestGitRepo();
    const defaultConfigStr = JSON.stringify({
      providers: {
        local: {
          type: "heuristic",
          model: "heuristic-v1",
          capabilities: ["chat", "structured", "vision", "local"]
        }
      },
      tasks: {
        compileProvider: "local",
        queryProvider: "local",
        lintProvider: "local",
        visionProvider: "local",
        imageProvider: "local"
      }
    });
    await writeFile(join(dir, "swarmvault.config.json"), JSON.stringify({ autoCommit: false, ...JSON.parse(defaultConfigStr) }));
    await writeFile(join(dir, "wiki", "test.md"), "test content");

    const msg = await autoCommitWikiChanges(dir, "test", "detail", { force: true });
    expect(msg).toBe("vault test: detail");
    await rm(dir, { recursive: true, force: true });
  });

  it("commits when autoCommit is true", async () => {
    const dir = await setupTestGitRepo();
    await writeFile(join(dir, "wiki", "test.md"), "test content");

    const msg = await autoCommitWikiChanges(dir, "test", "detail", {});
    expect(msg).toBe("vault test: detail");
    await rm(dir, { recursive: true, force: true });
  });

  it("skips when no changes to commit", async () => {
    const dir = await setupTestGitRepo();

    const msg = await autoCommitWikiChanges(dir, "test", "detail", {});
    expect(msg).toBeNull();
    await rm(dir, { recursive: true, force: true });
  });
};

describe("autoCommitWikiChanges (TS Mode)", () => {
  beforeEach(() => {
    delete process.env.USE_GO_PORT;
  });
  runTests();
});

describe("autoCommitWikiChanges (Go Sidecar Mode)", () => {
  beforeEach(() => {
    process.env.USE_GO_PORT = "true";
  });
  afterEach(() => {
    delete process.env.USE_GO_PORT;
  });
  runTests();
});
