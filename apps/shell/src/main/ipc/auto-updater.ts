import { ipcMain } from 'electron'
import { IPC_CHANNELS, IPC } from '@jupiter/shared/ipc'
import { autoUpdaterService } from '../services/auto-updater-service'

export function registerAutoUpdaterIpcHandlers(): void {
  // Check for updates manually
  ipcMain.handle(
    IPC_CHANNELS.AUTO_UPDATER.CHECK,
    async (): Promise<IPC.AutoUpdater.OperationResponse> => {
      try {
        await autoUpdaterService.checkForUpdates()
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  // Quit and install update
  ipcMain.handle(
    IPC_CHANNELS.AUTO_UPDATER.QUIT_AND_INSTALL,
    async (): Promise<IPC.AutoUpdater.OperationResponse> => {
      try {
        await autoUpdaterService.quitAndInstall()
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  // Get current update status/info
  ipcMain.handle(
    IPC_CHANNELS.AUTO_UPDATER.GET_INFO,
    async (): Promise<IPC.AutoUpdater.UpdateInfoResponse> => {
      try {
        const updateInfo = await autoUpdaterService.getUpdateInfo()
        return { success: true, data: updateInfo }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )
}
