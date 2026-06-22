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
});
