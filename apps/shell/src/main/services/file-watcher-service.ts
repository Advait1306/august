import { watch, FSWatcher } from 'fs'
import { BrowserWindow } from 'electron'
import { IPC_CHANNELS, IPC } from '@jupiter/shared/ipc'

interface WatcherInstance {
  watcher: FSWatcher
  filePath: string
  debounceTimer: NodeJS.Timeout | null
}

export class FileWatcherService {
  private static instance: FileWatcherService
  private mainWindow: BrowserWindow | null = null
  private watchers: Map<string, WatcherInstance> = new Map()
  private readonly DEBOUNCE_MS = 100

  private constructor() {}

  public static getInstance(): FileWatcherService {
    if (!FileWatcherService.instance) {
      FileWatcherService.instance = new FileWatcherService()
    }
    return FileWatcherService.instance
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  public watchFile(filePath: string): IPC.FileSystem.WatchResponse {
    // Already watching this file
    if (this.watchers.has(filePath)) {
      return { success: true }
    }

    try {
      const watcher = watch(filePath, (eventType) => {
        this.handleFileChange(filePath, eventType as 'change' | 'rename')
      })

      watcher.on('error', (error) => {
        console.error(`[FileWatcherService] Error watching ${filePath}:`, error)
        this.unwatchFile(filePath)
      })

      this.watchers.set(filePath, {
        watcher,
        filePath,
        debounceTimer: null
      })

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to watch file'
      }
    }
  }

  public unwatchFile(filePath: string): IPC.FileSystem.WatchResponse {
    const watcherInstance = this.watchers.get(filePath)
    if (!watcherInstance) {
      return { success: true }
    }

    try {
      if (watcherInstance.debounceTimer) {
        clearTimeout(watcherInstance.debounceTimer)
      }
      watcherInstance.watcher.close()
      this.watchers.delete(filePath)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unwatch file'
      }
    }
  }

  public destroyAll(): void {
    for (const [, watcherInstance] of this.watchers) {
      try {
        if (watcherInstance.debounceTimer) {
          clearTimeout(watcherInstance.debounceTimer)
        }
        watcherInstance.watcher.close()
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.watchers.clear()
  }

  private handleFileChange(filePath: string, eventType: 'change' | 'rename'): void {
    const watcherInstance = this.watchers.get(filePath)
    if (!watcherInstance) return

    // Debounce rapid changes
    if (watcherInstance.debounceTimer) {
      clearTimeout(watcherInstance.debounceTimer)
    }

    watcherInstance.debounceTimer = setTimeout(() => {
      watcherInstance.debounceTimer = null
      this.sendToRenderer(IPC_CHANNELS.FILE_SYSTEM.FILE_CHANGED, {
        filePath,
        eventType
      } as IPC.FileSystem.FileChangedEvent)
    }, this.DEBOUNCE_MS)
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }
}

export const fileWatcherService = FileWatcherService.getInstance()
