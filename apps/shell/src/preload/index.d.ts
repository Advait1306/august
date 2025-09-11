/* eslint-disable @typescript-eslint/no-explicit-any */
import { ElectronAPI } from '@electron-toolkit/preload'
import type { Project, ProjectUpdate } from '../shared/types'
import type { agentTypes } from './agent'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      projects: {
        getAll: () => Promise<Project[]>
        selectFolder: () => Promise<Project | null>
        remove: (id: string) => Promise<boolean>
        update: (id: string, updates: ProjectUpdate) => Promise<boolean>
      }
      chat: {
        getMessages: (remoteId: string) => Promise<any[]>
        saveMessage: (message: any) => Promise<void>
        getThreads: () => Promise<any[]>
        createThread: (threadId: string) => Promise<any>
        updateThread: (id: string, updates: any) => Promise<void>
        deleteThread: (id: string) => Promise<void>
        archiveThread: (id: string) => Promise<void>
      }
      auth: {
        getToken: () => Promise<string | null>
        openLogin: () => Promise<boolean>
        onTokenReceived: (callback: (token: string) => void) => () => void
      }
      agent: agentTypes
    }
  }
}
