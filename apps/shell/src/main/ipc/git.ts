import { ipcMain } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import { IPC_CHANNELS, IPC } from '@jupiter/shared/ipc'
import { gitWatcherService } from '../services/git-watcher-service'

const execAsync = promisify(exec)

/**
 * Recursively list all files in a directory
 */
async function listFilesRecursively(dirPath: string, relativeTo: string): Promise<string[]> {
  const files: string[] = []

  async function walk(currentPath: string) {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)
        if (entry.isDirectory()) {
          await walk(fullPath)
        } else if (entry.isFile()) {
          // Get path relative to the workspace root
          const relativePath = path.relative(relativeTo, fullPath)
          files.push(relativePath)
        }
      }
    } catch {
      // Ignore errors (permission issues, etc.)
    }
  }

  await walk(dirPath)
  return files
}

/**
 * Parse git status --porcelain=v1 output
 * Format: XY PATH or XY ORIG -> PATH for renames
 * X = status in index (staged), Y = status in worktree
 */
function parseGitStatus(output: string): {
  staged: IPC.Git.FileChange[]
  unstaged: IPC.Git.FileChange[]
  untracked: IPC.Git.FileChange[]
} {
  const staged: IPC.Git.FileChange[] = []
  const unstaged: IPC.Git.FileChange[] = []
  const untracked: IPC.Git.FileChange[] = []

  const lines = output.split('\n').filter((line) => line.length > 0)

  for (const line of lines) {
    const indexStatus = line[0]
    const worktreeStatus = line[1]
    const filePath = line.slice(3).trim()

    // Handle renames: "R  old -> new"
    const actualPath = filePath.includes(' -> ') ? filePath.split(' -> ')[1] : filePath

    // Untracked files
    if (indexStatus === '?' && worktreeStatus === '?') {
      untracked.push({ path: actualPath, status: 'untracked', staged: false })
      continue
    }

    // Staged changes (index status is not empty and not '?')
    if (indexStatus !== ' ' && indexStatus !== '?') {
      const status = getStatusFromCode(indexStatus)
      staged.push({ path: actualPath, status, staged: true })
    }

    // Unstaged changes (worktree status is not empty and not '?')
    if (worktreeStatus !== ' ' && worktreeStatus !== '?') {
      const status = getStatusFromCode(worktreeStatus)
      unstaged.push({ path: actualPath, status, staged: false })
    }
  }

  return { staged, unstaged, untracked }
}

function getStatusFromCode(code: string): IPC.Git.FileStatus {
  switch (code) {
    case 'A':
      return 'added'
    case 'M':
      return 'modified'
    case 'D':
      return 'deleted'
    case 'R':
      return 'renamed'
    default:
      return 'modified'
  }
}

export function registerGitIpcHandlers(): void {
  // Check if a directory is inside a git repository
  ipcMain.handle(
    IPC_CHANNELS.GIT.IS_REPO,
    async (_event, cwd: string): Promise<IPC.Git.IsRepoResponse> => {
      try {
        await execAsync('git rev-parse --is-inside-work-tree', { cwd })
        return { isRepo: true }
      } catch {
        return { isRepo: false }
      }
    }
  )

  // Get git status (staged, unstaged, untracked files)
  ipcMain.handle(
    IPC_CHANNELS.GIT.STATUS,
    async (_event, cwd: string): Promise<IPC.Git.StatusResponse> => {
      try {
        const { stdout } = await execAsync('git status --porcelain=v1', { cwd, maxBuffer: 10 * 1024 * 1024 })
        const { staged, unstaged, untracked } = parseGitStatus(stdout)

        // Expand untracked directories into individual files
        const expandedUntracked: IPC.Git.FileChange[] = []
        for (const file of untracked) {
          if (file.path.endsWith('/')) {
            // This is a directory, list all files inside it
            const dirPath = path.join(cwd, file.path)
            const files = await listFilesRecursively(dirPath, cwd)
            for (const filePath of files) {
              expandedUntracked.push({ path: filePath, status: 'untracked', staged: false })
            }
          } else {
            expandedUntracked.push(file)
          }
        }

        return { success: true, staged, unstaged, untracked: expandedUntracked }
      } catch (error) {
        return {
          success: false,
          staged: [],
          unstaged: [],
          untracked: [],
          error: error instanceof Error ? error.message : 'Failed to get git status',
        }
      }
    }
  )

  // Get diff for a specific file
  ipcMain.handle(
    IPC_CHANNELS.GIT.DIFF_FILE,
    async (_event, request: IPC.Git.DiffFileRequest): Promise<IPC.Git.DiffFileResponse> => {
      const { cwd, filePath, staged } = request

      try {
        let original = ''
        let modified = ''

        // Get the original content from HEAD
        try {
          const { stdout } = await execAsync(
            `git show HEAD:"${filePath}"`,
            { cwd, maxBuffer: 10 * 1024 * 1024 }
          )
          original = stdout
        } catch {
          // File might be new (not in HEAD), so original is empty
          original = ''
        }

        // Get modified content
        if (staged) {
          // For staged changes, get content from the index
          try {
            const { stdout } = await execAsync(
              `git show :"${filePath}"`,
              { cwd, maxBuffer: 10 * 1024 * 1024 }
            )
            modified = stdout
          } catch {
            // File might be deleted in staging, so modified is empty
            modified = ''
          }
        } else {
          // For unstaged changes, read from the working tree
          try {
            const fullPath = path.join(cwd, filePath)
            modified = await fs.readFile(fullPath, 'utf-8')
          } catch {
            // File might be deleted, so modified is empty
            modified = ''
          }
        }

        return { success: true, original, modified }
      } catch (error) {
        return {
          success: false,
          original: '',
          modified: '',
          error: error instanceof Error ? error.message : 'Failed to get file diff',
        }
      }
    }
  )

  // Watch a repository for changes
  ipcMain.handle(
    IPC_CHANNELS.GIT.WATCH,
    (_event, cwd: string): IPC.Git.WatchResponse => {
      return gitWatcherService.watch(cwd)
    }
  )

  // Unwatch a repository
  ipcMain.handle(
    IPC_CHANNELS.GIT.UNWATCH,
    (_event, cwd: string): IPC.Git.WatchResponse => {
      return gitWatcherService.unwatch(cwd)
    }
  )
}
