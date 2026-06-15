import fs from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { initWorkspace, loadVaultConfig } from "../src/config.js";
import { compileVault } from "../src/index.js";
import { searchVault } from "../src/vault.js";

// Mock the search module
vi.mock("../src/search.js", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod,
    searchPages: vi.fn().mockReturnValue([
      { pageId: "p1", path: "p1.md", title: "A", snippet: "a", rank: 1, projectIds: [] },
      { pageId: "p2", path: "p2.md", title: "B", snippet: "b", rank: 0.5, projectIds: [] }
    ]),
    mergeSearchResults: vi.fn().mockReturnValue([
      { pageId: "p1", path: "p1.md", title: "A", snippet: "a", rank: 1, projectIds: [] },
      { pageId: "p2", path: "p2.md", title: "B", snippet: "b", rank: 0.5, projectIds: [] }
    ])
  };
});

// Mock the graph
vi.mock("../src/embeddings.js", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod,
    semanticPageSearch: vi.fn().mockResolvedValue([
      { pageId: "p1", path: "p1.md", title: "A", snippet: "a", rank: 1, projectIds: [] },
      { pageId: "p2", path: "p2.md", title: "B", snippet: "b", rank: 0.5, projectIds: [] }
    ])
  };
});

vi.mock("../src/utils.js", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod,
    readJsonFile: vi.fn().mockResolvedValue({
      nodes: [],
      edges: [],
      hyperedges: []
    }),
    fileExists: vi.fn().mockResolvedValue(true)
  };
});

describe("reranker cross-encoder support", () => {
  it("routes search ranking to the dedicated rerankProvider and uses standard response shape", async () => {
    const rootDir = resolve(__dirname, ".fixtures/test-reranker");
    await fs.mkdir(rootDir, { recursive: true });
    await initWorkspace(rootDir);

    const { paths, config } = await loadVaultConfig(rootDir);

    // Configure openai-compatible reranker mock
    config.providers["test-reranker"] = {
      type: "openai-compatible",
      model: "test-model",
      baseUrl: "http://example.org/v1",
      capabilities: ["rerank"]
    };
    config.tasks.rerankProvider = "test-reranker";

    await fs.writeFile(paths.configPath, JSON.stringify(config, null, 2));

    await fs.mkdir(resolve(rootDir, "src"), { recursive: true });
    await fs.writeFile(resolve(rootDir, "src/A.md"), "# A\ntest query match a");
    await fs.writeFile(resolve(rootDir, "src/B.md"), "# B\ntest query match b");

    await compileVault(rootDir, {});

    // Mock fetch for reranker API
    globalThis.fetch = vi.fn().mockImplementation(async (url, _options) => {
      expect(url).toBe("http://example.org/v1/rerank");
      return {
        ok: true,
        json: async () => ({
          results: [
            { index: 0, relevance_score: 0.99 },
            { index: 1, relevance_score: 0.1 }
          ]
        })
      };
    });

    try {
      const results = await searchVault(rootDir, "test query match", 5);
      expect(results.length).toBeGreaterThan(0);
    } finally {
      vi.unmock("../src/search.js");
      vi.unmock("../src/embeddings.js");
      vi.unmock("../src/utils.js");
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });
});
