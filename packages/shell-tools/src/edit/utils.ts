/**
 * Edit tool utility functions
 */

export type LineEnding = "\r\n" | "\n";

/**
 * Detect the dominant line ending in content
 */
export function detectLineEnding(content: string): LineEnding {
  const crlfCount = (content.match(/\r\n/g) || []).length;
  const lfCount = (content.match(/(?<!\r)\n/g) || []).length;
  return crlfCount > lfCount ? "\r\n" : "\n";
}

/**
 * Normalize all line endings to LF for consistent processing
 */
export function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

/**
 * Restore line endings to the original format
 */
export function restoreLineEndings(content: string, ending: LineEnding): string {
  if (ending === "\r\n") {
    return content.replace(/\n/g, "\r\n");
  }
  return content;
}

/**
 * Safe literal replace that handles $ escaping
 * (ECMAScript GetSubstitution issue where $& and $` have special meaning)
 */
export function safeLiteralReplace(
  content: string,
  search: string,
  replace: string
): string {
  if (search === "") return content;
  const index = content.indexOf(search);
  if (index === -1) return content;
  return content.slice(0, index) + replace + content.slice(index + search.length);
}

/**
 * Safe literal replace all occurrences
 */
export function safeLiteralReplaceAll(
  content: string,
  search: string,
  replace: string
): string {
  if (search === "") return content;

  let result = "";
  let lastIndex = 0;
  let index = content.indexOf(search);

  while (index !== -1) {
    result += content.slice(lastIndex, index) + replace;
    lastIndex = index + search.length;
    index = content.indexOf(search, lastIndex);
  }

  result += content.slice(lastIndex);
  return result;
}

/**
 * Count occurrences of a substring in content
 */
export function countOccurrences(content: string, search: string): number {
  if (search === "") return 0;

  let count = 0;
  let index = content.indexOf(search);

  while (index !== -1) {
    count++;
    index = content.indexOf(search, index + search.length);
  }

  return count;
}

/**
 * Standard Levenshtein distance implementation
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1, // substitution
          matrix[i]![j - 1]! + 1, // insertion
          matrix[i - 1]![j]! + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}

/**
 * Calculate similarity score between two strings (0-1, where 1 is identical)
 */
export function similarity(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}
