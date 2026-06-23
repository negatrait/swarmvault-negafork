import { runGoSidecarSync } from "./subprocess.js";
import type { SourceClaim } from "./types.js";

export function nodeConfidence(sourceCount: number): number {
  if (process.env.USE_GO_PORT === "true") {
    return runGoSidecarSync<number>("confidence", { action: "nodeConfidence", args: { sourceCount } });
  }

  return Math.min(0.5 + sourceCount * 0.15, 0.95);
}

export function edgeConfidence(claims: SourceClaim[], conceptName: string): number {
  if (process.env.USE_GO_PORT === "true") {
    return runGoSidecarSync<number>("confidence", { action: "edgeConfidence", args: { claims, conceptName } });
  }

  const lower = conceptName.toLowerCase();
  const relevant = claims.filter((c) => c.text.toLowerCase().includes(lower));
  if (!relevant.length) {
    return 0.5;
  }
  return relevant.reduce((sum, c) => sum + c.confidence, 0) / relevant.length;
}

export function conflictConfidence(claimA: SourceClaim, claimB: SourceClaim): number {
  if (process.env.USE_GO_PORT === "true") {
    return runGoSidecarSync<number>("confidence", { action: "conflictConfidence", args: { claimA, claimB } });
  }

  return Math.min(claimA.confidence, claimB.confidence);
}
