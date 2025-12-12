import { spawn } from "child_process";
import { rgPath } from "@vscode/ripgrep";
import { z } from "zod";
import { stat } from "fs/promises";

const MAX_FILES = 100;

// Input schema for the glob tool
export const GlobInputSchema = z.object({
  pattern: z
    .string()
    .describe(
      "Glob pattern to match files (e.g. '**/*.ts', 'src/**/*.{js,jsx}')"
    ),
  path: z
    .string()
    .optional()
    .describe("Directory to search in. Defaults to current working directory."),
});

export type GlobInput = z.infer<typeof GlobInputSchema>;

// Output schema
export const GlobOutputSchema = z.object({
  title: z.string().describe("The glob pattern used"),
  metadata: z.object({
    count: z.number().describe("Number of files found"),
    truncated: z.boolean().describe("Whether results were truncated"),
  }),
  output: z.string().describe("Newline-separated list of matching file paths"),
});

export type GlobOutput = z.infer<typeof GlobOutputSchema>;

// Tool definition for Anthropic's tool use API
export const globToolDefinition = {
  name: "glob",
  description:
    "Fast file pattern matching tool that works with any codebase size. Supports glob patterns like '**/*.js' or 'src/**/*.ts'. Returns matching file paths sorted by modification time (newest first). Use this when you need to find files by name patterns.",
  inputSchema: GlobInputSchema,
  outputSchema: GlobOutputSchema,
};

interface FileWithMtime {
  path: string;
  modTime: number;
}

/**
 * Find files matching a glob pattern using ripgrep
 */
export async function glob(input: GlobInput): Promise<GlobOutput> {
  const options = GlobInputSchema.parse(input);

  if (!options.pattern) {
    throw new Error("pattern is required");
  }

  const searchPath = options.path ?? process.cwd();

  // ripgrep args for file listing with glob pattern
  const args = [
    "--files", // List files only (no content search)
    "--glob",
    options.pattern, // Glob pattern filter
    searchPath,
  ];

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
      // Exit code 1 = no matches (not an error)
      if (exitCode === 1) {
        resolve({
          title: options.pattern,
          metadata: { count: 0, truncated: false },
          output: "No files found",
        });
        return;
      }

      // Exit code 2 = error (invalid pattern, permission denied, etc.)
      if (exitCode === 2) {
        reject(new Error(`ripgrep error: ${stderr || 'unknown error'}`));
        return;
      }

      if (exitCode !== 0 && exitCode !== null) {
        reject(new Error(`ripgrep failed with exit code ${exitCode}: ${stderr}`));
        return;
      }

      const lines = stdout.trim().split("\n");
      const files: FileWithMtime[] = [];

      for (const line of lines) {
        if (!line) continue;

        try {
          const stats = await stat(line);
          files.push({
            path: line,
            modTime: stats.mtime.getTime(),
          });
        } catch {
          // Skip files we can't stat
          continue;
        }
      }

      // Sort by modification time (most recent first)
      files.sort((a, b) => b.modTime - a.modTime);

      const truncated = files.length > MAX_FILES;
      const finalFiles = truncated ? files.slice(0, MAX_FILES) : files;

      if (finalFiles.length === 0) {
        resolve({
          title: options.pattern,
          metadata: { count: 0, truncated: false },
          output: lines.length > 0
            ? "Files found but could not be accessed"
            : "No files found",
        });
        return;
      }

      const outputLines = finalFiles.map((f) => f.path);

      if (truncated) {
        outputLines.push("");
        outputLines.push(
          "(Results are truncated. Consider using a more specific path or pattern.)"
        );
      }

      resolve({
        title: options.pattern,
        metadata: {
          count: finalFiles.length,
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
