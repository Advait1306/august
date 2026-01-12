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
}
