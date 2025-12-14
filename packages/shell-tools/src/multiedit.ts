/**
 * MultiEdit tool for performing multiple edit operations on a single file
 *
 * Allows multiple edit operations in one tool call, reducing context usage
 * and improving efficiency. Uses atomic semantics - if any edit fails
 * validation, no changes are made to the file.
 */

import { z } from "zod";
import { readFile, writeFile, stat } from "fs/promises";
import { isAbsolute } from "path";
import { EditError, EditErrorType } from "./edit-helpers/validation";
import {
  detectLineEnding,
  normalizeLineEndings,
  restoreLineEndings,
  safeLiteralReplace,
  safeLiteralReplaceAll,
  countOccurrences,
} from "./edit-helpers/utils";
import { findMatch } from "./edit-helpers/replacers";
import { generateDiff, countChanges } from "./edit-helpers/diff";

// Individual edit operation schema
export const MultiEditOperationSchema = z.object({
  oldString: z.string().describe("The text to replace"),
  newString: z.string().describe("The text to replace it with"),
  replaceAll: z
    .boolean()
    .optional()
    .default(false)
    .describe("Replace all occurrences"),
});

export type MultiEditOperation = z.infer<typeof MultiEditOperationSchema>;

// Input schema for the multiedit tool
export const MultiEditInputSchema = z.object({
  filePath: z.string().describe("Absolute path to the file to modify"),
  edits: z
    .array(MultiEditOperationSchema)
    .min(1)
    .describe("Array of edit operations to perform sequentially"),
});

// Use z.input for the input type so replaceAll is optional for callers
export type MultiEditInput = z.input<typeof MultiEditInputSchema>;

// Individual edit result
const EditResultSchema = z.object({
  index: z.number().describe("0-indexed position of this edit"),
  replacements: z.number().describe("Number of replacements made"),
  additions: z.number().describe("Number of lines added"),
  deletions: z.number().describe("Number of lines deleted"),
  success: z.boolean().describe("Whether this edit succeeded"),
  error: z.string().optional().describe("Error message if edit failed"),
});

export type EditResult = z.infer<typeof EditResultSchema>;

// Output schema
export const MultiEditOutputSchema = z.object({
  title: z.string().describe("Description of the edit operation"),
  metadata: z.object({
    filePath: z.string().describe("Path to the modified file"),
    totalReplacements: z.number().describe("Total replacements made"),
    totalAdditions: z.number().describe("Total lines added"),
    totalDeletions: z.number().describe("Total lines deleted"),
    editResults: z
      .array(EditResultSchema)
      .describe("Results for each edit operation"),
  }),
  output: z.string().describe("Unified diff showing all changes"),
});

export type MultiEditOutput = z.infer<typeof MultiEditOutputSchema>;

// Error type for multiedit operations
export enum MultiEditErrorType {
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  PATH_IS_DIRECTORY = "PATH_IS_DIRECTORY",
  INVALID_PATH = "INVALID_PATH",
  NO_MATCH_FOUND = "NO_MATCH_FOUND",
  MULTIPLE_MATCHES = "MULTIPLE_MATCHES",
  NO_CHANGE = "NO_CHANGE",
  WRITE_FAILED = "WRITE_FAILED",
  VALIDATION_FAILED = "VALIDATION_FAILED",
  EMPTY_EDITS = "EMPTY_EDITS",
}

export class MultiEditError extends Error {
  constructor(
    public editIndex: number,
    public type: MultiEditErrorType,
    message: string
  ) {
    super(`Edit ${editIndex + 1}: ${message}`);
    this.name = "MultiEditError";
  }
}

// Tool definition for Anthropic's tool use API
export const multieditToolDefinition = {
  name: "multiedit",
  description: `Performs multiple exact string replacements in a single file in one operation.

Use this tool instead of multiple 'edit' calls when making several changes to the same file. All edits are applied sequentially in the order provided.

IMPORTANT:
- Edits are applied in order - each edit operates on the result of previous edits
- If any edit fails validation, NO changes are made to the file
- Use replaceAll: true only when you want to replace ALL occurrences

Parameters:
- filePath: Absolute path to the file to modify
- edits: Array of edit operations, each with:
  - oldString: Text to find (exact match, including whitespace)
  - newString: Replacement text (must differ from oldString)
  - replaceAll: Optional, replace all occurrences (default: false)`,
  inputSchema: MultiEditInputSchema,
  outputSchema: MultiEditOutputSchema,
};

/**
 * Perform multiple edit operations on a single file
 *
 * All edits are validated first before any changes are made.
 * If validation passes, all edits are applied in order and the
 * result is written to disk.
 */
export async function multiedit(
  input: MultiEditInput
): Promise<MultiEditOutput> {
  const options = MultiEditInputSchema.parse(input);
  const { filePath, edits } = options;

  // Validate input
  if (!isAbsolute(filePath)) {
    throw new MultiEditError(
      -1,
      MultiEditErrorType.INVALID_PATH,
      `Invalid path: ${filePath}. Path must be absolute.`
    );
  }

  // Check if file exists and is not a directory
  let fileStats;
  try {
    fileStats = await stat(filePath);
  } catch {
    throw new MultiEditError(
      -1,
      MultiEditErrorType.FILE_NOT_FOUND,
      `File not found: ${filePath}`
    );
  }

  if (fileStats.isDirectory()) {
    throw new MultiEditError(
      -1,
      MultiEditErrorType.PATH_IS_DIRECTORY,
      `Path is a directory, not a file: ${filePath}`
    );
  }

  // Read the file
  const originalContent = await readFile(filePath, "utf-8");

  // Detect and normalize line endings
  const lineEnding = detectLineEnding(originalContent);
  let content = normalizeLineEndings(originalContent);
  const normalizedOriginal = content;

  // Track results for each edit
  const editResults: EditResult[] = [];

  // Apply each edit sequentially
  for (const [index, editOp] of edits.entries()) {
    const normalizedOldString = normalizeLineEndings(editOp.oldString);
    const normalizedNewString = normalizeLineEndings(editOp.newString);
    const replaceAll = editOp.replaceAll ?? false;

    // Validate strings are different
    if (normalizedOldString === normalizedNewString) {
      throw new MultiEditError(
        index,
        MultiEditErrorType.NO_CHANGE,
        "oldString and newString are identical. No changes to make."
      );
    }

    // Find a match using cascading strategies
    const matchResult = findMatch(content, normalizedOldString, replaceAll);

    if (!matchResult) {
      // Check if there are multiple matches for better error message
      const exactCount = countOccurrences(content, normalizedOldString);
      if (exactCount > 1) {
        throw new MultiEditError(
          index,
          MultiEditErrorType.MULTIPLE_MATCHES,
          `Found ${exactCount} occurrences of oldString. Provide more surrounding context to identify unique match, or use replaceAll: true.`
        );
      }
      throw new MultiEditError(
        index,
        MultiEditErrorType.NO_MATCH_FOUND,
        "oldString not found in file. Ensure exact match including whitespace and indentation."
      );
    }

    const { match, occurrences } = matchResult;

    // If not replaceAll and multiple occurrences, error
    if (!replaceAll && occurrences > 1) {
      throw new MultiEditError(
        index,
        MultiEditErrorType.MULTIPLE_MATCHES,
        `Found ${occurrences} occurrences of oldString. Provide more surrounding context to identify unique match, or use replaceAll: true.`
      );
    }

    // Track content before this edit for per-edit diff
    const contentBeforeEdit = content;

    // Perform the replacement
    if (replaceAll) {
      content = safeLiteralReplaceAll(content, match, normalizedNewString);
    } else {
      content = safeLiteralReplace(content, match, normalizedNewString);
    }

    // Calculate per-edit changes
    const { additions, deletions } = countChanges(contentBeforeEdit, content);

    editResults.push({
      index,
      replacements: replaceAll ? occurrences : 1,
      additions,
      deletions,
      success: true,
    });
  }

  // Restore original line endings
  const finalContent = restoreLineEndings(content, lineEnding);

  // Write the file
  try {
    await writeFile(filePath, finalContent, "utf-8");
  } catch (err) {
    throw new MultiEditError(
      -1,
      MultiEditErrorType.WRITE_FAILED,
      `Failed to write file ${filePath}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Generate diff and count total changes
  const diff = generateDiff(filePath, originalContent, finalContent);
  const { additions: totalAdditions, deletions: totalDeletions } = countChanges(
    normalizedOriginal,
    content
  );

  const totalReplacements = editResults.reduce(
    (sum, r) => sum + r.replacements,
    0
  );

  return {
    title: `Edited ${filePath} (${edits.length} operations)`,
    metadata: {
      filePath,
      totalReplacements,
      totalAdditions,
      totalDeletions,
      editResults,
    },
    output: diff,
  };
}

// Re-export error types for consumers
export { EditError, EditErrorType };
