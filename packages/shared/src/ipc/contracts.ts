import { ModelMessage } from "ai";
import type {
  ShellToolsManifest,
  GrepInput,
  GrepOutput,
  GlobInput,
  GlobOutput,
  LsInput,
  LsOutput,
  EditInput,
  EditOutput,
  WriteInput,
  WriteOutput,
  MultiEditInput,
  MultiEditOutput,
  BashInput,
  BashOutput,
} from "@august/shell-tools";

// Type-safe IPC request/response definitions
export namespace IPC {
  export namespace Agent {
    // Agent run options
    export interface RunOptions {
      messages: ModelMessage[];
      runConfig: Record<string, unknown>;
      threadId: string;
    }

    // Run request from caller (no id yet)
    export interface RunRequest {
      options: RunOptions;
      systemPrompt?: string;
      path?: string;
      env?: Record<string, string>;
      mcpServers?: Record<
        string,
        {
          type: "http";
          url: string;
          headers: Record<string, string>;
        }
      >;
      settingSources?: string[];
    }

    // Full run parameters (with id for IPC)
    export interface RunParams extends RunRequest {
      id: string;
    }
  }

  export namespace Folder {
    export type SelectFolderResponse = {
      name: string;
      path: string;
    } | null;

    export type GetDefaultCwdResponse = string;
  }

  export namespace Auth {
    export type OpenLoginResponse = boolean;
    export type TicketReceivedEvent = string;
  }

  export namespace AutoUpdater {
    export interface OperationResponse {
      success: boolean;
      error?: string;
    }
    export interface UpdateInfoResponse {
      success: boolean;
      data?: any;
      error?: string;
    }
  }
  export namespace ShellTools {
    // Get manifest response
    export type GetManifestResponse = ShellToolsManifest;

    // Tool input/output type mapping
    export interface ToolInputMap {
      grep: GrepInput;
      glob: GlobInput;
      ls: LsInput;
      edit: EditInput;
      write: WriteInput;
      multiedit: MultiEditInput;
      bash: BashInput;
    }

    export interface ToolOutputMap {
      grep: GrepOutput;
      glob: GlobOutput;
      ls: LsOutput;
      edit: EditOutput;
      write: WriteOutput;
      multiedit: MultiEditOutput;
      bash: BashOutput;
    }

    // Execute request
    export interface ExecuteRequest<T extends keyof ToolInputMap = keyof ToolInputMap> {
      name: T;
      input: ToolInputMap[T];
    }

    // Execute response
    export type ExecuteResponse<T extends keyof ToolOutputMap = keyof ToolOutputMap> =
      ToolOutputMap[T];
  }

  export namespace Terminal {
    export interface CreateRequest {
      cols: number;
      rows: number;
      cwd?: string;
      env?: Record<string, string>;
    }

    export interface CreateResponse {
      success: boolean;
      terminalId?: string;
      error?: string;
    }

    export interface WriteRequest {
      terminalId: string;
      data: string;
    }

    export interface ResizeRequest {
      terminalId: string;
      cols: number;
      rows: number;
    }

    export interface DestroyRequest {
      terminalId: string;
    }

    export interface DataEvent {
      terminalId: string;
      data: string;
    }

    export interface ExitEvent {
      terminalId: string;
      exitCode: number;
      signal?: string;
    }

    export interface OperationResponse {
      success: boolean;
      error?: string;
    }
  }

  export namespace FileSystem {
    export interface DirEntry {
      name: string;
      path: string;
      isDirectory: boolean;
    }

    export interface ReadDirResponse {
      success: boolean;
      entries?: DirEntry[];
      error?: string;
    }

    export interface ReadFileResponse {
      success: boolean;
      content?: string;
      error?: string;
    }

    export interface OperationResponse {
      success: boolean;
      error?: string;
    }

    export interface FileChangedEvent {
      filePath: string;
      eventType: 'change' | 'rename';
    }

    export interface WatchResponse {
      success: boolean;
      error?: string;
    }

    export interface SearchFilesRequest {
      path: string;
      query: string;
      /** Exact directory names to exclude (e.g., "node_modules", "dist") */
      excludePatterns: string[];
      maxResults?: number;
      includeHidden?: boolean;
    }

    export interface SearchFilesResponse {
      success: boolean;
      files?: Array<{
        path: string;
        name: string;
        extension: string;
      }>;
      error?: string;
    }

    export interface ValidateDirectoryResponse {
      valid: boolean;
      resolvedPath: string;
      name: string;
      error?: string;
    }
  }

  export namespace Git {
    export interface IsRepoResponse {
      isRepo: boolean;
      error?: string;
    }

    export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked';

    export interface FileChange {
      path: string;
      status: FileStatus;
      staged: boolean;
    }

    export interface StatusResponse {
      success: boolean;
      staged: FileChange[];
      unstaged: FileChange[];
      untracked: FileChange[];
      error?: string;
    }

    export interface DiffFileRequest {
      cwd: string;
      filePath: string;
      staged: boolean;
    }

    export interface DiffFileResponse {
      success: boolean;
      original: string;
      modified: string;
      error?: string;
    }

    export interface WatchRequest {
      cwd: string;
    }

    export interface WatchResponse {
      success: boolean;
      error?: string;
    }

    export interface ChangedEvent {
      cwd: string;
    }
  }
}
