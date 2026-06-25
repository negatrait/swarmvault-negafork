import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { estimatePageTokens, estimateTokens, trimToTokenBudget } from "./token-estimation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesPath = path.join(__dirname, "..", "test", "shared-fixtures", "token-estimation.json");
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, "utf-8"));

describe("token-estimation", () => {
  describe("estimateTokens", () => {
    // biome-ignore lint/suspicious/noExplicitAny: <suppress>
    fixtures.estimateTokens.forEach((tc: any, i: number) => {
      it(`case ${i}`, () => {
        expect(estimateTokens(tc.input)).toEqual(tc.expected);
      });
    });
  });

  describe("estimatePageTokens", () => {
    // biome-ignore lint/suspicious/noExplicitAny: <suppress>
    fixtures.estimatePageTokens.forEach((tc: any, i: number) => {
      it(`case ${i}`, () => {
        const { pageId, path, kind, content, nodeDegree, confidence } = tc.input;
        expect(estimatePageTokens(pageId, path, kind, content, nodeDegree, confidence)).toEqual(tc.expected);
      });
    });
  });

  describe("trimToTokenBudget", () => {
    // biome-ignore lint/suspicious/noExplicitAny: <suppress>
    fixtures.trimToTokenBudget.forEach((tc: any, i: number) => {
      it(`case ${i}`, () => {
        expect(trimToTokenBudget(tc.input.pages, tc.input.maxTokens)).toEqual(tc.expected);
      });
    });
  });
});
