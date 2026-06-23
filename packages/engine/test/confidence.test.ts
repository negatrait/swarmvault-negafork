import { describe, expect, it } from "vitest";
import { conflictConfidence, edgeConfidence, nodeConfidence } from "../src/confidence.js";
import fixtures from "./shared-fixtures/confidence.json";

describe("confidence.ts", () => {
  for (const fixture of fixtures) {
    it(`handles ${fixture.name}`, () => {
      switch (fixture.action) {
        case "nodeConfidence": {
          const result = nodeConfidence(fixture.args.sourceCount as number);
          expect(result).toBe(fixture.expected);
          break;
        }
        case "edgeConfidence": {
          // biome-ignore lint/suspicious/noExplicitAny: Used for mapping JSON fixture dynamically
          const result = edgeConfidence(fixture.args.claims as any, fixture.args.conceptName as string);
          expect(result).toBe(fixture.expected);
          break;
        }
        case "conflictConfidence": {
          // biome-ignore lint/suspicious/noExplicitAny: Used for mapping JSON fixture dynamically
          const result = conflictConfidence(fixture.args.claimA as any, fixture.args.claimB as any);
          expect(result).toBe(fixture.expected);
          break;
        }
        default:
          throw new Error(`Unknown action: ${fixture.action}`);
      }
    });
  }
});
