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
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");

  // Simple line-based diff counting
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);

  let deletions = 0;
  let additions = 0;

  for (const line of beforeLines) {
    if (!afterSet.has(line)) {
      deletions++;
    }
  }

  for (const line of afterLines) {
    if (!beforeSet.has(line)) {
      additions++;
    }
  }

  return { additions, deletions };
}
