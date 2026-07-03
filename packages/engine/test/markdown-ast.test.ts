import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseMarkdownNodes } from "../src/markdown-ast.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// We strip "position" because the Go parser does not perfectly reconstruct mdast positions,
// and the parity expectations are around structural parsing (types, values, children).
// biome-ignore lint/suspicious/noExplicitAny: allow any for generic tree mapping
function stripExtra(nodes: any[]): any[] {
  return nodes.map((node) => {
    // Only keep properties that exist in our defined MarkdownNode type parity
    const { position, ordered, start, spread, checked, url, title, lang, meta, ...rest } = node;
    if (rest.children) {
      rest.children = stripExtra(rest.children);
    }
    return rest;
  });
}

describe("parseMarkdownNodes", () => {
  it("matches shared JSON fixtures", () => {
    const fixturePath = path.join(__dirname, "shared-fixtures", "markdown-ast.json");
    const data = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));

    for (const testCase of data.tests) {
      const result = stripExtra(parseMarkdownNodes(testCase.text));
      expect(result, testCase.name).toEqual(testCase.expected);
    }
  });
});
