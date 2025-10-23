import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { agent } from './agent'

// Custom APIs for renderer
const api = {
  projects: {
    selectFolder: () => electronAPI.ipcRenderer.invoke('projects:selectFolder')
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
