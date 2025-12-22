import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS, IPC } from '@jupiter/shared/ipc'
import { agent } from './agent'

// Custom APIs for renderer
const api = {
  projects: {
    selectFolder: () => electronAPI.ipcRenderer.invoke(IPC_CHANNELS.PROJECTS.SELECT_FOLDER),
    getDefaultCwd: () => electronAPI.ipcRenderer.invoke(IPC_CHANNELS.PROJECTS.GET_DEFAULT_CWD)
  },
  auth: {
    openLogin: () => electronAPI.ipcRenderer.invoke(IPC_CHANNELS.AUTH.OPEN_LOGIN),
    onTokenReceived: (callback: (ticket: string) => void) => {
      electronAPI.ipcRenderer.on(IPC_CHANNELS.AUTH.TICKET_RECEIVED, (_, ticket) => callback(ticket))
      return () => electronAPI.ipcRenderer.removeAllListeners(IPC_CHANNELS.AUTH.TICKET_RECEIVED)
    }
  },
  autoUpdater: {
    checkForUpdates: () => electronAPI.ipcRenderer.invoke(IPC_CHANNELS.AUTO_UPDATER.CHECK),
    quitAndInstall: () =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.AUTO_UPDATER.QUIT_AND_INSTALL),
    getUpdateInfo: () => electronAPI.ipcRenderer.invoke(IPC_CHANNELS.AUTO_UPDATER.GET_INFO)
  },
  agent: agent,
  claudeCode: {
    discoverInstallations: () =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_CODE.DISCOVER_INSTALLATIONS)
  },
  browser: {
    openUrl: (url: string) => electronAPI.ipcRenderer.invoke(IPC_CHANNELS.BROWSER.OPEN_URL, url)
  },
  shellTools: {
    getManifest: (): Promise<IPC.ShellTools.GetManifestResponse> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.SHELL_TOOLS.GET_MANIFEST),
    execute: <T extends keyof IPC.ShellTools.ToolInputMap>(
      name: T,
      input: IPC.ShellTools.ToolInputMap[T]
    ): Promise<IPC.ShellTools.ToolOutputMap[T]> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.SHELL_TOOLS.EXECUTE, { name, input })
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
