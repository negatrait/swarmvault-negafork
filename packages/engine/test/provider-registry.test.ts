import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  addProviderConfig,
  createProvider,
  getProviderConfigEntry,
  listProviderConfigEntries,
  removeProviderConfig
} from "../src/index.js";
import { LocalWhisperProviderAdapter } from "../src/providers/local-whisper.js";
import type { ProviderConfig } from "../src/types.js";

const originalEnv = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  TOGETHER_API_KEY: process.env.TOGETHER_API_KEY,
  XAI_API_KEY: process.env.XAI_API_KEY,
  CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("provider registry", () => {
  it("creates named OpenAI-compatible provider presets with the expected defaults", async () => {
    process.env.OPENROUTER_API_KEY = "openrouter-test";
    process.env.GROQ_API_KEY = "groq-test";
    process.env.TOGETHER_API_KEY = "together-test";
    process.env.XAI_API_KEY = "xai-test";
    process.env.CEREBRAS_API_KEY = "cerebras-test";

    const rootDir = path.join(os.tmpdir(), "swarmvault-provider-registry");
    const cases: Array<{
      type: ProviderConfig["type"];
      expectedBaseUrl: string;
      expectedKey: string;
    }> = [
      { type: "openrouter", expectedBaseUrl: "https://openrouter.ai/api/v1", expectedKey: "openrouter-test" },
      { type: "groq", expectedBaseUrl: "https://api.groq.com/openai/v1", expectedKey: "groq-test" },
      { type: "together", expectedBaseUrl: "https://api.together.xyz/v1", expectedKey: "together-test" },
      { type: "xai", expectedBaseUrl: "https://api.x.ai/v1", expectedKey: "xai-test" },
      { type: "cerebras", expectedBaseUrl: "https://api.cerebras.ai/v1", expectedKey: "cerebras-test" }
    ];

    for (const testCase of cases) {
      const provider = await createProvider(
        testCase.type,
        {
          type: testCase.type,
          model: "test-model"
        },
        rootDir
      );
      expect(provider.type).toBe(testCase.type);
      expect(provider.capabilities.has("chat")).toBe(true);
      expect(provider.capabilities.has("structured")).toBe(true);
      expect(provider.capabilities.has("embeddings")).toBe(true);
      expect((provider as { baseUrl?: string }).baseUrl).toBe(testCase.expectedBaseUrl);
      expect((provider as { apiKey?: string }).apiKey).toBe(testCase.expectedKey);
      expect((provider as { apiStyle?: string }).apiStyle).toBe("chat");
    }
  });

  it("creates a LocalWhisperProviderAdapter for type local-whisper with audio-only capabilities", async () => {
    const rootDir = path.join(os.tmpdir(), "swarmvault-provider-registry-whisper");
    const provider = await createProvider(
      "local-whisper",
      {
        type: "local-whisper",
        model: "base.en",
        binaryPath: "/usr/local/bin/whisper-cli",
        modelPath: "/tmp/ggml-base.en.bin",
        threads: 8,
        extraArgs: ["--no-fallback"]
      },
      rootDir
    );
    expect(provider).toBeInstanceOf(LocalWhisperProviderAdapter);
    expect(provider.type).toBe("local-whisper");
    expect(provider.model).toBe("base.en");
    expect(provider.capabilities.has("audio")).toBe(true);
    expect(provider.capabilities.has("local")).toBe(true);
    expect(provider.capabilities.has("chat")).toBe(false);
    expect(provider.capabilities.has("structured")).toBe(false);
    expect(provider.capabilities.has("embeddings")).toBe(false);
  });

  it("adds, lists, shows, and removes provider config without dropping unknown config fields", async () => {
    const rootDir = path.join(os.tmpdir(), `swarmvault-provider-config-${process.pid}-${Date.now()}`);
    const configPath = path.join(rootDir, "swarmvault.config.json");
    await fs.mkdir(rootDir, { recursive: true });
    await fs.writeFile(
      configPath,
      `${JSON.stringify(
        {
          workspace: { rawDir: "raw", wikiDir: "wiki", stateDir: "state", agentDir: "agent", inboxDir: "inbox" },
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
            visionProvider: "local"
          },
          viewer: { port: 4123 },
          profile: {
            presets: [],
            dashboardPack: "default",
            guidedSessionMode: "insights_only",
            dataviewBlocks: false,
            guidedIngestDefault: false,
            deepLintDefault: false
          },
          agents: [],
          customBlock: { preserve: true }
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const added = await addProviderConfig({
      rootDir,
      providerId: "router",
      provider: {
        type: "openrouter",
        model: "openrouter/test",
        apiKeyEnv: "OPENROUTER_API_KEY",
        capabilities: ["chat", "structured"]
      },
      tasks: ["queryProvider", "compileProvider"]
    });
    expect(added.providerId).toBe("router");
    expect(added.added).toBe(true);
    expect(added.updatedTasks).toEqual(["queryProvider", "compileProvider"]);

    const rawAfterAdd = JSON.parse(await fs.readFile(configPath, "utf8")) as {
      customBlock?: { preserve?: boolean };
      tasks?: Record<string, string>;
    };
    expect(rawAfterAdd.customBlock?.preserve).toBe(true);
    expect(rawAfterAdd.tasks?.queryProvider).toBe("router");
    expect(rawAfterAdd.tasks?.compileProvider).toBe("router");

    const listed = await listProviderConfigEntries(rootDir);
    expect(listed.map((entry) => entry.id)).toContain("router");
    expect(listed.find((entry) => entry.id === "router")?.apiKeyEnv).toBe("OPENROUTER_API_KEY");

    const shown = await getProviderConfigEntry(rootDir, "router");
    expect(shown?.provider.model).toBe("openrouter/test");

    const removed = await removeProviderConfig({ rootDir, providerId: "router" });
    expect(removed.removed).toBe(true);
    expect(removed.updatedTasks).toEqual(["compileProvider", "queryProvider"]);
    expect(removed.reassignedTasks).toEqual(["compileProvider", "queryProvider"]);
    expect(removed.clearedTasks).toEqual([]);
    expect(removed.fallbackProviderId).toBe("local");
    const rawAfterRemove = JSON.parse(await fs.readFile(configPath, "utf8")) as {
      customBlock?: { preserve?: boolean };
      tasks?: Record<string, string>;
      providers?: Record<string, unknown>;
    };
    expect(rawAfterRemove.customBlock?.preserve).toBe(true);
    expect(rawAfterRemove.providers?.router).toBeUndefined();
    expect(rawAfterRemove.tasks?.compileProvider).toBe("local");
    expect(rawAfterRemove.tasks?.queryProvider).toBe("local");
  });

  it("rejects explicit fallback providers that are not configured", async () => {
    const rootDir = path.join(os.tmpdir(), `swarmvault-provider-fallback-${process.pid}-${Date.now()}`);
    await fs.mkdir(rootDir, { recursive: true });
    await addProviderConfig({
      rootDir,
      providerId: "router",
      provider: { type: "openrouter", model: "openrouter/test", apiKeyEnv: "OPENROUTER_API_KEY" },
      tasks: ["queryProvider"]
    });

    await expect(removeProviderConfig({ rootDir, providerId: "router", fallbackProviderId: "missing" })).rejects.toThrow(
      "Provider missing is not configured; cannot reassign tasks to it."
    );
    await expect(removeProviderConfig({ rootDir, providerId: "router", fallbackProviderId: "router" })).rejects.toThrow(
      "Provider router is not configured; cannot reassign tasks to it."
    );
  });

  it("refuses to orphan required tasks when removing the last provider", async () => {
    const rootDir = path.join(os.tmpdir(), `swarmvault-provider-orphan-${process.pid}-${Date.now()}`);
    await fs.mkdir(rootDir, { recursive: true });
    await addProviderConfig({
      rootDir,
      providerId: "router",
      provider: { type: "openrouter", model: "openrouter/test", apiKeyEnv: "OPENROUTER_API_KEY" },
      tasks: ["queryProvider", "compileProvider"]
    });

    const removedLocal = await removeProviderConfig({ rootDir, providerId: "local" });
    expect(removedLocal.removed).toBe(true);
    expect(removedLocal.fallbackProviderId).toBe("router");
    expect(removedLocal.clearedTasks).toEqual([]);

    await expect(removeProviderConfig({ rootDir, providerId: "router" })).rejects.toThrow(
      /Cannot remove provider router; tasks .* would have no provider/
    );
  });

  it("clears optional task assignments when no fallback provider remains and skips rewrites for no-op removals", async () => {
    const rootDir = path.join(os.tmpdir(), `swarmvault-provider-clear-${process.pid}-${Date.now()}`);
    const configPath = path.join(rootDir, "swarmvault.config.json");
    await fs.mkdir(rootDir, { recursive: true });
    await fs.writeFile(
      configPath,
      `${JSON.stringify(
        {
          providers: {
            solo: { type: "openrouter", model: "openrouter/test", apiKeyEnv: "OPENROUTER_API_KEY" }
          },
          tasks: {
            compileProvider: "external",
            queryProvider: "external",
            lintProvider: "external",
            visionProvider: "external",
            imageProvider: "solo",
            audioProvider: "solo"
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const cleared = await removeProviderConfig({ rootDir, providerId: "solo" });
    expect(cleared.removed).toBe(true);
    expect(cleared.fallbackProviderId).toBeNull();
    expect(cleared.reassignedTasks).toEqual([]);
    expect(cleared.clearedTasks).toEqual(["imageProvider", "audioProvider"]);
    expect(cleared.updatedTasks).toEqual(["imageProvider", "audioProvider"]);
    const rawAfterClear = JSON.parse(await fs.readFile(configPath, "utf8")) as { tasks?: Record<string, string> };
    expect(rawAfterClear.tasks?.imageProvider).toBeUndefined();
    expect(rawAfterClear.tasks?.audioProvider).toBeUndefined();
    expect(rawAfterClear.tasks?.compileProvider).toBe("external");

    const statBefore = await fs.stat(configPath);
    const noop = await removeProviderConfig({ rootDir, providerId: "ghost" });
    expect(noop.removed).toBe(false);
    expect(noop.updatedTasks).toEqual([]);
    const statAfter = await fs.stat(configPath);
    expect(statAfter.mtimeMs).toBe(statBefore.mtimeMs);
  });
});
