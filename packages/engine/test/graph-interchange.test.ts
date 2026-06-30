import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { exportHyperedgeNodeId } from "../src/graph-interchange.js";
import type { GraphHyperedge } from "../src/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("graph-interchange", () => {
  it("exportHyperedgeNodeId returns expected format", () => {
    const fixturePath = path.join(__dirname, "shared-fixtures", "hyperedge.json");
    const hyperedge: GraphHyperedge = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));

    // Explicitly delete VITEST to force the Go sidecar to execute
    const originalVitest = process.env.VITEST;
    delete process.env.VITEST;
    const result = exportHyperedgeNodeId(hyperedge);
    process.env.VITEST = originalVitest;
    expect(result).toBe("hyperedge:test-hyperedge-123");
  });
});
