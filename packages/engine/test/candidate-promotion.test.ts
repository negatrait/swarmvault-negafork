import { describe, expect, test } from "vitest";
import {
  DEFAULT_PROMOTION_CONFIG,
  evaluateCandidateForPromotion,
  renderPromotionSessionMarkdown,
  sortDecisionsForPromotion
} from "../src/candidate-promotion.js";
import type { GraphArtifact } from "../src/types.js";

const NOW = new Date("2023-10-02T12:00:00Z").getTime();
const YESTERDAY = "2023-10-01T12:00:00Z";

// biome-ignore lint/suspicious/noExplicitAny: Mock test data
const mockPage: any = {
  id: "page-1",
  path: "test/page-1",
  title: "Test Page",
  kind: "concept",
  sourceIds: ["s1", "s2", "s3"],
  projectIds: [],
  nodeIds: ["n1"],
  confidence: 0.85,
  freshness: "fresh",
  createdAt: YESTERDAY,
  updatedAt: YESTERDAY
};

const mockGraph: GraphArtifact = {
  generatedAt: YESTERDAY,
  nodes: [
    {
      id: "n1",
      type: "concept",
      label: "n1",
      sourceIds: [],
      projectIds: [],
      degree: 2
    }
  ],
  edges: [],
  hyperedges: [],
  sources: [],
  pages: []
};

describe("Candidate Promotion (Differential Parity)", () => {
  test("evaluateCandidateForPromotion - parity with pure TS", () => {
    // 1. Run via TS
    process.env.USE_GO_PORT = "false";
    const tsDecision = evaluateCandidateForPromotion(
      mockPage,
      mockGraph,
      {
        "page-1": { sourceIds: ["s1", "s2", "s3"], status: "candidate" }
      },
      { ...DEFAULT_PROMOTION_CONFIG, enabled: true },
      NOW
    );

    // 2. Run via Go CLI
    process.env.USE_GO_PORT = "true";
    const goDecision = evaluateCandidateForPromotion(
      mockPage,
      mockGraph,
      {
        "page-1": { sourceIds: ["s1", "s2", "s3"], status: "candidate" }
      },
      { ...DEFAULT_PROMOTION_CONFIG, enabled: true },
      NOW
    );

    expect(goDecision).toEqual(tsDecision);
    expect(goDecision.promote).toBe(true);
    expect(goDecision.score).toBe(1.0);
    expect(goDecision.gates).toHaveLength(5);
  });

  test("sortDecisionsForPromotion - parity", () => {
    const decisions = [
      { pageId: "b", title: "b", kind: "concept" as const, promote: true, score: 0.8, gates: [], reasons: [] },
      { pageId: "a", title: "a", kind: "concept" as const, promote: false, score: 0.6, gates: [], reasons: [] },
      { pageId: "c", title: "c", kind: "concept" as const, promote: true, score: 0.9, gates: [], reasons: [] },
      { pageId: "d", title: "d", kind: "concept" as const, promote: true, score: 0.8, gates: [], reasons: [] }
    ];

    process.env.USE_GO_PORT = "false";
    const tsSorted = sortDecisionsForPromotion(decisions);

    process.env.USE_GO_PORT = "true";
    const goSorted = sortDecisionsForPromotion(decisions);

    expect(goSorted).toEqual(tsSorted);
    expect(goSorted.map((d) => d.pageId)).toEqual(["c", "b", "d", "a"]);
  });

  test("renderPromotionSessionMarkdown - parity", () => {
    const decisions = [
      { pageId: "c", title: "c", kind: "concept" as const, promote: true, score: 0.9, gates: [], reasons: ["test"] },
      { pageId: "a", title: "a", kind: "concept" as const, promote: false, score: 0.6, gates: [], reasons: [] }
    ];

    process.env.USE_GO_PORT = "false";
    const tsMarkdown = renderPromotionSessionMarkdown(decisions, ["c"], {
      dryRun: false,
      startedAt: YESTERDAY,
      finishedAt: YESTERDAY
    });

    process.env.USE_GO_PORT = "true";
    const goMarkdown = renderPromotionSessionMarkdown(decisions, ["c"], {
      dryRun: false,
      startedAt: YESTERDAY,
      finishedAt: YESTERDAY
    });

    expect(goMarkdown).toEqual(tsMarkdown);
  });
});
