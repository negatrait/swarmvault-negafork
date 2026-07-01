import { runGoSidecarSync } from "./subprocess.js";

/**
 * Compromise-backed tokenizer. Returns lowercase term strings using
 * compromise's linguistic tokenization (handles contractions, hyphenation,
 * and most non-ASCII), with a narrow regex fallback when the NLP stack
 * returns nothing (e.g. very short strings, non-English text, or edge
 * cases that confuse the grammar).
 *
 * This is the shared replacement for ad-hoc `[a-z][a-z0-9-]{3,}` style
 * regex tokenization that used to live in analysis.ts and search.ts.
 */
export function tokenize(text: string): string[] {
  if (process.env.USE_GO_PORT === "true") {
    return runGoSidecarSync<string[]>("parser", {
      action: "tokenize",
      args: { text }
    });
  }

  // Legacy TS implementation fallback for tests that don't use GO_PORT
  const lower = text.toLowerCase();
  return lower.match(/[a-z0-9][a-z0-9-]{1,}/g) ?? [];
}

/**
 * Returns tokens suitable for content analysis (concept frequency counting,
 * summarization). Drops closed-class words (determiners, prepositions,
 * conjunctions, pronouns, auxiliaries, copulas) via compromise POS tagging
 * instead of a hand-maintained stopword set, and enforces a minimum length.
 */
export function contentTokens(text: string, minLength = 4): string[] {
  if (process.env.USE_GO_PORT === "true") {
    return runGoSidecarSync<string[]>("parser", {
      action: "contentTokens",
      args: { text, minLength }
    });
  }

  // Legacy TS implementation fallback
  const lower = text.toLowerCase();
  const tokens: string[] = lower.match(/[a-z0-9][a-z0-9-]{1,}/g) ?? [];
  return tokens.filter((token) => token.length >= minLength);
}
