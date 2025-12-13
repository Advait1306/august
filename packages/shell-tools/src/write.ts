/**
 * Write tool for creating new files or completely overwriting existing files
 *
 * Supports automatic parent directory creation and generates unified diffs
 * to show what was written.
 */

import { z } from "zod";
import { readFile, writeFile, stat, mkdir } from "fs/promises";
import { isAbsolute, dirname } from "path";
import {
  WriteError,
  WriteErrorType,
  createInvalidPathError,
  createPathIsDirectoryError,
  createPermissionDeniedError,
  createNoSpaceError,
  createWriteFailedError,
} from "./write/validation";
import { generateDiff, countChanges } from "./edit/diff";

// Input schema for the write tool
export const WriteInputSchema = z.object({
  filePath: z.string().describe("Absolute path to the file to write"),
  content: z.string().describe("The content to write to the file"),
});

export type WriteInput = z.infer<typeof WriteInputSchema>;

// Output schema
export const WriteOutputSchema = z.object({
  title: z.string().describe("Description of the write operation"),
  metadata: z.object({
    filePath: z.string().describe("Path to the written file"),
    created: z.boolean().describe("Whether a new file was created"),
    linesWritten: z.number().describe("Number of lines written"),
  }),
  output: z.string().describe("Unified diff showing the changes"),
});

export type WriteOutput = z.infer<typeof WriteOutputSchema>;

// Tool definition for Anthropic's tool use API
export const writeToolDefinition = {
  name: "write",
  description:
    "Writes content to a file, creating a new file or completely overwriting an existing file. Automatically creates parent directories if they don't exist. Returns a unified diff showing the changes.",
  inputSchema: WriteInputSchema,
  outputSchema: WriteOutputSchema,
};

/**
 * Write content to a file
 */
export async function write(input: WriteInput): Promise<WriteOutput> {
  const options = WriteInputSchema.parse(input);
  const { filePath, content } = options;

  // Validate path is absolute
  if (!isAbsolute(filePath)) {
    throw createInvalidPathError(filePath);
  }

  // Check if path exists and is a directory
  let fileExists = false;
  try {
    const fileStats = await stat(filePath);
    if (fileStats.isDirectory()) {
      throw createPathIsDirectoryError(filePath);
    }
    fileExists = true;
  } catch (err) {
    // If it's our own error, rethrow it
    if (err instanceof WriteError) {
      throw err;
    }
    // Otherwise file doesn't exist, which is fine - we'll create it
    fileExists = false;
  }

  // Read existing content for diff generation (if file exists)
  let originalContent = "";
  if (fileExists) {
    try {
      originalContent = await readFile(filePath, "utf-8");
    } catch {
      // If we can't read it, treat as empty for diff purposes
      originalContent = "";
    }
  }

  // Create parent directories if needed
  const parentDir = dirname(filePath);
  try {
    await mkdir(parentDir, { recursive: true });
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "EACCES") {
      throw createPermissionDeniedError(parentDir);
    }
    // Ignore other errors - the write will fail with a better message
  }

  // Write the file
  try {
    await writeFile(filePath, content, "utf-8");
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "EACCES") {
      throw createPermissionDeniedError(filePath);
    }
    if (error.code === "ENOSPC") {
      throw createNoSpaceError(filePath);
    }
    throw createWriteFailedError(
      filePath,
      error.message || String(err)
    );
  }

  // Generate diff and calculate stats
  const diff = generateDiff(filePath, originalContent, content);
  const { additions } = countChanges(originalContent, content);

  // Calculate lines written (use additions from diff which shows actual new lines)
  const linesWritten = content === "" ? 0 : content.split("\n").length;

  return {
    title: fileExists ? `Overwrote ${filePath}` : `Created ${filePath}`,
    metadata: {
      filePath,
      created: !fileExists,
      linesWritten,
    },
    output: diff,
  };
}

// Re-export error types for consumers
export { WriteError, WriteErrorType };
