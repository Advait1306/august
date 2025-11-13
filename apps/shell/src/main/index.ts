import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import path from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { AgentAdapterMain } from './agent/agent-adapter-main'
import { setMainWindow, handleAuthToken } from './ipc/auth'
import { autoUpdaterService } from './services/auto-updater-service'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 1296,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    title: 'Teams',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Set the main window reference for auth IPC handlers
  setMainWindow(mainWindow)

  // Set the main window reference for auto-updater service
  autoUpdaterService.setMainWindow(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()

    // @ts-ignore VITE_DEV_TOOLS is defined in the .env file
    if (!import.meta.env.PROD || import.meta.env.VITE_DEV_TOOLS === 'true') {
      mainWindow!.webContents.openDevTools()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
  // @ts-ignore VITE_WEB_URL is defined in the .env file
  mainWindow.loadURL(import.meta.env.VITE_WEB_URL)
}

// Handle deep links
function handleDeepLink(url: string): void {
  try {
    const parsedUrl = new URL(url)
    if (parsedUrl.protocol === 'august:') {
      const ticket = parsedUrl.searchParams.get('ticket')
      if (ticket) {
        handleAuthToken(ticket)
        // Focus the main window if it exists
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.focus()
        }
      }
    }
  } catch (error) {
    console.error('Error handling deep link:', error)
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.sixhuman')

  // Register protocol handler
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('august', process.execPath, [path.resolve(process.argv[1])])
    }
  } else {
    app.setAsDefaultProtocolClient('august')
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize database and IPC handlers
  try {
    const { registerProjectIpcHandlers } = await import('./ipc/projects')
    const { registerAgentIpcHandlers } = await import('./ipc/agents')
    const { registerAuthIpcHandlers } = await import('./ipc/auth')
    const { registerAutoUpdaterIpcHandlers } = await import('./ipc/auto-updater')
    const { registerBrowserIpcHandlers } = await import('./ipc/browser')

    registerProjectIpcHandlers()
    registerAgentIpcHandlers()
    registerAuthIpcHandlers()
    registerAutoUpdaterIpcHandlers()
    registerBrowserIpcHandlers()
    AgentAdapterMain.getInstance()

    // Initialize auto-updater and start checking for updates
    await autoUpdaterService.checkForUpdates()
  } catch (error) {
    console.error('Failed to initialize database or IPC handlers:', error)
    app.quit()
  }

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Only enable when IPC calls to be monitored (has a lot of side effects)
  // await installIpcLogger({ logSize: 1000 })
})

// Handle protocol launch on Windows/Linux
app.on('second-instance', (_, commandLine) => {
  // Someone tried to run a second instance, focus our window instead and handle the protocol
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }

  // Handle deep link from command line arguments
  const url = commandLine.find((arg) => arg.startsWith('august://'))
  if (url) {
    handleDeepLink(url)
  }
})

// Handle protocol on macOS
app.on('open-url', (event, url) => {
  event.preventDefault()
  console.log('open-url', event, url)
  handleDeepLink(url)
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  // Clean up auto-updater service
  autoUpdaterService.destroy()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
