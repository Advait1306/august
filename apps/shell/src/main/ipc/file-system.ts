import { ipcMain } from 'electron'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import fuzzysort from 'fuzzysort'
import { rgPath } from '@august/shell-tools'
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

// Cache for file lists per workspace path
interface FileCache {
  files: Array<{ path: string; name: string; preparedName: Fuzzysort.Prepared; preparedPath: Fuzzysort.Prepared }>
  timestamp: number
}
const fileCacheMap = new Map<string, FileCache>()
const CACHE_TTL = 30000 // 30 seconds

/**
 * Get all files in a directory using ripgrep
 */
async function getAllFilesWithRipgrep(
  searchPath: string,
  excludePatterns: string[],
  includeHidden: boolean
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const args = ['--files']

    if (includeHidden) {
      args.push('--hidden')
    }

    // Add exclude patterns as negative globs
    for (const pattern of excludePatterns) {
      args.push('--glob', `!${pattern}/**`)
      args.push('--glob', `!**/${pattern}/**`)
    }

    args.push(searchPath)

    const rg = spawn(rgPath, args)
    let stdout = ''
    let stderr = ''

    rg.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    rg.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    rg.on('close', (exitCode) => {
      // Exit code 1 = no matches (not an error)
      if (exitCode === 1) {
        resolve([])
        return
      }

      if (exitCode === 2) {
        reject(new Error(`ripgrep error: ${stderr || 'unknown error'}`))
        return
      }

      const files = stdout
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)
        .map((filePath) => {
          // Convert absolute path to relative path from searchPath
          if (filePath.startsWith(searchPath)) {
            return filePath.slice(searchPath.length + 1) // +1 for the separator
          }
          return filePath
        })

      resolve(files)
    })

    rg.on('error', reject)
  })
}

/**
 * Extract highlight ranges from fuzzysort result
 */
function extractHighlightRanges(result: Fuzzysort.Result | null): Array<[number, number]> | undefined {
  if (!result || !result.indexes || result.indexes.length === 0) {
    return undefined
  }

  const ranges: Array<[number, number]> = []
  const indexes = [...result.indexes].sort((a, b) => a - b)

  let start = indexes[0]
  let end = indexes[0] + 1

  for (let i = 1; i < indexes.length; i++) {
    if (indexes[i] === end) {
      // Consecutive index, extend the range
      end++
    } else {
      // Gap found, push current range and start new one
      ranges.push([start, end])
      start = indexes[i]
      end = indexes[i] + 1
    }
  }

  // Push the last range
  ranges.push([start, end])

  return ranges
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
      const trimmedQuery = query.trim()

      const pathCheck = validatePath(searchPath)
      if (!pathCheck.valid) {
        return { success: false, error: pathCheck.error }
      }

      try {
        // Check if we have a valid cache
        const cacheKey = `${pathCheck.resolved}:${excludePatterns.join(',')}:${includeHidden}`
        const now = Date.now()
        let cache = fileCacheMap.get(cacheKey)

        // Rebuild cache if expired or missing
        if (!cache || now - cache.timestamp > CACHE_TTL) {
          const allFiles = await getAllFilesWithRipgrep(pathCheck.resolved, excludePatterns, includeHidden)

          // Prepare files for fuzzysort
          const preparedFiles = allFiles.map((filePath) => ({
            path: filePath,
            name: path.basename(filePath),
            preparedName: fuzzysort.prepare(path.basename(filePath)),
            preparedPath: fuzzysort.prepare(filePath),
          }))

          cache = { files: preparedFiles, timestamp: now }
          fileCacheMap.set(cacheKey, cache)
        }

        // If no query, return first N files
        if (!trimmedQuery) {
          return {
            success: true,
            files: cache.files.slice(0, maxResults).map((f) => ({
              path: f.path,
              name: f.name,
              extension: path.extname(f.name).slice(1),
              score: 0,
              matchType: 'name' as const,
            })),
          }
        }

        // Run fuzzy search on file names and paths
        const fuzzyResults = fuzzysort.go(trimmedQuery, cache.files, {
          keys: ['preparedName', 'preparedPath'],
          limit: maxResults,
          threshold: -10000,
          scoreFn: (a) => {
            const nameScore = a[0]?.score ?? -Infinity
            const pathScore = a[1]?.score ?? -Infinity
            // Name matches get 2x weight
            return Math.max(nameScore * 2, pathScore)
          },
        })

        // Map fuzzy results to response format
        const fileResults: IPC.FileSystem.SearchFileResult[] = fuzzyResults.map((r) => {
          const nameResult = r[0]
          const pathResult = r[1]
          const isNameMatch = (nameResult?.score ?? -Infinity) * 2 >= (pathResult?.score ?? -Infinity)

          return {
            path: r.obj.path,
            name: r.obj.name,
            extension: path.extname(r.obj.name).slice(1),
            score: r.score,
            matchType: isNameMatch ? 'name' as const : 'path' as const,
            highlights: extractHighlightRanges(isNameMatch ? nameResult : pathResult),
          }
        })

        return {
          success: true,
          files: fileResults,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search files',
        }
      }
    }
  )
}
