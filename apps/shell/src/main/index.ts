import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import path from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { AgentAdapterMain } from './agent/agent-adapter-main'
import { setMainWindow, handleAuthToken } from './ipc/auth'

let mainWindow: BrowserWindow | null = null

// Initialize base agents on app startup
async function initializeBaseAgents(): Promise<void> {
  const { agentService } = await import('./services/agent-service')

  const builtInAgents = [
    { id: 'claude-code', name: 'Claude Code', apiKey: null },
    { id: 'codex', name: 'Codex', apiKey: null },
    { id: 'opencode', name: 'OpenCode', apiKey: null }
  ]

  await agentService.seedBaseAgents(builtInAgents)
}

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

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
    mainWindow!.webContents.openDevTools()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // mainWindow.loadURL('https://jupiter.sixhuman.com')
  mainWindow.loadURL('http://localhost:3000')
}

// Handle deep links
function handleDeepLink(url: string): void {
  try {
    const parsedUrl = new URL(url)
    console.log('protocol: ', parsedUrl.protocol)
    console.log('parsedURL ', parsedUrl)
    console.log('ticket: ', parsedUrl.searchParams.get('ticket'))
    if (parsedUrl.protocol === 'jupiter:') {
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
  electronApp.setAppUserModelId('com.electron')

  // Register protocol handler
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('jupiter', process.execPath, [path.resolve(process.argv[1])])
    }
  } else {
    app.setAsDefaultProtocolClient('jupiter')
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize database and IPC handlers
  try {
    const { initializeDatabase } = await import('./db')
    const { registerProjectIpcHandlers } = await import('./ipc/projects')
    const { registerThreadIpcHandlers } = await import('./ipc/threads')
    const { registerMessageIpcHandlers } = await import('./ipc/messages')
    const { registerAgentIpcHandlers } = await import('./ipc/agents')
    const { registerAuthIpcHandlers } = await import('./ipc/auth')

    initializeDatabase()

    // Initialize base agents on app startup
    await initializeBaseAgents()

    registerProjectIpcHandlers()
    registerThreadIpcHandlers()
    registerMessageIpcHandlers()
    registerAgentIpcHandlers()
    registerAuthIpcHandlers()
    AgentAdapterMain.getInstance()
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
  const url = commandLine.find((arg) => arg.startsWith('jupiter://'))
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
