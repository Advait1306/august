import { ElectronAPI } from "@electron-toolkit/preload";
import type { AgentTypes } from "./agent";
import type { ClaudeInstallation } from "./claude";

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
      agent: AgentTypes;
      claudeCode: {
        discoverInstallations: () => Promise<ClaudeInstallation[]>;
      };
      browser: {
        openUrl: (url: string) => Promise<boolean>;
      };
    };
  }
}

export {};
