import { EventEmitter } from "node:events";
import type * as http from "node:http";
import { describe, expect, it } from "vitest";
import { readJsonBody } from "../src/viewer.js";

class MockIncomingMessage extends EventEmitter {
  constructor(private chunks: Buffer[]) {
    super();
  }

  [Symbol.asyncIterator]() {
    let index = 0;
    const chunks = this.chunks;
    return {
      async next() {
        if (index < chunks.length) {
          return { value: chunks[index++], done: false };
        }
        return { done: true, value: undefined };
      }
    };
  }
}

describe("viewer.ts readJsonBody", () => {
  it("should parse valid JSON", async () => {
    const jsonStr = JSON.stringify({ test: "data" });
    const req = new MockIncomingMessage([Buffer.from(jsonStr)]) as unknown as http.IncomingMessage;
    const result = await readJsonBody(req);
    expect(result).toEqual({ test: "data" });
  });

  it("should reject payloads larger than 10MB", async () => {
    // 10MB + 1 byte
    const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1, "a");
    const req = new MockIncomingMessage([largeBuffer]) as unknown as http.IncomingMessage;

    await expect(readJsonBody(req)).rejects.toThrow("Payload Too Large");
  });
});
