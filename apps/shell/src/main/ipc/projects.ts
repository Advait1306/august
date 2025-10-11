import { ipcMain, dialog } from 'electron'
import { basename } from 'node:path'
import { db } from '../db'
import { projects } from '../db/schema'
import { eq } from 'drizzle-orm'

export function registerProjectIpcHandlers(): void {
  // Get all projects
  ipcMain.handle('projects:getAll', async () => {
    return await db.select().from(projects)
  })

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

  // Remove project
  ipcMain.handle('projects:remove', async (_, projectId: string) => {
    await db.delete(projects).where(eq(projects.id, projectId))
    return true
  })
}
