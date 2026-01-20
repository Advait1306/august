import { watch, FSWatcher } from 'fs'
import { BrowserWindow } from 'electron'
import { IPC_CHANNELS, IPC } from '@jupiter/shared/ipc'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'

interface GitWatcherInstance {
  cwd: string
  gitWatcher: FSWatcher | null
  workspaceWatcher: FSWatcher | null
  debounceTimer: NodeJS.Timeout | null
}

export class GitWatcherService {
  private static instance: GitWatcherService
  private mainWindow: BrowserWindow | null = null
  private watchers: Map<string, GitWatcherInstance> = new Map()
  private readonly DEBOUNCE_MS = 300 // Match VS Code's debounce time

  private constructor() {}

  public static getInstance(): GitWatcherService {
    if (!GitWatcherService.instance) {
      GitWatcherService.instance = new GitWatcherService()
    }
    return GitWatcherService.instance
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  private isPathWithinHomeDir(dirPath: string): boolean {
    const resolvedPath = path.resolve(dirPath)
    const homeDir = os.homedir()
    return resolvedPath.startsWith(homeDir + path.sep) || resolvedPath === homeDir
  }

  public watch(cwd: string): IPC.Git.WatchResponse {
    // Validate path is within home directory
    if (!this.isPathWithinHomeDir(cwd)) {
      return {
        success: false,
        error: 'Cannot watch directories outside of home directory'
      }
    }

    // Already watching this directory
    if (this.watchers.has(cwd)) {
      return { success: true }
    }

    const gitDir = path.join(cwd, '.git')

    // Check if .git directory exists
    if (!fs.existsSync(gitDir)) {
      return {
        success: false,
        error: 'Not a git repository'
      }
    }

    try {
      const instance: GitWatcherInstance = {
        cwd,
        gitWatcher: null,
        workspaceWatcher: null,
        debounceTimer: null
      }

      // Watch the .git directory for changes (refs, HEAD, index, etc.)
      instance.gitWatcher = watch(gitDir, { recursive: true }, (eventType, filename) => {
        // Filter out noisy files like index.lock
        if (filename && this.shouldIgnoreGitFile(filename)) {
          return
        }
        this.handleChange(cwd)
      })

      instance.gitWatcher.on('error', (error) => {
        console.error(`[GitWatcherService] Error watching .git in ${cwd}:`, error)
      })

      // Watch the workspace directory for file changes
      instance.workspaceWatcher = watch(cwd, { recursive: true }, (eventType, filename) => {
        // Filter out .git directory changes (handled by gitWatcher)
        if (filename && (filename.startsWith('.git') || filename.startsWith('.git/'))) {
          return
        }
        // Filter out common noisy files/directories
        if (filename && this.shouldIgnoreWorkspaceFile(filename)) {
          return
        }
        this.handleChange(cwd)
      })

      instance.workspaceWatcher.on('error', (error) => {
        console.error(`[GitWatcherService] Error watching workspace ${cwd}:`, error)
      })

      this.watchers.set(cwd, instance)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to watch repository'
      }
    }
  }

  public unwatch(cwd: string): IPC.Git.WatchResponse {
    const instance = this.watchers.get(cwd)
    if (!instance) {
      return { success: true }
    }

    try {
      if (instance.debounceTimer) {
        clearTimeout(instance.debounceTimer)
      }
      if (instance.gitWatcher) {
        instance.gitWatcher.close()
      }
      if (instance.workspaceWatcher) {
        instance.workspaceWatcher.close()
      }
      this.watchers.delete(cwd)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unwatch repository'
      }
    }
  }

  public destroyAll(): void {
    for (const [, instance] of this.watchers) {
      try {
        if (instance.debounceTimer) {
          clearTimeout(instance.debounceTimer)
        }
        if (instance.gitWatcher) {
          instance.gitWatcher.close()
        }
        if (instance.workspaceWatcher) {
          instance.workspaceWatcher.close()
        }
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.watchers.clear()
  }

  private shouldIgnoreGitFile(filename: string): boolean {
    // Ignore lock files and other noisy git internals
    const ignorePatterns = [
      'index.lock',
      'HEAD.lock',
      'config.lock',
      '.watchman-cookie-',
      'gc.log',
      'FETCH_HEAD',
      'ORIG_HEAD',
    ]
    return ignorePatterns.some(pattern => filename.includes(pattern))
  }

  private shouldIgnoreWorkspaceFile(filename: string): boolean {
    // Ignore common noisy files/directories
    const ignorePatterns = [
      'node_modules',
      '.DS_Store',
      'Thumbs.db',
      '.swp',
      '.swo',
      '~',
    ]
    return ignorePatterns.some(pattern => filename.includes(pattern))
  }

  private handleChange(cwd: string): void {
    const instance = this.watchers.get(cwd)
    if (!instance) return

    // Debounce rapid changes
    if (instance.debounceTimer) {
      clearTimeout(instance.debounceTimer)
    }

    instance.debounceTimer = setTimeout(() => {
      instance.debounceTimer = null
      this.sendToRenderer(IPC_CHANNELS.GIT.CHANGED, {
        cwd
      } as IPC.Git.ChangedEvent)
    }, this.DEBOUNCE_MS)
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }
}

export const gitWatcherService = GitWatcherService.getInstance()
