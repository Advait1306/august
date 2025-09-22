import {
  autoUpdater,
  UpdateInfo as ElectronUpdateInfo,
  UpdateDownloadedEvent
} from 'electron-updater'
import { BrowserWindow, app } from 'electron'
import log from 'electron-log'

export interface UpdateInfo {
  version: string
  releaseDate: string
  releaseName?: string | null
  releaseNotes?: string | null
}

export interface UpdateProgress {
  bytesPerSecond: number
  percent: number
  transferred: number
  total: number
}

export class AutoUpdaterService {
  private static instance: AutoUpdaterService
  private mainWindow: BrowserWindow | null = null
  private updateCheckInterval: NodeJS.Timeout | null = null

  private constructor() {
    this.setupAutoUpdater()
  }

  public static getInstance(): AutoUpdaterService {
    if (!AutoUpdaterService.instance) {
      AutoUpdaterService.instance = new AutoUpdaterService()
    }
    return AutoUpdaterService.instance
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  private setupAutoUpdater(): void {
    // Configure auto-updater
    autoUpdater.logger = log
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    // Set update check interval (check every 4 hours)
    this.updateCheckInterval = setInterval(
      () => {
        this.checkForUpdates()
      },
      4 * 60 * 60 * 1000
    )

    // Set up event listeners
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for update...')
      this.sendToRenderer('update-checking')
    })

    autoUpdater.on('update-available', (info: ElectronUpdateInfo) => {
      log.info('Update available:', info)
      this.sendToRenderer('update-available', info)
    })

    autoUpdater.on('update-not-available', (info: ElectronUpdateInfo) => {
      log.info('Update not available:', info)
      this.sendToRenderer('update-not-available', info)
    })

    autoUpdater.on('error', (err: Error) => {
      log.error('Error in auto-updater:', err)
      this.sendToRenderer('update-error', {
        message: err.message,
        stack: err.stack
      })
    })

    autoUpdater.on('download-progress', (progress: UpdateProgress) => {
      log.info('Download progress:', progress)
      this.sendToRenderer('update-download-progress', progress)
    })

    autoUpdater.on('update-downloaded', (event: UpdateDownloadedEvent) => {
      log.info('Update downloaded:', event)
      this.sendToRenderer('update-downloaded', event)
    })
  }

  private sendToRenderer(channel: string, data?: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(`auto-updater:${channel}`, data)
    }
  }

  public async checkForUpdates(): Promise<void> {
    try {
      if (app.isPackaged) {
        await autoUpdater.checkForUpdatesAndNotify()
      } else {
        log.info('Skipping update check in development mode')
      }
    } catch (error) {
      log.error('Failed to check for updates:', error)
      this.sendToRenderer('update-error', {
        message: 'Failed to check for updates',
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  public async quitAndInstall(): Promise<void> {
    try {
      autoUpdater.quitAndInstall()
    } catch (error) {
      log.error('Failed to quit and install:', error)
      this.sendToRenderer('update-error', {
        message: 'Failed to install update',
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  public async getUpdateInfo(): Promise<ElectronUpdateInfo | null> {
    try {
      if (app.isPackaged) {
        const result = await autoUpdater.checkForUpdates()
        return result?.updateInfo || null
      }
      return null
    } catch (error) {
      log.error('Failed to get update info:', error)
      return null
    }
  }

  public destroy(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval)
      this.updateCheckInterval = null
    }
  }
}

export const autoUpdaterService = AutoUpdaterService.getInstance()
