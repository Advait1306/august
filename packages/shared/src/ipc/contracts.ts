import { ModelMessage } from "ai";
import { ClaudeInstallation } from "../types/claude";

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

  export namespace ClaudeCode {
    export type DiscoverInstallationsResponse = ClaudeInstallation[];
  }
}
