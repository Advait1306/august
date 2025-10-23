import { ipcMain, dialog } from 'electron'
import { basename } from 'node:path'

export function registerProjectIpcHandlers(): void {
  // Add project by selecting folder
  ipcMain.handle('projects:selectFolder', async () => {
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
  })
}
