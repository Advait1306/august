import { ipcMain } from 'electron'
import { autoUpdaterService } from '../services/auto-updater-service'

export function registerAutoUpdaterIpcHandlers(): void {
  // Check for updates manually
  ipcMain.handle('auto-updater:check-for-updates', async () => {
    try {
      await autoUpdaterService.checkForUpdates()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Quit and install update
  ipcMain.handle('auto-updater:quit-and-install', async () => {
    try {
      await autoUpdaterService.quitAndInstall()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // Get current update status/info
  ipcMain.handle('auto-updater:get-update-info', async () => {
    try {
      const updateInfo = await autoUpdaterService.getUpdateInfo()
      return { success: true, data: updateInfo }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })
}
