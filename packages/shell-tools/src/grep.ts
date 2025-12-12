import { spawn } from "child_process";
import { rgPath } from "@vscode/ripgrep";
import { z } from "zod";

// Input schema for the grep tool
export const GrepInputSchema = z.object({
  pattern: z.string().describe("The regex pattern to search for in file contents"),
  path: z.string().describe("File or directory path to search in"),
  ignoreCase: z
    .boolean()
    .optional()
    .describe("Case insensitive search. Defaults to false."),
  lineNumbers: z
    .boolean()
    .optional()
    .describe("Include line numbers in output. Defaults to true."),
  filesWithMatches: z
    .boolean()
    .optional()
    .describe("Only return file names that match, not the matching lines."),
  hidden: z
    .boolean()
    .optional()
    .describe("Include hidden files and directories in the search."),
  followSymlinks: z
    .boolean()
    .optional()
    .describe("Follow symbolic links when searching directories."),
  glob: z
    .string()
    .optional()
    .describe("Glob pattern to filter files, e.g. '*.ts' or '**/*.json'"),
  maxCount: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Maximum number of matches to return per file."),
  before: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Number of context lines to show before each match."),
  after: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Number of context lines to show after each match."),
});

export type GrepInput = z.infer<typeof GrepInputSchema>;

// Output schemas
export const GrepMatchSchema = z.object({
  path: z.string().describe("The file path where the match was found"),
  lineNumber: z
    .number()
    .optional()
    .describe("The line number of the match (1-indexed)"),
  column: z
    .number()
    .optional()
    .describe("The column position where the match starts (0-indexed)"),
  text: z.string().describe("The text content of the matching line"),
});

export type GrepMatch = z.infer<typeof GrepMatchSchema>;

export const GrepOutputSchema = z.object({
  matches: z.array(GrepMatchSchema).describe("Array of matches found"),
  exitCode: z
    .number()
    .describe(
      "Exit code from ripgrep. 0 = matches found, 1 = no matches, 2 = error"
    ),
});

export type GrepOutput = z.infer<typeof GrepOutputSchema>;

// Tool definition for Anthropic's tool use API
export const grepToolDefinition = {
  name: "grep",
  description:
    "Search for a regex pattern in files using ripgrep. This tool searches file contents and returns matching lines with their locations. Use it to find specific code patterns, text content, or to explore a codebase. Supports glob patterns to filter which files to search.",
  inputSchema: GrepInputSchema,
  outputSchema: GrepOutputSchema,
};

/**
 * Search for a pattern in files using ripgrep
 */
export async function grep(input: GrepInput): Promise<GrepOutput> {
  // Validate input with Zod
  const options = GrepInputSchema.parse(input);

  const args: string[] = ["--json"];

  if (options.ignoreCase) {
    args.push("--ignore-case");
  }

  if (options.lineNumbers !== false) {
    args.push("--line-number");
  }

  if (options.filesWithMatches) {
    args.push("--files-with-matches");
  }

  if (options.hidden) {
    args.push("--hidden");
  }

  if (options.followSymlinks) {
    args.push("--follow");
  }

  if (options.glob) {
    args.push("--glob", options.glob);
  }

  if (options.maxCount !== undefined) {
    args.push("--max-count", String(options.maxCount));
  }

  if (options.before !== undefined) {
    args.push("--before-context", String(options.before));
  }

  if (options.after !== undefined) {
    args.push("--after-context", String(options.after));
  }

  args.push(options.pattern, options.path);

  return new Promise((resolve, reject) => {
    const rg = spawn(rgPath, args);
    const matches: GrepMatch[] = [];
    let stdout = "";
    let stderr = "";

    rg.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    rg.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    rg.on("close", (exitCode) => {
      // Parse JSON output
      const lines = stdout.split("\n").filter(Boolean);

      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.type === "match") {
            const data = json.data;
            matches.push({
              path: data.path.text,
              lineNumber: data.line_number,
              column: data.submatches?.[0]?.start,
              text: data.lines.text.replace(/\n$/, ""),
            });
          }
        } catch {
          // Skip malformed JSON lines
        }
      }

      resolve({
        matches,
        exitCode: exitCode ?? 0,
      });
    });

    rg.on("error", (err) => {
      reject(err);
    });
  });
}
