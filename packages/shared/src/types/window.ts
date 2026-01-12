import { ElectronAPI } from "@electron-toolkit/preload";
import type { IPC } from "../ipc/contracts";

declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      projects: {
        selectFolder: () => Promise<{ name: string; path: string } | null>;
        getDefaultCwd: () => Promise<string>;
      };
      auth: {
        getToken?: () => Promise<string | null>;
        openLogin: () => Promise<boolean>;
        onTokenReceived: (callback: (token: string) => void) => () => void;
      };
      autoUpdater: {
        checkForUpdates: () => Promise<{ success: boolean; error?: string }>;
        quitAndInstall: () => Promise<{ success: boolean; error?: string }>;
        getUpdateInfo: () => Promise<{
          success: boolean;
          data?: any;
          error?: string;
        }>;
      };
      browser: {
        openUrl: (url: string) => Promise<boolean>;
      };
      shellTools: {
        getManifest: () => Promise<IPC.ShellTools.GetManifestResponse>;
        execute: <T extends keyof IPC.ShellTools.ToolInputMap>(
          name: T,
          input: IPC.ShellTools.ToolInputMap[T]
        ) => Promise<IPC.ShellTools.ToolOutputMap[T]>;
      };
      terminal: {
        create: (
          options: IPC.Terminal.CreateRequest
        ) => Promise<IPC.Terminal.CreateResponse>;
        write: (
          terminalId: string,
          data: string
        ) => Promise<IPC.Terminal.OperationResponse>;
        resize: (
          terminalId: string,
          cols: number,
          rows: number
        ) => Promise<IPC.Terminal.OperationResponse>;
        destroy: (terminalId: string) => Promise<IPC.Terminal.OperationResponse>;
        onData: (callback: (event: IPC.Terminal.DataEvent) => void) => () => void;
        onExit: (callback: (event: IPC.Terminal.ExitEvent) => void) => () => void;
      };
      fileSystem: {
        readDir: (path: string) => Promise<IPC.FileSystem.ReadDirResponse>;
        createFile: (path: string) => Promise<IPC.FileSystem.OperationResponse>;
        createFolder: (path: string) => Promise<IPC.FileSystem.OperationResponse>;
        rename: (
          oldPath: string,
          newPath: string
        ) => Promise<IPC.FileSystem.OperationResponse>;
        delete: (path: string) => Promise<IPC.FileSystem.OperationResponse>;
        getHomeDir: () => Promise<string>;
        readFile: (path: string) => Promise<IPC.FileSystem.ReadFileResponse>;
        writeFile: (
          path: string,
          content: string
        ) => Promise<IPC.FileSystem.OperationResponse>;
      };
    };
  }
}

export {};
