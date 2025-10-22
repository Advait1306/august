/* eslint-disable @typescript-eslint/no-explicit-any */
import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { agent } from './agent'

// Custom APIs for renderer
const api = {
  projects: {
    selectFolder: () => electronAPI.ipcRenderer.invoke('projects:selectFolder')
  },
  chat: {
    // Thread management
    getThreads: () => electronAPI.ipcRenderer.invoke('threads:getAll'),
    createThread: (threadId: string) => electronAPI.ipcRenderer.invoke('threads:create', threadId),
    updateThread: (id: string, updates: any) =>
      electronAPI.ipcRenderer.invoke('threads:update', id, updates),
    deleteThread: (id: string) => electronAPI.ipcRenderer.invoke('threads:delete', id),
    archiveThread: (id: string) => electronAPI.ipcRenderer.invoke('threads:archive', id),

    // Message management
    getMessages: (threadId: string) =>
      electronAPI.ipcRenderer.invoke('messages:getByThread', threadId),
    saveMessage: (message: any) => electronAPI.ipcRenderer.invoke('messages:save', message),
    deleteMessage: (id: string) => electronAPI.ipcRenderer.invoke('messages:delete', id),

    // Event listeners for streaming
    onMessageUpdate: (callback: (message: any) => void) => {
      electronAPI.ipcRenderer.on('chat:messageUpdate', (_, message) => callback(message))
      return () => electronAPI.ipcRenderer.removeAllListeners('chat:messageUpdate')
    }
  },
  auth: {
    openLogin: () => electronAPI.ipcRenderer.invoke('auth:open-login'),
    onTokenReceived: (callback: (ticket: string) => void) => {
      console.log('token listener added')
      electronAPI.ipcRenderer.on('auth:ticket-received', (_, ticket) => callback(ticket))
      return () => electronAPI.ipcRenderer.removeAllListeners('auth:token-received')
    }
  },
  autoUpdater: {
    checkForUpdates: () => electronAPI.ipcRenderer.invoke('auto-updater:check-for-updates'),
    quitAndInstall: () => electronAPI.ipcRenderer.invoke('auto-updater:quit-and-install'),
    getUpdateInfo: () => electronAPI.ipcRenderer.invoke('auto-updater:get-update-info')
  },
  agent: agent,
  claudeCode: {
    discoverInstallations: () => electronAPI.ipcRenderer.invoke('claude-code:discoverInstallations')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
