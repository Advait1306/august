/* eslint-disable @typescript-eslint/no-explicit-any */
import { ElectronAPI } from '@electron-toolkit/preload'
import type { Project } from '../shared/types'
import type { agentTypes } from './agent'

export interface ClaudeInstallation {
  path: string
  version?: string
  source: string
  installationType: 'system' | 'custom'
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      projects: {
        selectFolder: () => Promise<Project | null>
      }
      auth: {
        getToken: () => Promise<string | null>
        openLogin: () => Promise<boolean>
        onTokenReceived: (callback: (token: string) => void) => () => void
      }
      autoUpdater: {
        checkForUpdates: () => Promise<{ success: boolean; error?: string }>
        quitAndInstall: () => Promise<{ success: boolean; error?: string }>
        getUpdateInfo: () => Promise<{ success: boolean; data?: any; error?: string }>
      }
      agent: agentTypes
      claudeCode: {
        discoverInstallations: () => Promise<ClaudeInstallation[]>
      }
    }
  }
}
