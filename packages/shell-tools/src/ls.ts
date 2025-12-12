import { readdir, stat } from "fs/promises";
import { z } from "zod";
import { isAbsolute } from "path";

const MAX_ENTRIES = 100;

const DEFAULT_IGNORE = ["node_modules", ".git", "__pycache__", ".DS_Store"];

// Input schema for the ls tool
export const LsInputSchema = z.object({
  path: z
    .string()
    .describe(
      "The absolute path to the directory to list (must be absolute, not relative)"
    ),
  ignore: z
    .array(z.string())
    .optional()
    .describe("List of glob patterns to ignore"),
});

export type LsInput = z.infer<typeof LsInputSchema>;

// Output schema
export const LsOutputSchema = z.object({
  title: z.string().describe("The directory path listed"),
  metadata: z.object({
    count: z.number().describe("Number of entries found"),
    truncated: z.boolean().describe("Whether results were truncated"),
  }),
  output: z
    .string()
    .describe("Directory listing with [DIR] prefix for directories"),
});

export type LsOutput = z.infer<typeof LsOutputSchema>;

// Tool definition for Anthropic's tool use API
export const lsToolDefinition = {
  name: "ls",
  description:
    "List files and directories in a given path. Returns entries sorted with directories first (prefixed with [DIR]), then files, both alphabetically. Hidden files are included by default. Results are limited to 100 entries.",
  inputSchema: LsInputSchema,
  outputSchema: LsOutputSchema,
};

interface Entry {
  name: string;
  isDirectory: boolean;
}

/**
 * Check if an entry matches any of the ignore patterns
 * Supports exact matches and simple glob patterns (* and **)
 */
function shouldIgnore(name: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    // Exact match
    if (pattern === name) return true;

    // Simple glob: *.ext matches files ending with .ext
    if (pattern.startsWith("*.")) {
      const ext = pattern.slice(1); // ".ext"
      return name.endsWith(ext);
    }

    // Simple glob: prefix* matches files starting with prefix
    if (pattern.endsWith("*") && !pattern.startsWith("*")) {
      const prefix = pattern.slice(0, -1);
      return name.startsWith(prefix);
    }

    return false;
  });
}

/**
 * List files and directories in a path
 */
export async function ls(input: LsInput): Promise<LsOutput> {
  const options = LsInputSchema.parse(input);

  if (!options.path) {
    throw new Error("path is required");
  }

  if (!isAbsolute(options.path)) {
    throw new Error("path must be absolute");
  }

  // Validate path exists and is a directory
  let stats;
  try {
    stats = await stat(options.path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Path does not exist: ${options.path}`);
    }
    throw error;
  }

  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${options.path}`);
  }

  // Merge default ignore patterns with custom ones
  const ignorePatterns = [...DEFAULT_IGNORE, ...(options.ignore ?? [])];

  // Read directory entries
  const dirents = await readdir(options.path, { withFileTypes: true });

  // Filter and collect entries
  const entries: Entry[] = [];
  let ignoredCount = 0;

  for (const dirent of dirents) {
    if (shouldIgnore(dirent.name, ignorePatterns)) {
      ignoredCount++;
      continue;
    }

    entries.push({
      name: dirent.name,
      isDirectory: dirent.isDirectory(),
    });
  }

  // Sort: directories first, then files, both alphabetically
  entries.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  // Handle empty directory
  if (entries.length === 0) {
    const outputLines = [`Directory listing for ${options.path}:`, ""];
    if (ignoredCount > 0) {
      outputLines.push(`Empty directory (${ignoredCount} ignored)`);
    } else {
      outputLines.push("Empty directory");
    }

    return {
      title: options.path,
      metadata: { count: 0, truncated: false },
      output: outputLines.join("\n"),
    };
  }

  // Truncate if necessary
  const truncated = entries.length > MAX_ENTRIES;
  const finalEntries = truncated ? entries.slice(0, MAX_ENTRIES) : entries;

  // Format output
  const outputLines = [`Directory listing for ${options.path}:`];

  for (const entry of finalEntries) {
    if (entry.isDirectory) {
      outputLines.push(`[DIR] ${entry.name}`);
    } else {
      outputLines.push(entry.name);
    }
  }

  // Add footer with ignored count and truncation warning
  if (ignoredCount > 0 || truncated) {
    outputLines.push("");
    const footerParts: string[] = [];
    if (ignoredCount > 0) {
      footerParts.push(`${ignoredCount} ignored`);
    }
    if (truncated) {
      footerParts.push(
        `results truncated to ${MAX_ENTRIES} entries (${entries.length} total)`
      );
    }
    outputLines.push(`(${footerParts.join(", ")})`);
  }

  return {
    title: options.path,
    metadata: {
      count: finalEntries.length,
      truncated,
    },
    output: outputLines.join("\n"),
  };
}
