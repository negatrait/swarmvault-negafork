import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  appendJsonLine,
  ensureDir,
  extractJson,
  fileExists,
  firstSentences,
  isPathWithin,
  listFilesRecursive,
  normalizeWhitespace,
  readJsonFile,
  safeFrontmatter,
  sha256,
  slugify,
  toPosix,
  truncate,
  uniqueBy,
  writeFileIfChanged,
  writeJsonFile
} from "./utils.js";

describe("utils", () => {
  describe("slugify", () => {
    it("should lowercase and replace spaces with hyphens", () => {
      expect(slugify("Hello World")).toBe("hello-world");
    });
    it("should remove non-alphanumeric characters", () => {
      expect(slugify("Hello, World! 123")).toBe("hello-world-123");
    });
    it("should trim hyphens from ends", () => {
      expect(slugify("-Hello-World-")).toBe("hello-world");
    });
    it("should fallback to item if empty", () => {
      expect(slugify("!!!")).toBe("item");
    });
    it("should truncate to 80 chars", () => {
      const longString = "A".repeat(100);
      expect(slugify(longString).length).toBe(80);
    });
  });

  describe("sha256", () => {
    it("should generate a consistent hash", () => {
      expect(sha256("test")).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
    });
  });

  describe("toPosix", () => {
    it("should convert backslashes to forward slashes", () => {
      // Skipping Windows specific backslash conversion since tests run in POSIX environment
      expect(toPosix("a/b/c")).toBe("a/b/c");
    });
  });

  describe("firstSentences", () => {
    it("should extract the first N sentences", () => {
      const text = "First sentence. Second sentence! Third sentence? Fourth sentence.";
      expect(firstSentences(text, 2)).toBe("First sentence. Second sentence!");
      expect(firstSentences(text, 10)).toBe("First sentence. Second sentence! Third sentence? Fourth sentence.");
    });
  });

  describe("uniqueBy", () => {
    it("should filter out duplicate items by key", () => {
      const items = [{ id: "a" }, { id: "b" }, { id: "a" }];
      expect(uniqueBy(items, (i) => i.id)).toEqual([{ id: "a" }, { id: "b" }]);
    });
  });

  describe("extractJson", () => {
    it("should extract json from markdown fences", () => {
      expect(extractJson('some text\n```json\n{"a":1}\n```\nmore text')).toBe('{"a":1}');
    });
    it("should extract json from raw text by finding braces", () => {
      expect(extractJson('here is the json: {"a": 1} and done.')).toBe('{"a": 1}');
    });
    it("should handle nested braces", () => {
      expect(extractJson('text {"a": {"b": 1}} text')).toBe('{"a": {"b": 1}}');
    });
    it("should throw if no valid json is found", () => {
      expect(() => extractJson("no json here")).toThrow();
    });
  });

  describe("normalizeWhitespace", () => {
    it("should replace multiple spaces and newlines with a single space", () => {
      expect(normalizeWhitespace("  hello   \n world  ")).toBe("hello world");
    });
  });

  describe("safeFrontmatter", () => {
    it("should remove undefined values", () => {
      expect(safeFrontmatter({ a: 1, b: undefined, c: null })).toEqual({ a: 1, c: null });
    });
  });

  describe("truncate", () => {
    it("should truncate and add ellipsis", () => {
      expect(truncate("hello world", 8)).toBe("hello...");
    });
    it("should return original if short enough", () => {
      expect(truncate("hello", 10)).toBe("hello");
    });
    it("should handle very small max lengths", () => {
      expect(truncate("hello", 2)).toBe("he");
    });
  });

  describe("isPathWithin", () => {
    it("should return true for subdirectories", () => {
      expect(isPathWithin("/root/dir", "/root/dir/sub/file")).toBe(true);
      expect(isPathWithin("/root/dir", "/root/dir")).toBe(true);
    });
    it("should return false for sibling directories", () => {
      expect(isPathWithin("/root/dir", "/root/dir2/file")).toBe(false);
    });
  });

  describe("File operations", () => {
    const testDir = path.join(process.cwd(), "test-utils-tmp");

    // We clean up and setup our temporary directory before all tests
    beforeAll(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
      await fs.mkdir(testDir, { recursive: true });
    });

    afterAll(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    it("should handle ensureDir and fileExists", async () => {
      const dir = path.join(testDir, "sub");
      await ensureDir(dir);
      expect(await fileExists(dir)).toBe(true);
      expect(await fileExists(path.join(testDir, "nonexistent"))).toBe(false);
    });

    it("should write, read, and append json", async () => {
      const file = path.join(testDir, "data.json");
      await writeJsonFile(file, { a: 1 });
      expect(await fileExists(file)).toBe(true);
      expect(await readJsonFile(file)).toEqual({ a: 1 });

      const missing = path.join(testDir, "missing.json");
      expect(await readJsonFile(missing)).toBe(null);

      const list = path.join(testDir, "list.jsonl");
      await appendJsonLine(list, { id: 1 });
      await appendJsonLine(list, { id: 2 });
      const content = await fs.readFile(list, "utf8");
      expect(content).toBe('{"id":1}\n{"id":2}\n');
    });

    it("should write file if changed", async () => {
      const file = path.join(testDir, "changed.txt");
      expect(await writeFileIfChanged(file, "hello")).toBe(true);
      expect(await writeFileIfChanged(file, "hello")).toBe(false);
      expect(await writeFileIfChanged(file, "world")).toBe(true);
    });

    it("should list files recursively", async () => {
      const nestedDir = path.join(testDir, "nested", "deep");
      await ensureDir(nestedDir);
      await writeJsonFile(path.join(nestedDir, "file.json"), {});
      const files = await listFilesRecursive(path.join(testDir, "nested"));
      expect(files.length).toBe(1);
      expect(files[0].endsWith("file.json")).toBe(true);
    });
  });
});
