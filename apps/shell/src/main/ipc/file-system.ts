import { ipcMain } from 'electron'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { IPC_CHANNELS, IPC } from '@jupiter/shared/ipc'
import { fileWatcherService } from '../services/file-watcher-service'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

function validatePath(inputPath: string): { valid: boolean; resolved: string; error?: string } {
  const resolved = path.resolve(inputPath)
  const homeDir = os.homedir()
  if (!resolved.startsWith(homeDir + path.sep) && resolved !== homeDir) {
    return { valid: false, resolved, error: 'Access denied: path outside home directory' }
  }
  return { valid: true, resolved }
}

export function registerFileSystemIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.FILE_SYSTEM.READ_DIR,
    async (_event, dirPath: string): Promise<IPC.FileSystem.ReadDirResponse> => {
      const pathCheck = validatePath(dirPath)
      if (!pathCheck.valid) {
        return { success: false, error: pathCheck.error }
      }
      try {
        const entries = await fs.readdir(pathCheck.resolved, { withFileTypes: true })
        return {
          success: true,
          entries: entries.map((entry) => ({
            name: entry.name,
            path: path.join(dirPath, entry.name),
            isDirectory: entry.isDirectory(),
          })),
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to read directory',
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FILE_SYSTEM.CREATE_FILE,
    async (_event, filePath: string): Promise<IPC.FileSystem.OperationResponse> => {
      const pathCheck = validatePath(filePath)
      if (!pathCheck.valid) {
        return { success: false, error: pathCheck.error }
      }
      try {
        await fs.writeFile(pathCheck.resolved, '')
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create file',
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FILE_SYSTEM.CREATE_FOLDER,
    async (_event, dirPath: string): Promise<IPC.FileSystem.OperationResponse> => {
      const pathCheck = validatePath(dirPath)
      if (!pathCheck.valid) {
        return { success: false, error: pathCheck.error }
      }
      try {
        await fs.mkdir(pathCheck.resolved)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create folder',
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FILE_SYSTEM.RENAME,
    async (
      _event,
      oldPath: string,
      newPath: string
    ): Promise<IPC.FileSystem.OperationResponse> => {
      const oldPathCheck = validatePath(oldPath)
      if (!oldPathCheck.valid) {
        return { success: false, error: oldPathCheck.error }
      }
      const newPathCheck = validatePath(newPath)
      if (!newPathCheck.valid) {
        return { success: false, error: newPathCheck.error }
      }
      try {
        await fs.rename(oldPathCheck.resolved, newPathCheck.resolved)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to rename',
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FILE_SYSTEM.DELETE,
    async (_event, targetPath: string): Promise<IPC.FileSystem.OperationResponse> => {
      const pathCheck = validatePath(targetPath)
      if (!pathCheck.valid) {
        return { success: false, error: pathCheck.error }
      }
      try {
        await fs.rm(pathCheck.resolved, { recursive: true })
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete',
        }
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.FILE_SYSTEM.GET_HOME_DIR, async (): Promise<string> => {
    return os.homedir()
  })

  ipcMain.handle(
    IPC_CHANNELS.FILE_SYSTEM.READ_FILE,
    async (_event, filePath: string): Promise<IPC.FileSystem.ReadFileResponse> => {
      const pathCheck = validatePath(filePath)
      if (!pathCheck.valid) {
        return { success: false, error: pathCheck.error }
      }
      try {
        const stats = await fs.stat(pathCheck.resolved)
        if (stats.size > MAX_FILE_SIZE) {
          return { success: false, error: 'File too large (max 10MB)' }
        }
        const content = await fs.readFile(pathCheck.resolved, 'utf-8')
        return { success: true, content }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to read file',
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FILE_SYSTEM.WRITE_FILE,
    async (
      _event,
      filePath: string,
      content: string
    ): Promise<IPC.FileSystem.OperationResponse> => {
      const pathCheck = validatePath(filePath)
      if (!pathCheck.valid) {
        return { success: false, error: pathCheck.error }
      }
      try {
        await fs.writeFile(pathCheck.resolved, content, 'utf-8')
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to write file',
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FILE_SYSTEM.WATCH_FILE,
    (_event, filePath: string): IPC.FileSystem.WatchResponse => {
      return fileWatcherService.watchFile(filePath)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FILE_SYSTEM.UNWATCH_FILE,
    (_event, filePath: string): IPC.FileSystem.WatchResponse => {
      return fileWatcherService.unwatchFile(filePath)
    }
  )
}
