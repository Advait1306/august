/**
 * Write tool validation and error types
 */

export enum WriteErrorType {
  INVALID_PATH = "INVALID_PATH",
  PATH_IS_DIRECTORY = "PATH_IS_DIRECTORY",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  NO_SPACE = "NO_SPACE",
  WRITE_FAILED = "WRITE_FAILED",
}

export class WriteError extends Error {
  constructor(
    public type: WriteErrorType,
    message: string
  ) {
    super(message);
    this.name = "WriteError";
  }
}

export function createInvalidPathError(filePath: string): WriteError {
  return new WriteError(
    WriteErrorType.INVALID_PATH,
    `Invalid path: ${filePath}. Path must be absolute.`
  );
}

export function createPathIsDirectoryError(filePath: string): WriteError {
  return new WriteError(
    WriteErrorType.PATH_IS_DIRECTORY,
    `Path is a directory, not a file: ${filePath}`
  );
}

export function createPermissionDeniedError(filePath: string): WriteError {
  return new WriteError(
    WriteErrorType.PERMISSION_DENIED,
    `Permission denied: ${filePath}`
  );
}

export function createNoSpaceError(filePath: string): WriteError {
  return new WriteError(
    WriteErrorType.NO_SPACE,
    `No space left on device: ${filePath}`
  );
}

export function createWriteFailedError(filePath: string, reason: string): WriteError {
  return new WriteError(
    WriteErrorType.WRITE_FAILED,
    `Failed to write file ${filePath}: ${reason}`
  );
}
