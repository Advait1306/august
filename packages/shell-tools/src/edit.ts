/**
 * Edit tool for performing exact string replacements in files
 *
 * Uses cascading match strategies to handle common whitespace and
 * indentation mismatches while maintaining precision.
 */

import { z } from "zod";
import { readFile, writeFile, stat } from "fs/promises";
import { isAbsolute } from "path";
import {
  EditError,
  EditErrorType,
  createFileNotFoundError,
  createPathIsDirectoryError,
  createNoMatchError,
  createMultipleMatchesError,
  createNoChangeError,
  createWriteFailedError,
  createInvalidPathError,
} from "./edit/validation";
import {
  detectLineEnding,
  normalizeLineEndings,
  restoreLineEndings,
  safeLiteralReplace,
  safeLiteralReplaceAll,
  countOccurrences,
} from "./edit/utils";
import { findMatch } from "./edit/replacers";
import { generateDiff, countChanges } from "./edit/diff";

// Input schema for the edit tool
export const EditInputSchema = z.object({
  filePath: z.string().describe("Absolute path to the file to modify"),
  oldString: z.string().describe("The exact text to find and replace"),
  newString: z.string().describe("The replacement text"),
  replaceAll: z
    .boolean()
    .optional()
    .default(false)
    .describe("Replace all occurrences instead of requiring unique match"),
});

// Use z.input for the input type so replaceAll is optional for callers
export type EditInput = z.input<typeof EditInputSchema>;

// Output schema
export const EditOutputSchema = z.object({
  title: z.string().describe("Description of the edit operation"),
  metadata: z.object({
    filePath: z.string().describe("Path to the modified file"),
    replacements: z.number().describe("Number of replacements made"),
    additions: z.number().describe("Number of lines added"),
    deletions: z.number().describe("Number of lines deleted"),
  }),
  output: z.string().describe("Unified diff showing the changes"),
});

export type EditOutput = z.infer<typeof EditOutputSchema>;

// Tool definition for Anthropic's tool use API
export const editToolDefinition = {
  name: "edit",
  description:
    "Performs exact string replacements in files. Requires the file path, the exact text to find (oldString), and the replacement text (newString). By default requires a unique match; use replaceAll: true to replace all occurrences. Supports cascading match strategies for handling whitespace/indentation differences.",
  inputSchema: EditInputSchema,
  outputSchema: EditOutputSchema,
};

/**
 * Edit a file by replacing oldString with newString
 */
export async function edit(input: EditInput): Promise<EditOutput> {
  const options = EditInputSchema.parse(input);
  const { filePath, oldString, newString, replaceAll } = options;

  // Validate input
  if (!isAbsolute(filePath)) {
    throw createInvalidPathError(filePath);
  }

  if (oldString === newString) {
    throw createNoChangeError();
  }

  // Check if file exists and is not a directory
  let fileStats;
  try {
    fileStats = await stat(filePath);
  } catch {
    // If oldString is empty, this is file creation - but we don't support that
    // in this tool (use Write tool instead)
    throw createFileNotFoundError(filePath);
  }

  if (fileStats.isDirectory()) {
    throw createPathIsDirectoryError(filePath);
  }

  // Read the file
  const originalContent = await readFile(filePath, "utf-8");

  // Detect and normalize line endings
  const lineEnding = detectLineEnding(originalContent);
  const normalizedContent = normalizeLineEndings(originalContent);
  const normalizedOldString = normalizeLineEndings(oldString);
  const normalizedNewString = normalizeLineEndings(newString);

  // Find a match using cascading strategies
  const matchResult = findMatch(normalizedContent, normalizedOldString, replaceAll);

  if (!matchResult) {
    // Check if there are multiple matches for better error message
    const exactCount = countOccurrences(normalizedContent, normalizedOldString);
    if (exactCount > 1) {
      throw createMultipleMatchesError(exactCount);
    }
    throw createNoMatchError();
  }

  const { match, occurrences } = matchResult;

  // If not replaceAll and multiple occurrences, error
  if (!replaceAll && occurrences > 1) {
    throw createMultipleMatchesError(occurrences);
  }

  // Perform the replacement
  let newContent: string;
  if (replaceAll) {
    newContent = safeLiteralReplaceAll(normalizedContent, match, normalizedNewString);
  } else {
    newContent = safeLiteralReplace(normalizedContent, match, normalizedNewString);
  }

  // Restore original line endings
  const finalContent = restoreLineEndings(newContent, lineEnding);

  // Write the file
  try {
    await writeFile(filePath, finalContent, "utf-8");
  } catch (err) {
    throw createWriteFailedError(
      filePath,
      err instanceof Error ? err.message : String(err)
    );
  }

  // Generate diff and count changes
  const diff = generateDiff(filePath, originalContent, finalContent);
  const { additions, deletions } = countChanges(originalContent, finalContent);

  return {
    title: `Edited ${filePath}`,
    metadata: {
      filePath,
      replacements: replaceAll ? occurrences : 1,
      additions,
      deletions,
    },
    output: diff,
  };
}

// Re-export error types for consumers
export { EditError, EditErrorType };
