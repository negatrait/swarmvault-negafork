import { describe, expect, it } from "vitest";
import { filterGraphBySourceClass } from "./embeddings.js";
import type { GraphArtifact, GraphEdge, GraphHyperedge, GraphNode, GraphPage, SourceManifest } from "./types.js";

describe("filterGraphBySourceClass", () => {
  it("should filter graph elements by source class", () => {
    const mockGraph: GraphArtifact = {
      generatedAt: "2023-01-01T00:00:00.000Z",
      nodes: [
        {
          id: "node1",
          type: "concept",
          label: "Node 1",
          sourceClass: "first_party",
          sourceIds: [],
          projectIds: []
        } as unknown as GraphNode,
        {
          id: "node2",
          type: "concept",
          label: "Node 2",
          sourceClass: "first_party",
          sourceIds: [],
          projectIds: []
        } as unknown as GraphNode,
        {
          id: "node3",
          type: "concept",
          label: "Node 3",
          sourceClass: "third_party",
          sourceIds: [],
          projectIds: []
        } as unknown as GraphNode
      ],
      edges: [
        {
          id: "edge1",
          source: "node1",
          target: "node2",
          relation: "related",
          status: "accepted"
        } as unknown as GraphEdge,
        {
          id: "edge2",
          source: "node1",
          target: "node3",
          relation: "related",
          status: "accepted"
        } as unknown as GraphEdge,
        {
          id: "edge3",
          source: "node3",
          target: "node3",
          relation: "related",
          status: "accepted"
        } as unknown as GraphEdge
      ],
      hyperedges: [
        {
          id: "he1",
          label: "Hyper 1",
          relation: "participate_in",
          nodeIds: ["node1", "node2"],
          evidenceClass: "direct"
        } as unknown as GraphHyperedge,
        {
          id: "he2",
          label: "Hyper 2",
          relation: "participate_in",
          nodeIds: ["node1", "node3"],
          evidenceClass: "direct"
        } as unknown as GraphHyperedge
      ],
      communities: [
        { id: "comm1", label: "Comm 1", nodeIds: ["node1", "node2", "node3"] },
        { id: "comm2", label: "Comm 2", nodeIds: ["node3"] }
      ],
      sources: [
        {
          sourceId: "src1",
          title: "Source 1",
          originType: "file",
          sourceKind: "directory",
          sourceClass: "first_party"
        } as unknown as SourceManifest,
        {
          sourceId: "src2",
          title: "Source 2",
          originType: "file",
          sourceKind: "directory",
          sourceClass: "third_party"
        } as unknown as SourceManifest
      ],
      pages: [
        {
          id: "node1", // mapping page id to node id for source edges
          path: "/page1",
          title: "Page 1",
          kind: "working",
          sourceClass: "first_party"
        } as unknown as GraphPage,
        {
          id: "node2",
          path: "/page2",
          title: "Page 2",
          kind: "working",
          sourceClass: "first_party"
        } as unknown as GraphPage,
        {
          id: "node3",
          path: "/page3",
          title: "Page 3",
          kind: "working",
          sourceClass: "third_party"
        } as unknown as GraphPage
      ]
    };

    const result = filterGraphBySourceClass(mockGraph, "first_party");

    expect(result.pages.length).toBe(2);
    expect(result.pages[0].id).toBe("node1");
    expect(result.pages[1].id).toBe("node2");

    expect(result.edges.length).toBe(1);
    expect(result.edges[0].id).toBe("edge1");

    expect(result.nodes.length).toBe(2);
    expect(result.nodes[0].id).toBe("node1");
    expect(result.nodes[1].id).toBe("node2");

    expect(result.hyperedges.length).toBe(1);
    expect(result.hyperedges[0].id).toBe("he1");

    expect(result.communities?.length).toBe(1);
    expect(result.communities?.[0].id).toBe("comm1");
    expect(result.communities?.[0].nodeIds).toEqual(["node1", "node2"]);

    expect(result.sources.length).toBe(1);
    expect(result.sources[0].sourceId).toBe("src1");
  });

  it("should return empty elements if no matches found", () => {
    const mockGraph: GraphArtifact = {
      generatedAt: "2023-01-01T00:00:00.000Z",
      nodes: [
        {
          id: "node1",
          type: "concept",
          label: "Node 1",
          sourceClass: "first_party",
          sourceIds: [],
          projectIds: []
        } as unknown as GraphNode
      ],
      edges: [
        {
          id: "edge1",
          source: "node1",
          target: "node1",
          relation: "related",
          status: "accepted"
        } as unknown as GraphEdge
      ],
      hyperedges: [],
      communities: [],
      sources: [
        {
          sourceId: "src1",
          title: "Source 1",
          originType: "file",
          sourceKind: "directory",
          sourceClass: "first_party"
        } as unknown as SourceManifest
      ],
      pages: [
        {
          id: "node1",
          path: "/page1",
          title: "Page 1",
          kind: "working",
          sourceClass: "first_party"
        } as unknown as GraphPage
      ]
    };

    const result = filterGraphBySourceClass(mockGraph, "resource");

    expect(result.pages).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.nodes).toEqual([]);
    expect(result.hyperedges).toEqual([]);
    expect(result.communities).toEqual([]);
    expect(result.sources).toEqual([]);
  });

  it("should handle empty graphs correctly", () => {
    const emptyGraph: GraphArtifact = {
      generatedAt: "2023-01-01T00:00:00.000Z",
      nodes: [],
      edges: [],
      hyperedges: [],
      communities: [],
      sources: [],
      pages: []
    };

    const result = filterGraphBySourceClass(emptyGraph, "first_party");

    expect(result.pages).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.nodes).toEqual([]);
    expect(result.hyperedges).toEqual([]);
    expect(result.communities).toEqual([]);
    expect(result.sources).toEqual([]);
  });
});
