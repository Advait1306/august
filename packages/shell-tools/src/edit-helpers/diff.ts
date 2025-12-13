/**
 * Diff generation utilities for the edit tool
 */

import { createTwoFilesPatch } from "diff";

/**
 * Generate a unified diff between two versions of a file
 */
export function generateDiff(
  filePath: string,
  before: string,
  after: string
): string {
  const diff = createTwoFilesPatch(
    filePath,
    filePath,
    before,
    after,
    "original",
    "modified"
  );
  return trimDiffHeaders(diff);
}

/**
 * Trim the redundant headers from diff output for cleaner display
 */
function trimDiffHeaders(diff: string): string {
  const lines = diff.split("\n");
  // Skip the first 2 lines (--- and +++ headers) as they're redundant
  // when showing the file path separately
  if (lines.length > 2 && lines[0]?.startsWith("===")) {
    return lines.slice(1).join("\n");
  }
  return diff;
}

/**
 * Count additions and deletions in the diff
 */
export function countChanges(
  before: string,
  after: string
): { additions: number; deletions: number } {
  // Generate a unified diff and parse it to count actual changes
  const diff = createTwoFilesPatch(
    "file",
    "file",
    before,
    after,
    "original",
    "modified"
  );

  let additions = 0;
  let deletions = 0;

  // Parse the unified diff output
  const lines = diff.split("\n");
  for (const line of lines) {
    // Lines starting with + (but not +++) are additions
    if (line.startsWith("+") && !line.startsWith("+++")) {
      additions++;
    }
    // Lines starting with - (but not ---) are deletions
    else if (line.startsWith("-") && !line.startsWith("---")) {
      deletions++;
    }
  }

  return { additions, deletions };
}
