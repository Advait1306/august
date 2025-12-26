/**
 * Bash tool for executing shell commands
 *
 * Provides a safe interface for running shell commands with:
 * - Configurable timeouts
 * - Output capture and truncation
 * - Working directory support
 * - Abort signal handling
 * - Cross-platform shell selection
 */

import { spawn, type ChildProcess } from "child_process";
import { stat } from "fs/promises";
import { isAbsolute, basename } from "path";
import { z } from "zod";
import {
  BashError,
  BashErrorType,
  createEmptyCommandError,
  createInvalidTimeoutError,
  createInvalidWorkdirError,
  createWorkdirNotFoundError,
  createWorkdirNotDirectoryError,
  createSpawnFailedError,
} from "./bash-helpers/validation";

/** Maximum output length before truncation (30KB) */
const MAX_OUTPUT_LENGTH = 30_000;

/** Default command timeout (2 minutes) */
const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;

/** Time to wait after SIGTERM before sending SIGKILL */
const SIGKILL_TIMEOUT_MS = 200;

// Input schema for the bash tool
export const BashInputSchema = z.object({
  command: z.string().describe("The shell command to execute"),
  timeout: z
    .number()
    .optional()
    .describe(
      `Optional timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS}). Set to 0 to disable timeout.`
    ),
  workdir: z
    .string()
    .describe(
      "The working directory to run the command in. Must be an absolute path."
    ),
  description: z
    .string()
    .optional()
    .describe(
      "Clear, concise description of what this command does in 5-10 words"
    ),
});

export type BashInput = z.infer<typeof BashInputSchema>;

// Output schema
export const BashOutputSchema = z.object({
  title: z.string().describe("Description of the command executed"),
  metadata: z.object({
    command: z.string().describe("The command that was executed"),
    workdir: z.string().describe("The working directory used"),
    exitCode: z.number().nullable().describe("Exit code of the command"),
    signal: z.string().nullable().describe("Signal that terminated the command"),
    timedOut: z.boolean().describe("Whether the command timed out"),
    aborted: z.boolean().describe("Whether the command was aborted"),
    truncated: z.boolean().describe("Whether output was truncated"),
  }),
  output: z.string().describe("The combined stdout and stderr output"),
});

export type BashOutput = z.infer<typeof BashOutputSchema>;

// Tool definition
export const bashToolDefinition = {
  name: "bash",
  version: "0.0.1",
  description:
    "Executes shell commands on the user's local machine. Use this tool (not code execution) when you need to run commands in the user's actual environment - for git operations, npm/yarn commands, build tools, file system access, or any task requiring access to the user's local files and installed tools. Supports configurable timeouts and working directory. Output is truncated if it exceeds 30KB.",
  inputSchema: BashInputSchema,
  outputSchema: BashOutputSchema,
};

/**
 * Options for streaming output updates
 */
export interface BashStreamOptions {
  /** Called when new output is available */
  onOutput?: (output: string) => void;
  /** Abort signal to cancel execution */
  signal?: AbortSignal;
}

/**
 * Get the appropriate shell for the current platform
 */
function getShell(): string | true {
  const userShell = process.env.SHELL;

  if (userShell) {
    const shellName = basename(userShell);
    // Avoid fish and nushell as they have incompatible syntax
    if (!["fish", "nu"].includes(shellName)) {
      return userShell;
    }
  }

  // macOS default
  if (process.platform === "darwin") {
    return "/bin/zsh";
  }

  // Windows - let Node pick COMSPEC
  if (process.platform === "win32") {
    return process.env.COMSPEC || "cmd.exe";
  }

  // Fallback - let Node.js handle it
  return true;
}

/**
 * Kill process and its children
 */
async function killProcessTree(
  proc: ChildProcess,
  exited: { value: boolean }
): Promise<void> {
  const pid = proc.pid;
  if (!pid || exited.value) {
    return;
  }

  if (process.platform === "win32") {
    // Windows: use taskkill to kill process tree
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(pid), "/f", "/t"], {
        stdio: "ignore",
      });
      killer.once("exit", () => resolve());
      killer.once("error", () => resolve());
    });
    return;
  }

  // Unix: send signals to process group
  try {
    process.kill(-pid, "SIGTERM");
    await new Promise((r) => setTimeout(r, SIGKILL_TIMEOUT_MS));
    if (!exited.value) {
      process.kill(-pid, "SIGKILL");
    }
  } catch {
    // Fallback to direct kill if process group kill fails
    try {
      proc.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, SIGKILL_TIMEOUT_MS));
      if (!exited.value) {
        proc.kill("SIGKILL");
      }
    } catch {
      // Process already dead
    }
  }
}

/**
 * Execute a shell command and return the result
 */
export async function bash(
  input: BashInput,
  options: BashStreamOptions = {}
): Promise<BashOutput> {
  const params = BashInputSchema.parse(input);
  const { command, timeout: timeoutInput, workdir, description } = params;

  // Validate command
  if (!command || command.trim() === "") {
    throw createEmptyCommandError();
  }

  // Validate timeout
  if (timeoutInput !== undefined && timeoutInput < 0) {
    throw createInvalidTimeoutError(timeoutInput);
  }
  const timeout = timeoutInput ?? DEFAULT_TIMEOUT_MS;

  // Validate working directory
  if (!isAbsolute(workdir)) {
    throw createInvalidWorkdirError(workdir);
  }
  let cwd = workdir;
  try {
    const stats = await stat(workdir);
    if (!stats.isDirectory()) {
      throw createWorkdirNotDirectoryError(workdir);
    }
  } catch (err) {
    if (err instanceof BashError) {
      throw err;
    }
    throw createWorkdirNotFoundError(workdir);
  }

  const shell = getShell();

  let output = "";
  let truncated = false;
  let timedOut = false;
  let aborted = false;
  const exited = { value: false };

  // Check if already aborted before spawning
  if (options.signal?.aborted) {
    aborted = true;
    const metadataTags = ["Command was aborted by user"];
    output = "\n\n<bash_metadata>\n" + metadataTags.join("\n") + "\n</bash_metadata>";

    const title = description || `Executed: ${command.slice(0, 50)}${command.length > 50 ? "..." : ""}`;

    return {
      title,
      metadata: {
        command,
        workdir: cwd,
        exitCode: null,
        signal: null,
        timedOut: false,
        aborted: true,
        truncated: false,
      },
      output,
    };
  }

  // Spawn the process
  let proc: ChildProcess;
  try {
    proc = spawn(command, {
      shell,
      cwd,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
      // Use process group on Unix for clean termination
      detached: process.platform !== "win32",
    });
  } catch (err) {
    throw createSpawnFailedError(
      err instanceof Error ? err.message : String(err)
    );
  }

  // Handle output streaming
  const appendOutput = (chunk: Buffer) => {
    if (!truncated && output.length < MAX_OUTPUT_LENGTH) {
      const text = chunk.toString();
      output += text;

      if (output.length > MAX_OUTPUT_LENGTH) {
        output = output.slice(0, MAX_OUTPUT_LENGTH);
        truncated = true;
      }

      options.onOutput?.(output);
    }
  };

  proc.stdout?.on("data", appendOutput);
  proc.stderr?.on("data", appendOutput);

  // Handle abort signal
  const abortHandler = () => {
    aborted = true;
    void killProcessTree(proc, exited);
  };

  options.signal?.addEventListener("abort", abortHandler, { once: true });

  // Set up timeout
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  if (timeout > 0) {
    timeoutTimer = setTimeout(() => {
      timedOut = true;
      void killProcessTree(proc, exited);
    }, timeout);
  }

  // Wait for process to complete
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
      options.signal?.removeEventListener("abort", abortHandler);
    };

    proc.once("exit", () => {
      exited.value = true;
      cleanup();
      resolve();
    });

    proc.once("error", (error) => {
      exited.value = true;
      cleanup();
      reject(error);
    });
  });

  // Build metadata tags
  const metadataTags: string[] = [];
  if (truncated) {
    metadataTags.push(
      `Output truncated: exceeded ${MAX_OUTPUT_LENGTH} character limit`
    );
  }
  if (timedOut) {
    metadataTags.push(`Command timed out after ${timeout}ms`);
  }
  if (aborted) {
    metadataTags.push("Command was aborted by user");
  }

  // Append metadata to output if any
  if (metadataTags.length > 0) {
    output +=
      "\n\n<bash_metadata>\n" + metadataTags.join("\n") + "\n</bash_metadata>";
  }

  const title = description || `Executed: ${command.slice(0, 50)}${command.length > 50 ? "..." : ""}`;

  return {
    title,
    metadata: {
      command,
      workdir: cwd,
      exitCode: proc.exitCode,
      signal: proc.signalCode,
      timedOut,
      aborted,
      truncated,
    },
    output,
  };
}

// Re-export error types for consumers
export { BashError, BashErrorType };
