import { spawn } from "child_process";
import { rgPath } from "@vscode/ripgrep";
import { z } from "zod";
import { stat } from "fs/promises";

const MAX_LINE_LENGTH = 2000;
const MAX_MATCHES = 100;

// Input schema for the grep tool
export const GrepInputSchema = z.object({
  pattern: z
    .string()
    .describe("The regex pattern to search for in file contents"),
  path: z
    .string()
    .describe("The file or directory to search in."),
  include: z
    .string()
    .optional()
    .describe('File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")'),
});

export type GrepInput = z.infer<typeof GrepInputSchema>;

// Output schema
export const GrepOutputSchema = z.object({
  title: z.string().describe("The search pattern used"),
  metadata: z.object({
    matches: z.number().describe("Number of matches found"),
    truncated: z.boolean().describe("Whether results were truncated"),
  }),
  output: z.string().describe("Formatted output of matches"),
});

export type GrepOutput = z.infer<typeof GrepOutputSchema>;

// Tool definition for Anthropic's tool use API
export const grepToolDefinition = {
  name: "grep",
  version: "0.0.1",
  description:
    "Fast content search tool that works with any codebase size. Searches file contents using regular expressions. Supports full regex syntax (e.g. 'log.*Error', 'function\\s+\\w+'). Filter files by pattern with the include parameter (e.g. '*.js', '*.{ts,tsx}'). Returns file paths and line numbers with matches sorted by modification time.",
  inputSchema: GrepInputSchema,
  outputSchema: GrepOutputSchema,
};

interface Match {
  path: string;
  modTime: number;
  lineNum: number;
  lineText: string;
}

/**
 * Search for a pattern in files using ripgrep
 */
export async function grep(input: GrepInput): Promise<GrepOutput> {
  const options = GrepInputSchema.parse(input);

  if (!options.pattern) {
    throw new Error("pattern is required");
  }

  const searchPath = options.path;

  const args = ["-nH", "--field-match-separator=|", "--regexp", options.pattern];
  if (options.include) {
    args.push("--glob", options.include);
  }
  args.push(searchPath);

  return new Promise((resolve, reject) => {
    const rg = spawn(rgPath, args);
    let stdout = "";
    let stderr = "";

    rg.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    rg.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    rg.on("close", async (exitCode) => {
      if (exitCode === 1) {
        resolve({
          title: options.pattern,
          metadata: { matches: 0, truncated: false },
          output: "No files found",
        });
        return;
      }

      if (exitCode !== 0 && exitCode !== null) {
        reject(new Error(`ripgrep failed with exit code ${exitCode}: ${stderr}`));
        return;
      }

      const lines = stdout.trim().split("\n");
      const matches: Match[] = [];

      for (const line of lines) {
        if (!line) continue;

        const [filePath, lineNumStr, ...lineTextParts] = line.split("|");
        if (!filePath || !lineNumStr || lineTextParts.length === 0) continue;

        const lineNum = parseInt(lineNumStr, 10);
        const lineText = lineTextParts.join("|");

        try {
          const stats = await stat(filePath);
          matches.push({
            path: filePath,
            modTime: stats.mtime.getTime(),
            lineNum,
            lineText,
          });
        } catch {
          // Skip files we can't stat
          continue;
        }
      }

      // Sort by modification time (most recent first)
      matches.sort((a, b) => b.modTime - a.modTime);

      const truncated = matches.length > MAX_MATCHES;
      const finalMatches = truncated ? matches.slice(0, MAX_MATCHES) : matches;

      if (finalMatches.length === 0) {
        resolve({
          title: options.pattern,
          metadata: { matches: 0, truncated: false },
          output: "No files found",
        });
        return;
      }

      const outputLines = [`Found ${finalMatches.length} matches`];

      let currentFile = "";
      for (const match of finalMatches) {
        if (currentFile !== match.path) {
          if (currentFile !== "") {
            outputLines.push("");
          }
          currentFile = match.path;
          outputLines.push(`${match.path}:`);
        }
        const truncatedLineText =
          match.lineText.length > MAX_LINE_LENGTH
            ? match.lineText.substring(0, MAX_LINE_LENGTH) + "..."
            : match.lineText;
        outputLines.push(`  Line ${match.lineNum}: ${truncatedLineText}`);
      }

      if (truncated) {
        outputLines.push("");
        outputLines.push(
          "(Results are truncated. Consider using a more specific path or pattern.)"
        );
      }

      resolve({
        title: options.pattern,
        metadata: {
          matches: finalMatches.length,
          truncated,
        },
        output: outputLines.join("\n"),
      });
    });

    rg.on("error", (err) => {
      reject(err);
    });
  });
}
