/**
 * Cascading replacement strategies for the edit tool
 *
 * Each strategy attempts to find a match in the content using different
 * normalization techniques. Strategies are tried in order from most
 * strict to most flexible.
 */

import { similarity } from "./utils";

/**
 * A replacer yields all positions where a match is found
 * Each yielded value is the actual matched string in the original content
 */
export type Replacer = (content: string, find: string) => Generator<string>;

/**
 * Strategy 1: Exact match
 * Direct indexOf lookup - most performant, requires exact match
 */
export function* exactReplacer(content: string, find: string): Generator<string> {
  if (content.includes(find)) {
    yield find;
  }
}

/**
 * Strategy 2: Line-trimmed match
 * Trims trailing whitespace from each line before comparing
 * Handles inconsistent trailing whitespace
 */
export function* lineTrimmedReplacer(
  content: string,
  find: string
): Generator<string> {
  const contentLines = content.split("\n");
  const findLines = find.split("\n");

  // Trim trailing whitespace from find lines
  const trimmedFindLines = findLines.map((line) => line.trimEnd());
  const trimmedFind = trimmedFindLines.join("\n");

  // Search through content with trimmed lines
  for (let i = 0; i <= contentLines.length - findLines.length; i++) {
    const contentSlice = contentLines.slice(i, i + findLines.length);
    const trimmedContentSlice = contentSlice.map((line) => line.trimEnd());

    if (trimmedContentSlice.join("\n") === trimmedFind) {
      // Return the original content slice (not trimmed)
      yield contentSlice.join("\n");
    }
  }
}

/**
 * Strategy 3: Indentation-flexible match
 * Strips common leading indentation before comparing
 * Useful for code with different indent levels
 */
export function* indentationFlexibleReplacer(
  content: string,
  find: string
): Generator<string> {
  const contentLines = content.split("\n");
  const findLines = find.split("\n");

  // Calculate minimum indentation in find string
  const findIndents = findLines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^(\s*)/)?.[1]?.length ?? 0);
  const minFindIndent = findIndents.length > 0 ? Math.min(...findIndents) : 0;

  // Normalize find string by removing common indentation
  const normalizedFindLines = findLines.map((line) => {
    if (line.trim().length === 0) return "";
    return line.slice(minFindIndent);
  });

  // Search through content
  for (let i = 0; i <= contentLines.length - findLines.length; i++) {
    const contentSlice = contentLines.slice(i, i + findLines.length);

    // Calculate minimum indentation in content slice
    const contentIndents = contentSlice
      .filter((line) => line.trim().length > 0)
      .map((line) => line.match(/^(\s*)/)?.[1]?.length ?? 0);
    const minContentIndent =
      contentIndents.length > 0 ? Math.min(...contentIndents) : 0;

    // Normalize content slice
    const normalizedContentLines = contentSlice.map((line) => {
      if (line.trim().length === 0) return "";
      return line.slice(minContentIndent);
    });

    if (normalizedContentLines.join("\n") === normalizedFindLines.join("\n")) {
      yield contentSlice.join("\n");
    }
  }
}

/**
 * Strategy 4: Whitespace-normalized match
 * Collapses all whitespace to single spaces
 * Matches blocks ignoring formatting differences
 */
export function* whitespaceNormalizedReplacer(
  content: string,
  find: string
): Generator<string> {
  // Normalize both strings by collapsing whitespace
  const normalizeWhitespace = (s: string) => s.replace(/\s+/g, " ").trim();

  const normalizedFind = normalizeWhitespace(find);
  if (normalizedFind.length === 0) return;

  const contentLines = content.split("\n");

  // Try to find matching blocks by examining windows of lines
  const findLineCount = find.split("\n").length;

  for (let i = 0; i <= contentLines.length - findLineCount; i++) {
    for (let len = findLineCount; len <= Math.min(findLineCount + 2, contentLines.length - i); len++) {
      const contentSlice = contentLines.slice(i, i + len);
      const contentBlock = contentSlice.join("\n");
      const normalizedContent = normalizeWhitespace(contentBlock);

      if (normalizedContent === normalizedFind) {
        yield contentBlock;
      }
    }
  }
}

/**
 * Strategy 5: Block anchor match
 * Uses first/last lines as "anchors" for multi-line blocks
 * Implements similarity scoring for fuzzy matching
 */
export function* blockAnchorReplacer(
  content: string,
  find: string
): Generator<string> {
  const findLines = find.split("\n");
  if (findLines.length < 2) return; // Need at least 2 lines for anchor matching

  const contentLines = content.split("\n");
  const firstAnchor = findLines[0]!.trim();
  const lastAnchor = findLines[findLines.length - 1]!.trim();

  // Find all potential start positions (lines similar to first anchor)
  const candidates: Array<{ start: number; end: number; score: number }> = [];

  for (let i = 0; i < contentLines.length; i++) {
    const lineScore = similarity(contentLines[i]!.trim(), firstAnchor);

    // If first line is a good match, look for the last anchor
    if (lineScore >= 0.7) {
      for (
        let j = i + findLines.length - 1;
        j < Math.min(i + findLines.length + 3, contentLines.length);
        j++
      ) {
        const endLineScore = similarity(contentLines[j]!.trim(), lastAnchor);

        if (endLineScore >= 0.7) {
          const contentSlice = contentLines.slice(i, j + 1);
          const blockScore = (lineScore + endLineScore) / 2;

          // Verify the middle content is reasonably similar
          if (contentSlice.length >= findLines.length - 1) {
            candidates.push({
              start: i,
              end: j,
              score: blockScore,
            });
          }
        }
      }
    }
  }

  // Sort by score and yield matches
  candidates.sort((a, b) => b.score - a.score);

  for (const candidate of candidates) {
    if (candidate.score >= 0.7) {
      yield contentLines.slice(candidate.start, candidate.end + 1).join("\n");
    }
  }
}

/**
 * Strategy 6: Escape-normalized match
 * Unescapes common sequences: \\n → \n, \\t → \t
 * Handles LLM over-escaping issues
 */
export function* escapeNormalizedReplacer(
  content: string,
  find: string
): Generator<string> {
  // Try unescaping the find string
  const unescapedFind = find
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\\\/g, "\\");

  // Only yield if unescaping changed something and we find a match
  if (unescapedFind !== find && content.includes(unescapedFind)) {
    yield unescapedFind;
  }

  // Also try the reverse - maybe the content has escaped sequences
  const escapedFind = find
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(/\r/g, "\\r");

  if (escapedFind !== find && content.includes(escapedFind)) {
    yield escapedFind;
  }
}

/**
 * All replacement strategies in order of strictness
 */
export const strategies: Replacer[] = [
  exactReplacer,
  lineTrimmedReplacer,
  indentationFlexibleReplacer,
  whitespaceNormalizedReplacer,
  blockAnchorReplacer,
  escapeNormalizedReplacer,
];

/**
 * Find a unique match using cascading strategies
 *
 * @param content - The file content to search in
 * @param oldString - The string to find
 * @param replaceAll - If true, allows multiple matches
 * @returns The actual matched string in the content, or null if no unique match
 */
export function findMatch(
  content: string,
  oldString: string,
  replaceAll: boolean
): { match: string; occurrences: number } | null {
  for (const strategy of strategies) {
    const matches: string[] = [];

    for (const match of strategy(content, oldString)) {
      // Count how many times this match appears in content
      let count = 0;
      let index = content.indexOf(match);
      while (index !== -1) {
        count++;
        index = content.indexOf(match, index + match.length);
      }

      if (replaceAll) {
        // For replaceAll, we accept the first match that exists
        if (count > 0) {
          return { match, occurrences: count };
        }
      } else {
        // For single replace, we need exactly one occurrence
        if (count === 1) {
          return { match, occurrences: 1 };
        }
        // Track matches for error reporting
        if (count > 0 && !matches.includes(match)) {
          matches.push(match);
        }
      }
    }

    // If we found matches but none were unique, continue to next strategy
    // unless replaceAll is true
  }

  return null;
}
