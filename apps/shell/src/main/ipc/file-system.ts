import { ipcMain } from 'electron'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { fdir } from 'fdir'
import picomatch from 'picomatch'
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

  ipcMain.handle(
    IPC_CHANNELS.FILE_SYSTEM.SEARCH_FILES,
    async (
      _event,
      request: IPC.FileSystem.SearchFilesRequest
    ): Promise<IPC.FileSystem.SearchFilesResponse> => {
      const { query, excludePatterns, maxResults = 50, includeHidden = false } = request
      const searchPath = request.path

      const pathCheck = validatePath(searchPath)
      if (!pathCheck.valid) {
        return { success: false, error: pathCheck.error }
      }

      try {
        // Convert search query to glob pattern: "test" -> "**/*test*"
        // Replace spaces with wildcards so "agent runner" matches "agent-runner.tsx"
        const sanitizedQuery = query.trim().replace(/\s+/g, '*')
        const globPattern = sanitizedQuery ? `**/*${sanitizedQuery}*` : '**/*'

        // Create case-insensitive glob matcher
        const caseInsensitiveMatcher = (pattern: string) => picomatch(pattern, { nocase: true })

        const crawler = new fdir()
          .withRelativePaths()
          .withGlobFunction(caseInsensitiveMatcher)
          .glob(globPattern)
          .exclude((dirName) => {
            // excludePatterns uses exact directory name matching (e.g., "node_modules", "dist")
            if (excludePatterns.includes(dirName)) return true
            if (!includeHidden && dirName.startsWith('.')) return true
            return false
          })
          .crawl(pathCheck.resolved)

        const allMatches = await crawler.withPromise()
        const limitedFiles = allMatches.slice(0, maxResults)

        return {
          success: true,
          files: limitedFiles.map((filePath) => {
            const name = path.basename(filePath)
            const ext = path.extname(name).slice(1)
            return { path: filePath, name, extension: ext }
          })
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search files'
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.FILE_SYSTEM.VALIDATE_DIRECTORY,
    async (_event, inputPath: string): Promise<IPC.FileSystem.ValidateDirectoryResponse> => {
      try {
        // Expand ~ to home directory
        const homeDir = os.homedir()
        let expandedPath = inputPath
        if (inputPath.startsWith('~')) {
          expandedPath = inputPath.replace(/^~/, homeDir)
        }

        // Resolve to absolute path
        const resolvedPath = path.resolve(expandedPath)

        // Security check: must be within home directory
        if (!resolvedPath.startsWith(homeDir + path.sep) && resolvedPath !== homeDir) {
          return {
            valid: false,
            resolvedPath,
            name: '',
            error: 'Path must be within your home directory'
          }
        }

        // Check if path exists
        const stats = await fs.stat(resolvedPath)

        // Check if it's a directory
        if (!stats.isDirectory()) {
          return {
            valid: false,
            resolvedPath,
            name: '',
            error: 'Path is not a directory'
          }
        }

        return {
          valid: true,
          resolvedPath,
          name: path.basename(resolvedPath)
        }
      } catch (error) {
        return {
          valid: false,
          resolvedPath: inputPath,
          name: '',
          error: error instanceof Error && error.message.includes('ENOENT')
            ? 'Directory does not exist'
            : error instanceof Error ? error.message : 'Failed to validate directory'
        }
      }
    }
  )
}
