import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS, IPC } from '@jupiter/shared/ipc'

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
  browser: {
    openUrl: (url: string) => electronAPI.ipcRenderer.invoke(IPC_CHANNELS.BROWSER.OPEN_URL, url)
  },
  sound: {
    play: (soundName: string): Promise<{ success: boolean; error?: string }> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.SOUND.PLAY, soundName)
  },
  shellTools: {
    getManifest: (): Promise<IPC.ShellTools.GetManifestResponse> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.SHELL_TOOLS.GET_MANIFEST),
    execute: <T extends keyof IPC.ShellTools.ToolInputMap>(
      name: T,
      input: IPC.ShellTools.ToolInputMap[T]
    ): Promise<IPC.ShellTools.ToolOutputMap[T]> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.SHELL_TOOLS.EXECUTE, { name, input })
  },
  terminal: {
    create: (options: IPC.Terminal.CreateRequest): Promise<IPC.Terminal.CreateResponse> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.TERMINAL.CREATE, options),
    write: (terminalId: string, data: string): Promise<IPC.Terminal.OperationResponse> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.TERMINAL.WRITE, { terminalId, data }),
    resize: (
      terminalId: string,
      cols: number,
      rows: number
    ): Promise<IPC.Terminal.OperationResponse> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.TERMINAL.RESIZE, { terminalId, cols, rows }),
    destroy: (terminalId: string): Promise<IPC.Terminal.OperationResponse> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.TERMINAL.DESTROY, { terminalId }),
    onData: (callback: (event: IPC.Terminal.DataEvent) => void) => {
      const handler = (_: unknown, event: IPC.Terminal.DataEvent) => callback(event)
      electronAPI.ipcRenderer.on(IPC_CHANNELS.TERMINAL.DATA, handler)
      return () => electronAPI.ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL.DATA, handler)
    },
    onExit: (callback: (event: IPC.Terminal.ExitEvent) => void) => {
      const handler = (_: unknown, event: IPC.Terminal.ExitEvent) => callback(event)
      electronAPI.ipcRenderer.on(IPC_CHANNELS.TERMINAL.EXIT, handler)
      return () => electronAPI.ipcRenderer.removeListener(IPC_CHANNELS.TERMINAL.EXIT, handler)
    }
  },
  fileSystem: {
    readDir: (path: string): Promise<IPC.FileSystem.ReadDirResponse> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.FILE_SYSTEM.READ_DIR, path),
    createFile: (path: string): Promise<IPC.FileSystem.OperationResponse> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.FILE_SYSTEM.CREATE_FILE, path),
    createFolder: (path: string): Promise<IPC.FileSystem.OperationResponse> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.FILE_SYSTEM.CREATE_FOLDER, path),
    rename: (oldPath: string, newPath: string): Promise<IPC.FileSystem.OperationResponse> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.FILE_SYSTEM.RENAME, oldPath, newPath),
    delete: (path: string): Promise<IPC.FileSystem.OperationResponse> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.FILE_SYSTEM.DELETE, path),
    getHomeDir: (): Promise<string> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.FILE_SYSTEM.GET_HOME_DIR),
    readFile: (path: string): Promise<IPC.FileSystem.ReadFileResponse> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.FILE_SYSTEM.READ_FILE, path),
    writeFile: (path: string, content: string): Promise<IPC.FileSystem.OperationResponse> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.FILE_SYSTEM.WRITE_FILE, path, content),
    watchFile: (path: string): Promise<IPC.FileSystem.WatchResponse> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.FILE_SYSTEM.WATCH_FILE, path),
    unwatchFile: (path: string): Promise<IPC.FileSystem.WatchResponse> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.FILE_SYSTEM.UNWATCH_FILE, path),
    onFileChanged: (callback: (event: IPC.FileSystem.FileChangedEvent) => void) => {
      const handler = (_: unknown, event: IPC.FileSystem.FileChangedEvent) => callback(event)
      electronAPI.ipcRenderer.on(IPC_CHANNELS.FILE_SYSTEM.FILE_CHANGED, handler)
      return () => electronAPI.ipcRenderer.removeListener(IPC_CHANNELS.FILE_SYSTEM.FILE_CHANGED, handler)
    },
    searchFiles: (request: IPC.FileSystem.SearchFilesRequest): Promise<IPC.FileSystem.SearchFilesResponse> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.FILE_SYSTEM.SEARCH_FILES, request),
    validateDirectory: (path: string): Promise<IPC.FileSystem.ValidateDirectoryResponse> =>
      electronAPI.ipcRenderer.invoke(IPC_CHANNELS.FILE_SYSTEM.VALIDATE_DIRECTORY, path)
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
