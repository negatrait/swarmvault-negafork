// TODO: Port document parsing, ingestion, or token estimation to Go under internal/parser. Leverage Goroutines for concurrent processing and compare results in shadow mode.
import { fromMarkdown } from "mdast-util-from-markdown";
import type { SourceRationale } from "./types.js";
import { normalizeWhitespace, truncate } from "./utils.js";

export type MarkdownNode = {
  type: string;
  depth?: number;
  value?: string;
  alt?: string;
  children?: MarkdownNode[];
};

/**
 * Parses markdown text into a flat list of top-level mdast nodes.
 * Returns an empty list if parsing fails so callers can fall through
 * gracefully.
 */
export function parseMarkdownNodes(text: string): MarkdownNode[] {
  try {
    const root = fromMarkdown(text) as { children?: MarkdownNode[] };
    return Array.isArray(root.children) ? root.children : [];
  } catch {
    return [];
  }
}

/**
 * Concatenates the plain-text value of an mdast node and its descendants.
 * Mirrors the logic inside analysis.ts that walks heading/text/code/image
 * nodes so we extract real titles instead of regex-scanning raw markdown.
 */
export function markdownNodeText(node: MarkdownNode): string {
  if (node.type === "text" || node.type === "inlineCode" || node.type === "code") {
    return normalizeWhitespace(node.value ?? "");
  }
  if (node.type === "image") {
    return normalizeWhitespace(node.alt ?? "");
  }
  if (node.type === "break" || node.type === "thematicBreak") {
    return " ";
  }
  return normalizeWhitespace((node.children ?? []).map((child) => markdownNodeText(child)).join(" "));
}

/**
 * Returns the plain text of the first `heading` node in the parsed markdown,
 * or undefined when the source contains no heading. This replaces the
 * previous regex-based approach (`/^#+\s+(.+)$/m`) which matched substrings
 * anywhere in the file and ignored mdast parsing rules like escape
 * sequences and fenced code blocks that may contain `#` characters.
 */
export function firstMarkdownHeading(text: string): string | undefined {
  const nodes = parseMarkdownNodes(text);
  for (const node of nodes) {
    if (node.type === "heading") {
      const title = markdownNodeText(node).trim();
      if (title) {
        return title;
      }
    }
  }
  return undefined;
}

/**
 * Fixed-prefix rationale markers recognized on already-selected prose text.
 *
 * These markers are compared against the first whitespace-delimited word of
 * a block that the AST walker has already isolated (a markdown blockquote, a
 * markdown list item, or a plain-text paragraph split on blank lines). This
 * preserves the project invariant that comments, docstrings, and rationale
 * markers are always selected from parser nodes first, and the fixed-prefix
 * check only runs on text that has already been narrowed by the parser —
 * never swept across the whole file.
 */
const NON_CODE_RATIONALE_MARKERS = ["NOTE", "WHY", "HACK", "IMPORTANT", "RATIONALE", "TODO", "FIXME", "WARNING", "WARN"] as const;

type NonCodeRationaleMarker = (typeof NON_CODE_RATIONALE_MARKERS)[number];

const NON_CODE_RATIONALE_MARKER_SET = new Set<string>(NON_CODE_RATIONALE_MARKERS);

function matchFixedPrefix(text: string): { marker: NonCodeRationaleMarker; remainder: string } | null {
  const stripped = text.replace(/^[\s>*_\-\u2022\u25CB\u25CF]+/, "").trimStart();
  if (!stripped) {
    return null;
  }
  // Match `WORD:` where WORD is A-Z letters only. The colon is required so
  // prose prefixes ("Note that...") do not false-positive.
  const match = /^([A-Za-z]+)[:\-\u2013\u2014]\s+(.+)$/s.exec(stripped);
  if (!match) {
    return null;
  }
  const upper = match[1].toUpperCase();
  if (!NON_CODE_RATIONALE_MARKER_SET.has(upper)) {
    return null;
  }
  const remainder = normalizeWhitespace(match[2]).trim();
  if (!remainder) {
    return null;
  }
  return { marker: upper as NonCodeRationaleMarker, remainder };
}

/**
 * Walks the markdown AST and yields one `SourceRationale` per blockquote or
 * list-item block whose plain text begins with a fixed-prefix marker
 * (`NOTE:`, `WHY:`, `HACK:`, `IMPORTANT:`, `RATIONALE:`, `TODO:`, `FIXME:`,
 * `WARNING:`, `WARN:`). The marker check runs on text that the AST walker
 * has already selected — the walker does not sweep the whole source.
 *
 * `symbolName` is derived from the nearest preceding heading. When no
 * heading precedes the match, the caller's fallback (filename stem) is
 * used by leaving `symbolName` undefined.
 */
export function extractRationaleFromMarkdown(content: string, sourceId: string): SourceRationale[] {
  const nodes = parseMarkdownNodes(content);
  if (!nodes.length) {
    return [];
  }
  const rationales: SourceRationale[] = [];
  let currentHeading: string | undefined;

  const recordMatch = (text: string): void => {
    const match = matchFixedPrefix(text);
    if (!match) {
      return;
    }
    rationales.push({
      id: `rationale:${sourceId}:${rationales.length}`,
      text: truncate(match.remainder, 280),
      citation: sourceId,
      kind: match.marker.toLowerCase() as SourceRationale["kind"],
      symbolName: currentHeading
    });
  };

  const visitBlock = (node: MarkdownNode): void => {
    if (node.type === "heading") {
      const headingText = markdownNodeText(node).trim();
      if (headingText) {
        currentHeading = headingText;
      }
      return;
    }

    if (node.type === "blockquote") {
      // Blockquotes may wrap multiple child paragraphs. The prefix check is
      // applied to each child paragraph individually so that a multi-line
      // blockquote of unrelated notes produces separate rationales.
      for (const child of node.children ?? []) {
        if (child.type === "paragraph") {
          recordMatch(markdownNodeText(child));
        } else {
          // Nested structure inside a blockquote — look for further
          // blockquote/list children. Do not recurse into headings here
          // because blockquoted headings are rare and would confuse the
          // `currentHeading` tracking.
          visitBlock(child);
        }
      }
      return;
    }

    if (node.type === "list") {
      for (const item of node.children ?? []) {
        if (item.type !== "listItem") {
          continue;
        }
        // Combine the text of the listItem's direct paragraph children so a
        // two-line `- WHY: foo\n  bar` item produces one rationale.
        const itemParagraphs: string[] = [];
        const nestedLists: MarkdownNode[] = [];
        for (const child of item.children ?? []) {
          if (child.type === "paragraph") {
            itemParagraphs.push(markdownNodeText(child));
          } else if (child.type === "list") {
            nestedLists.push(child);
          }
        }
        const combined = itemParagraphs.join(" ").trim();
        if (combined) {
          recordMatch(combined);
        }
        for (const nested of nestedLists) {
          visitBlock(nested);
        }
      }
    }
  };

  for (const node of nodes) {
    visitBlock(node);
  }

  return rationales;
}

/**
 * Extracts rationale markers from plain-text sources by splitting on blank
 * lines into paragraph-sized blocks and applying the same fixed-prefix
 * check used by `extractRationaleFromMarkdown`. The blank-line split is the
 * structural parser for plain text — the prefix check never runs on the
 * full file, only on already-isolated paragraph boundaries.
 *
 * Plain text has no headings to anchor to, so callers must supply a
 * `fallbackSymbolName` (typically the filename stem) that will be attached
 * to every emitted rationale.
 */
export function extractRationaleFromPlainText(content: string, sourceId: string, fallbackSymbolName?: string): SourceRationale[] {
  if (!content.trim()) {
    return [];
  }
  const paragraphs = content.split(/\r?\n\s*\r?\n+/);
  const rationales: SourceRationale[] = [];
  for (const paragraph of paragraphs) {
    const normalized = normalizeWhitespace(paragraph);
    if (!normalized) {
      continue;
    }
    const match = matchFixedPrefix(normalized);
    if (!match) {
      continue;
    }
    rationales.push({
      id: `rationale:${sourceId}:${rationales.length}`,
      text: truncate(match.remainder, 280),
      citation: sourceId,
      kind: match.marker.toLowerCase() as SourceRationale["kind"],
      symbolName: fallbackSymbolName
    });
  }
  return rationales;
}
