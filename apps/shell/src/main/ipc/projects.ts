import { ipcMain, dialog } from 'electron'
import { basename, join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync, mkdirSync } from 'node:fs'
import { IPC_CHANNELS, IPC } from '@jupiter/shared/ipc'

export function registerProjectIpcHandlers(): void {
  // Add project by selecting folder
  ipcMain.handle(
    IPC_CHANNELS.PROJECTS.SELECT_FOLDER,
    async (): Promise<IPC.Folder.SelectFolderResponse> => {
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

  // Get default working directory
  ipcMain.handle(
    IPC_CHANNELS.PROJECTS.GET_DEFAULT_CWD,
    async (): Promise<IPC.Folder.GetDefaultCwdResponse> => {
      const home = homedir()
      const defaultPath = join(home, 'Documents', 'August')

      // Create the directory if it doesn't exist
      try {
        if (!existsSync(defaultPath)) {
          mkdirSync(defaultPath, { recursive: true })
        }
      } catch (error) {
        console.error('Failed to create default directory:', error)
        // Fallback to home directory if we can't create August folder
        return home
      }

      return defaultPath
    }
  )
}
