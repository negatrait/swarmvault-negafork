import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { askChatSession, deleteChatSession, listChatSessions } from "../src/index.js";

const tempDirs: string[] = [];

async function createTempWorkspace(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "swarmvault-chat-bridge-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("chat.ts subprocess bridge", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await createTempWorkspace();

    // Scaffold the config structure that loadVaultConfig will expect
    const stateDir = path.join(rootDir, ".swarmvault", "state", "chat-sessions");
    const wikiDir = path.join(rootDir, "wiki", "outputs", "chat-sessions");
    await fs.mkdir(stateDir, { recursive: true });
    await fs.mkdir(wikiDir, { recursive: true });

    // We fake the config file so `loadVaultConfig` succeeds
    const configPath = path.join(rootDir, "swarmvault.config.json");
    await fs.writeFile(
      configPath,
      JSON.stringify({
        workspace: {
          stateDir: ".swarmvault/state",
          wikiDir: "wiki"
        },
        providers: {},
        tasks: {
          compileProvider: "mock",
          queryProvider: "mock",
          lintProvider: "mock",
          visionProvider: "mock"
        }
      })
    );

    // Scaffold a dummy session
    const dummySession = {
      id: "20240101-120000Z-test-session",
      title: "test-session",
      createdAt: "2024-01-01T12:00:00.000Z",
      updatedAt: "2024-01-01T12:00:00.000Z",
      rootDir,
      markdownPath: path.join(wikiDir, "20240101-120000Z-test-session.md"),
      turns: []
    };

    await fs.writeFile(path.join(stateDir, "20240101-120000Z-test-session.json"), JSON.stringify(dummySession));
    await fs.writeFile(dummySession.markdownPath, "dummy-markdown");
  });

  it("bridges listChatSessions securely to Go subprocess", async () => {
    process.env.USE_GO_PORT = "true";

    const sessions = await listChatSessions(rootDir);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe("20240101-120000Z-test-session");
    expect(sessions[0].turnCount).toBe(0);

    process.env.USE_GO_PORT = "false";
  });

  it("bridges deleteChatSession securely to Go subprocess", async () => {
    process.env.USE_GO_PORT = "true";

    const deleted = await deleteChatSession(rootDir, "20240101-120000Z-test-session");
    expect(deleted.id).toBe("20240101-120000Z-test-session");

    const sessions = await listChatSessions(rootDir);
    expect(sessions).toHaveLength(0);

    process.env.USE_GO_PORT = "false";
  });

  it("askChatSession throws explicit TODO error when bridging", async () => {
    process.env.USE_GO_PORT = "true";

    await expect(askChatSession(rootDir, { question: "test" })).rejects.toThrow("TODO(port): askChatSession requires queryVault port");

    process.env.USE_GO_PORT = "false";
  });
});
