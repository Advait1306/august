import { ipcMain, dialog } from 'electron'
import { basename } from 'node:path'
import { db } from '../db'
import { projects } from '../db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

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
      id: randomUUID(),
      name: folderName,
      path: folderPath
    }

    try {
      const project = await db.insert(projects).values(newProject).returning()
      return project[0]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        // Show alert for duplicate project
        dialog.showMessageBox({
          type: 'warning',
          title: 'Project Already Added',
          message: 'This project has already been added to your workspace.',
          buttons: ['OK']
        })

        // Return the existing project
        const existingProject = await db
          .select()
          .from(projects)
          .where(eq(projects.path, folderPath))
        return existingProject[0] || null
      }
      throw error
    }
  })

  // Remove project
  ipcMain.handle('projects:remove', async (_, projectId: string) => {
    await db.delete(projects).where(eq(projects.id, projectId))
    return true
  })
}
