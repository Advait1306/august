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
    };
  }
}

export {};
