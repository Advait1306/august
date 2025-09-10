import { ipcMain, BrowserWindow } from 'electron'

let mainWindow: BrowserWindow | null = null

export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window
}

export function registerAuthIpcHandlers(): void {
  ipcMain.handle('auth:get-token', () => {
    // This will be called when the renderer needs to check for a stored token
    // For now, we'll handle this via the deep link mechanism
    return null
  })

  ipcMain.handle('auth:open-login', async () => {
    // Open the web login page
    const { shell } = await import('electron')
    // shell.openExternal('https://jupiter.sixhuman.com/desktop-login')
    shell.openExternal('http://localhost:3000/desktop-login')
    return true
  })
}

export function handleAuthToken(token: string): void {
  // Send the token to the renderer process
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('auth:token-received', token)
  }
}
