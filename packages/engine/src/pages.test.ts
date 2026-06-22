import { describe, expect, it } from "vitest";
import { parseStoredPage } from "./pages.js";

describe("parseStoredPage", () => {
  it("should correctly parse insight markdown with full frontmatter", () => {
    const relativePath = "insights/test-insight.md";
    const content = `---
page_id: insight:custom-id
title: Custom Insight Title
kind: insight
source_ids: ["source-1", "source-2"]
confidence: 0.95
status: archived
managed_by: human
tier: procedural
consolidated_from_page_ids: ["working-1", "working-2"]
consolidation_confidence: 0.85
---
# Content`;

    const result = parseStoredPage(relativePath, content);

    expect(result.id).toBe("insight:custom-id");
    expect(result.path).toBe("insights/test-insight.md");
    expect(result.title).toBe("Custom Insight Title");
    expect(result.kind).toBe("insight");
    expect(result.sourceIds).toEqual(["source-1", "source-2"]);
    expect(result.confidence).toBe(0.95);
    expect(result.status).toBe("archived");
    expect(result.managedBy).toBe("human");
    expect(result.tier).toBe("procedural");
    expect(result.consolidatedFromPageIds).toEqual(["working-1", "working-2"]);
    expect(result.consolidationConfidence).toBe(0.85);
  });

  it("should correctly parse output markdown with output-specific fields", () => {
    const relativePath = "outputs/test-output.md";
    const content = `---
title: Test Output
kind: output
output_format: markdown
output_assets:
  - id: asset1
    path: assets/asset1.png
    mimeType: image/png
    role: primary
---
# Output Content`;

    const result = parseStoredPage(relativePath, content);

    expect(result.id).toBe("output:outputs-test-output");
    expect(result.title).toBe("Test Output");
    expect(result.kind).toBe("output");
    expect(result.outputFormat).toBe("markdown");
    expect(result.outputAssets).toEqual([
      {
        id: "asset1",
        path: "assets/asset1.png",
        mimeType: "image/png",
        role: "primary",
        width: undefined,
        height: undefined,
        dataPath: undefined
      }
    ]);
    expect(result.confidence).toBe(0.74); // Default for output
  });

  it("should fallback to auto-generated ID and title when missing", () => {
    const relativePath = "concepts/auto-gen.md";
    const content = `---
kind: concept
---
# Content`;

    const result = parseStoredPage(relativePath, content);

    expect(result.id).toBe("concept:concepts-auto-gen");
    expect(result.title).toBe("auto-gen");
  });

  it("should handle invalid data types safely", () => {
    const relativePath = "sources/invalid.md";
    const content = `---
kind: source
confidence: "high"
decay_score: "fast"
source_ids: "not-an-array"
---
# Content`;

    const result = parseStoredPage(relativePath, content);

    // Confidence fallback for non-output is 1
    expect(result.confidence).toBe(1);
    expect(result.decayScore).toBeUndefined();
    expect(result.sourceIds).toEqual([]);
  });

  it("should use provided timestamp defaults", () => {
    const relativePath = "insights/defaults.md";
    const content = `---
kind: insight
---
# Content`;

    const defaults = {
      createdAt: "2023-01-01T00:00:00.000Z",
      updatedAt: "2023-01-02T00:00:00.000Z"
    };

    const result = parseStoredPage(relativePath, content, defaults);

    expect(result.createdAt).toBe("2023-01-01T00:00:00.000Z");
    expect(result.updatedAt).toBe("2023-01-02T00:00:00.000Z");
  });

  it("should generate current timestamps when neither frontmatter nor defaults provide them", () => {
    const relativePath = "insights/no-time.md";
    const content = `---
kind: insight
---
# Content`;

    const before = Date.now();
    const result = parseStoredPage(relativePath, content);
    const after = Date.now();

    const createdTime = new Date(result.createdAt).getTime();
    const updatedTime = new Date(result.updatedAt).getTime();

    expect(createdTime).toBeGreaterThanOrEqual(before);
    expect(createdTime).toBeLessThanOrEqual(after);
    expect(updatedTime).toBe(createdTime);
  });
});
