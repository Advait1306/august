import { ipcMain, BrowserWindow } from 'electron'

let mainWindow: BrowserWindow | null = null

export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window
}

export function registerAuthIpcHandlers(): void {
  ipcMain.handle('auth:open-login', async () => {
    // Open the web login page
    const { shell } = await import('electron')
    shell.openExternal('https://jupiter.sixhuman.com/authorise')
    return true
  })
}

export function handleAuthToken(token: string): void {
  console.log('Sending auth ticket: ', token)
  // Send the token to the renderer process
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('auth:ticket-received', token)
  }
}
