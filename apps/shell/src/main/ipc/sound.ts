import { ipcMain } from 'electron'
import { exec } from 'child_process'
import { IPC_CHANNELS } from '@jupiter/shared/ipc'

const SYSTEM_SOUNDS_PATH = '/System/Library/Sounds'

export function registerSoundIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.SOUND.PLAY,
    async (_event, soundName: string): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        const soundPath = `${SYSTEM_SOUNDS_PATH}/${soundName}.aiff`
        exec(`afplay "${soundPath}"`, (error) => {
          if (error) {
            console.error('Failed to play sound:', error)
            resolve({ success: false, error: error.message })
          } else {
            resolve({ success: true })
          }
        })
      })
    }
  )
}
