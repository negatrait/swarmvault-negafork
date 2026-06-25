import { afterEach, describe, expect, it } from "vitest";
import { conflictConfidence, edgeConfidence, nodeConfidence } from "../src/confidence.js";
import fixtures from "./shared-fixtures/confidence.json";

describe("confidence.ts (Differential Parity)", () => {
  afterEach(() => {
    delete process.env.USE_GO_PORT;
  });

  for (const fixture of fixtures) {
    it(`handles ${fixture.name}`, () => {
      switch (fixture.action) {
        case "nodeConfidence": {
          process.env.USE_GO_PORT = "false";
          const tsResult = nodeConfidence(fixture.args.sourceCount as number);

          process.env.USE_GO_PORT = "true";
          const goResult = nodeConfidence(fixture.args.sourceCount as number);

          expect(goResult).toBe(tsResult);
          expect(goResult).toBe(fixture.expected);
          break;
        }
        case "edgeConfidence": {
          process.env.USE_GO_PORT = "false";
          // biome-ignore lint/suspicious/noExplicitAny: Used for mapping JSON fixture dynamically
          const tsResult = edgeConfidence(fixture.args.claims as any, fixture.args.conceptName as string);

          process.env.USE_GO_PORT = "true";
          // biome-ignore lint/suspicious/noExplicitAny: Used for mapping JSON fixture dynamically
          const goResult = edgeConfidence(fixture.args.claims as any, fixture.args.conceptName as string);

          expect(goResult).toBe(tsResult);
          expect(goResult).toBe(fixture.expected);
          break;
        }
        case "conflictConfidence": {
          process.env.USE_GO_PORT = "false";
          // biome-ignore lint/suspicious/noExplicitAny: Used for mapping JSON fixture dynamically
          const tsResult = conflictConfidence(fixture.args.claimA as any, fixture.args.claimB as any);

          process.env.USE_GO_PORT = "true";
          // biome-ignore lint/suspicious/noExplicitAny: Used for mapping JSON fixture dynamically
          const goResult = conflictConfidence(fixture.args.claimA as any, fixture.args.claimB as any);

          expect(goResult).toBe(tsResult);
          expect(goResult).toBe(fixture.expected);
          break;
        }
        default:
          throw new Error(`Unknown action: ${fixture.action}`);
      }
    });
  }
});
