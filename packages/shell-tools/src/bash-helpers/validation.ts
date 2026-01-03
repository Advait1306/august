/**
 * Bash tool validation and error types
 */

export enum BashErrorType {
  EMPTY_COMMAND = "EMPTY_COMMAND",
  INVALID_TIMEOUT = "INVALID_TIMEOUT",
  INVALID_WORKDIR = "INVALID_WORKDIR",
  WORKDIR_NOT_FOUND = "WORKDIR_NOT_FOUND",
  WORKDIR_NOT_DIRECTORY = "WORKDIR_NOT_DIRECTORY",
  SPAWN_FAILED = "SPAWN_FAILED",
  EXECUTION_TIMEOUT = "EXECUTION_TIMEOUT",
  EXECUTION_ABORTED = "EXECUTION_ABORTED",
  EXECUTION_FAILED = "EXECUTION_FAILED",
}

export class BashError extends Error {
  constructor(
    public type: BashErrorType,
    message: string
  ) {
    super(message);
    this.name = "BashError";
  }
}

export function createEmptyCommandError(): BashError {
  return new BashError(
    BashErrorType.EMPTY_COMMAND,
    "Command cannot be empty"
  );
}

export function createInvalidTimeoutError(timeout: number): BashError {
  return new BashError(
    BashErrorType.INVALID_TIMEOUT,
    `Invalid timeout value: ${timeout}. Timeout must be a positive number.`
  );
}

export function createInvalidWorkdirError(workdir: string): BashError {
  return new BashError(
    BashErrorType.INVALID_WORKDIR,
    `Invalid working directory: ${workdir}. Path must be absolute.`
  );
}

export function createWorkdirNotFoundError(workdir: string): BashError {
  return new BashError(
    BashErrorType.WORKDIR_NOT_FOUND,
    `Working directory not found: ${workdir}`
  );
}

export function createWorkdirNotDirectoryError(workdir: string): BashError {
  return new BashError(
    BashErrorType.WORKDIR_NOT_DIRECTORY,
    `Working directory is not a directory: ${workdir}`
  );
}

export function createSpawnFailedError(reason: string): BashError {
  return new BashError(
    BashErrorType.SPAWN_FAILED,
    `Failed to spawn command: ${reason}`
  );
}

export function createExecutionTimeoutError(timeout: number): BashError {
  return new BashError(
    BashErrorType.EXECUTION_TIMEOUT,
    `Command timed out after ${timeout}ms`
  );
}

export function createExecutionAbortedError(): BashError {
  return new BashError(BashErrorType.EXECUTION_ABORTED, "Command was aborted");
}

export function createExecutionFailedError(
  exitCode: number | null,
  signal: string | null
): BashError {
  const parts = ["Command failed"];
  if (exitCode !== null) {
    parts.push(`with exit code ${exitCode}`);
  }
  if (signal) {
    parts.push(`(signal: ${signal})`);
  }
  return new BashError(BashErrorType.EXECUTION_FAILED, parts.join(" "));
}
