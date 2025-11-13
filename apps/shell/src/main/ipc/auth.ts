import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS, IPC } from '@jupiter/shared/ipc'

let mainWindow: BrowserWindow | null = null

export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window
}

export function registerAuthIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AUTH.OPEN_LOGIN, async (): Promise<IPC.Auth.OpenLoginResponse> => {
    // Open the web login page
    const { shell } = await import('electron')
    shell.openExternal('https://app.august.tech/authorise')
    return true
  })
}

export function handleAuthToken(token: IPC.Auth.TicketReceivedEvent): void {
  // Send the token to the renderer process
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.AUTH.TICKET_RECEIVED, token)
  }
}
