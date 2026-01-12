import { ipcMain } from 'electron'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { IPC_CHANNELS, IPC } from '@jupiter/shared/ipc'
import { fileWatcherService } from '../services/file-watcher-service'

export function registerFileSystemIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.FILE_SYSTEM.READ_DIR,
    async (_event, dirPath: string): Promise<IPC.FileSystem.ReadDirResponse> => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })
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
      try {
        await fs.writeFile(filePath, '')
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
      try {
        await fs.mkdir(dirPath)
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
      try {
        await fs.rename(oldPath, newPath)
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
      try {
        await fs.rm(targetPath, { recursive: true })
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
      try {
        const content = await fs.readFile(filePath, 'utf-8')
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
      try {
        await fs.writeFile(filePath, content, 'utf-8')
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
