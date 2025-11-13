import { ipcMain, shell } from 'electron'
import { IPC_CHANNELS } from '@jupiter/shared/ipc'

export function registerBrowserIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.BROWSER.OPEN_URL, async (_event, url: string): Promise<boolean> => {
    console.log('URL: Opening URL in browser', url)
    // Open the URL in the user's default browser
    await shell.openExternal(url)
    return true
  })
}
