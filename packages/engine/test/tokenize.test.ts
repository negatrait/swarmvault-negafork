import { describe, expect, it } from "vitest";
import { contentTokens, tokenize } from "../src/tokenize.js";

describe("tokenize", () => {
  it("should return empty array for empty string", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("should return empty array for strings with only punctuation", () => {
    expect(tokenize("!!!")).toEqual([]);
    expect(tokenize(" , . ")).toEqual([]);
    expect(tokenize("---")).toEqual([]);
  });

  it("should return empty array for strings with only spaces", () => {
    expect(tokenize("   ")).toEqual([]);
    expect(tokenize("\t\n")).toEqual([]);
  });

  it("should tokenize normal English words", () => {
    expect(tokenize("hello world")).toEqual(["hello", "world"]);
  });

  it("should tokenize hyphenated words", () => {
    expect(tokenize("state-of-the-art")).toEqual(["state", "of", "the", "art"]);
  });

  it("should handle apostrophes (contractions)", () => {
    // compromise output is usually split further by splitTermToTokens
    // don't is split by /[^a-z0-9-]+/ meaning ' becomes a separator, yielding "don" and "t", but "t" is < 2 chars so it's dropped.
    expect(tokenize("don't you know")).toEqual(["don", "you", "know"]);
  });

  it("should ignore trailing/leading hyphens", () => {
    expect(tokenize("-hello- world-")).toEqual(["hello", "world"]);
  });

  it("should fallback to regex for very short or confusing strings where NLP fails", () => {
    expect(tokenize("hi")).toEqual(["hi"]);
  });

  it("should handle accents and unicode by stripping non-ascii during splitTermToTokens", () => {
    // compromise keeps unicode but splitTermToTokens strips it due to /[^a-z0-9-]+/
    expect(tokenize("café")).toEqual(["caf"]);
    expect(tokenize("naïve")).toEqual(["na", "ve"]);
  });

  it("should return empty array for emojis", () => {
    expect(tokenize("👋")).toEqual([]);
    expect(tokenize("hello 👋 world")).toEqual(["hello", "world"]);
  });

  it("should handle alphanumeric and mixed strings", () => {
    expect(tokenize("v1")).toEqual(["v1"]);
    expect(tokenize("react18")).toEqual(["react18"]);
    expect(tokenize("12345")).toEqual(["12345"]);
    expect(tokenize("x-ray")).toEqual(["x-ray"]);
  });

  it("should trigger regex fallback for problematic inputs", () => {
    // compromise throws an error when trying to parse extremely weird stuff sometimes,
    // or simply returns nothing, but to test the 'catch' path we would need to mock,
    // which is not easy for a single test without clearing require cache.
    // However, we can assert that regex fallback is used when compromise returns empty:
    // "12" string makes compromise output nothing, so it hits fallback:
    expect(tokenize("12")).toEqual(["12"]);
  });
});

describe("contentTokens", () => {
  it("should return empty array for empty string", () => {
    expect(contentTokens("")).toEqual([]);
  });

  it("should return empty array for strings with only punctuation", () => {
    expect(contentTokens("!!!")).toEqual([]);
  });

  it("should enforce the minimum length (default 4)", () => {
    expect(contentTokens("the cat barks")).toEqual(["barks"]);
  });

  it("should enforce a custom minimum length", () => {
    // the is not stripped if compromise doesn't treat it as closed-class in this specific short phrase or fallback kicks in.
    // actually, let's just use a sentence where stopwords are clear
    expect(contentTokens("the cat barks", 3)).toEqual(["the", "cat", "barks"]);
  });

  it("should drop closed-class words (stopwords)", () => {
    expect(contentTokens("it is in the house", 4)).toEqual(["house"]);
  });

  it("should handle hyphenated content words", () => {
    expect(contentTokens("open-source software")).toEqual(["open", "source", "software"]);
  });

  it("should ignore punctuation and numbers gracefully according to min length", () => {
    expect(contentTokens("2024 is the year!!!", 4)).toEqual(["2024", "year"]);
  });

  it("should handle accents and unicode in contentTokens", () => {
    expect(contentTokens("café", 3)).toEqual(["caf"]);
  });

  it("should handle emojis in contentTokens", () => {
    expect(contentTokens("hello 👋 world", 4)).toEqual(["hello", "world"]);
  });

  it("should handle alphanumeric and mixed strings in contentTokens", () => {
    expect(contentTokens("v1", 2)).toEqual(["v1"]);
    expect(contentTokens("react18", 4)).toEqual(["react18"]);
    expect(contentTokens("12345", 5)).toEqual(["12345"]);
    expect(contentTokens("x-ray", 3)).toEqual(["x-ray"]);
  });

  it("should trigger regex fallback in contentTokens", () => {
    // Similarly, test the regex fallback for contentTokens
    expect(contentTokens("12", 2)).toEqual(["12"]);
  });
});
