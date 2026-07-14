import { describe, expect, it } from "vitest";
import { enrichGraph } from "../src/graph-enrichment.js";
import type { GraphArtifact } from "../src/types.js";

describe("graph enrichment porting", () => {
  it("buildTopicHyperedges should match exactly when USE_GO_PORT is true", () => {
    // Construct a mock graph that produces a topic hyperedge
    const graph: GraphArtifact = {
      nodes: [
        { id: "source1", type: "source", label: "Source 1", degree: 1, sourceIds: ["source1"], projectIds: [] },
        { id: "source2", type: "source", label: "Source 2", degree: 1, sourceIds: ["source2"], projectIds: [] },
        { id: "source3", type: "source", label: "Source 3", degree: 1, sourceIds: ["source3"], projectIds: [] },
        { id: "concept1", type: "concept", label: "Concept Anchor", degree: 3, sourceIds: [], projectIds: [] }
      ],
      edges: [
        {
          id: "e1",
          source: "source1",
          target: "concept1",
          relation: "mentions",
          evidenceClass: "extracted",
          confidence: 1,
          provenance: [],
          status: "stale"
        },
        {
          id: "e2",
          source: "source2",
          target: "concept1",
          relation: "mentions",
          evidenceClass: "extracted",
          confidence: 1,
          provenance: [],
          status: "stale"
        },
        {
          id: "e3",
          source: "source3",
          target: "concept1",
          relation: "mentions",
          evidenceClass: "extracted",
          confidence: 1,
          provenance: [],
          status: "stale"
        }
      ],
      pages: [],
      hyperedges: []
    };

    // Call TS version
    process.env.USE_GO_PORT = "false";
    const tsResult = enrichGraph(graph, [], []);

    // Call Go version
    process.env.USE_GO_PORT = "true";
    const goResult = enrichGraph(graph, [], []);

    // They should both contain hyperedges
    expect(tsResult.hyperedges.length).toBeGreaterThan(0);

    // Output shouldn't differ
    expect(goResult.hyperedges).toEqual(tsResult.hyperedges);
  });

  it("buildModuleFormHyperedges should match exactly when USE_GO_PORT is true", () => {
    const graph: GraphArtifact = {
      nodes: [
        { id: "module1", type: "module", label: "MyModule", degree: 3, sourceIds: ["s1"], projectIds: [] },
        { id: "symbol1", type: "symbol", label: "Symbol 1", degree: 1, sourceIds: [], projectIds: [] },
        { id: "symbol2", type: "symbol", label: "Symbol 2", degree: 1, sourceIds: [], projectIds: [] },
        { id: "symbol3", type: "symbol", label: "Symbol 3", degree: 1, sourceIds: [], projectIds: [] }
      ],
      edges: [
        {
          id: "e1",
          source: "module1",
          target: "symbol1",
          relation: "defines",
          evidenceClass: "extracted",
          confidence: 1,
          provenance: [],
          status: "stale"
        },
        {
          id: "e2",
          source: "module1",
          target: "symbol2",
          relation: "defines",
          evidenceClass: "extracted",
          confidence: 1,
          provenance: [],
          status: "stale"
        },
        {
          id: "e3",
          source: "module1",
          target: "symbol3",
          relation: "defines",
          evidenceClass: "extracted",
          confidence: 1,
          provenance: [],
          status: "stale"
        }
      ],
      pages: [],
      hyperedges: []
    };

    process.env.USE_GO_PORT = "false";
    const tsResult = enrichGraph(graph, [], []);

    process.env.USE_GO_PORT = "true";
    const goResult = enrichGraph(graph, [], []);

    expect(tsResult.hyperedges.length).toBeGreaterThan(0);
    expect(goResult.hyperedges).toEqual(tsResult.hyperedges);
  });
});
