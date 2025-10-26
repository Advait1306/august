import { ipcMain, dialog } from 'electron'
import { basename } from 'node:path'
import { IPC_CHANNELS, IPC } from '@jupiter/shared/ipc'

export function registerProjectIpcHandlers(): void {
  // Add project by selecting folder
  ipcMain.handle(
    IPC_CHANNELS.PROJECTS.SELECT_FOLDER,
    async (): Promise<IPC.Projects.SelectFolderResponse> => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Project Folder'
      })

      if (result.canceled || !result.filePaths.length) {
        return null
      }

      const folderPath = result.filePaths[0]
      const folderName = basename(folderPath) || 'Unnamed Project'

      const newProject = {
        name: folderName,
        path: folderPath
      }

      return newProject
    }
  )
}
