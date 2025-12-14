/**
 * Edit tool validation and error types
 */

export enum EditErrorType {
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  PATH_IS_DIRECTORY = "PATH_IS_DIRECTORY",
  NO_MATCH_FOUND = "NO_MATCH_FOUND",
  MULTIPLE_MATCHES = "MULTIPLE_MATCHES",
  NO_CHANGE = "NO_CHANGE",
  WRITE_FAILED = "WRITE_FAILED",
  INVALID_PATH = "INVALID_PATH",
}

export class EditError extends Error {
  constructor(
    public type: EditErrorType,
    message: string
  ) {
    super(message);
    this.name = "EditError";
  }
}

export function createNoMatchError(): EditError {
  return new EditError(
    EditErrorType.NO_MATCH_FOUND,
    "oldString not found in file. Ensure exact match including whitespace and indentation."
  );
}

export function createMultipleMatchesError(count: number): EditError {
  return new EditError(
    EditErrorType.MULTIPLE_MATCHES,
    `Found ${count} occurrences of oldString. Provide more surrounding context to identify unique match, or use replaceAll: true.`
  );
}

export function createFileNotFoundError(filePath: string): EditError {
  return new EditError(
    EditErrorType.FILE_NOT_FOUND,
    `File not found: ${filePath}`
  );
}

export function createPathIsDirectoryError(filePath: string): EditError {
  return new EditError(
    EditErrorType.PATH_IS_DIRECTORY,
    `Path is a directory, not a file: ${filePath}`
  );
}

export function createNoChangeError(): EditError {
  return new EditError(
    EditErrorType.NO_CHANGE,
    "oldString and newString are identical. No changes to make."
  );
}

export function createWriteFailedError(filePath: string, reason: string): EditError {
  return new EditError(
    EditErrorType.WRITE_FAILED,
    `Failed to write file ${filePath}: ${reason}`
  );
}

export function createInvalidPathError(filePath: string): EditError {
  return new EditError(
    EditErrorType.INVALID_PATH,
    `Invalid path: ${filePath}. Path must be absolute.`
  );
}
