import { ElectronAPI } from "@electron-toolkit/preload";
import type { agentTypes } from "./agent";

declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      claudeCode: {
        discoverInstallations: () => Promise<ClaudeInstallation[]>;
      };
      auth: {
        openLogin: () => Promise<boolean>;
        onTokenReceived: (callback: (token: string) => void) => () => void;
      };
      autoUpdater: {
        checkForUpdates: () => Promise<{ success: boolean; error?: string }>;
        quitAndInstall: () => Promise<{ success: boolean; error?: string }>;
        getUpdateInfo: () => Promise<{ success: boolean; data?: any; error?: string }>;
      };
      agent: agentTypes;
    };
  }
}
