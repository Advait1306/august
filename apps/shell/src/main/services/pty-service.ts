import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { IPC_CHANNELS, IPC } from '@jupiter/shared/ipc'

interface PtyInstance {
  pty: pty.IPty
  terminalId: string
}

export class PtyService {
  private static instance: PtyService
  private mainWindow: BrowserWindow | null = null
  private terminals: Map<string, PtyInstance> = new Map()

  private constructor() {}

  public static getInstance(): PtyService {
    if (!PtyService.instance) {
      PtyService.instance = new PtyService()
    }
    return PtyService.instance
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  public create(request: IPC.Terminal.CreateRequest): IPC.Terminal.CreateResponse {
    try {
      const terminalId = randomUUID()

      const shell =
        process.platform === 'win32'
          ? process.env.COMSPEC || 'cmd.exe'
          : process.env.SHELL || '/bin/zsh'

      const cwd = request.cwd || process.env.HOME || process.cwd()
      console.log('[PtyService] Creating terminal with cwd:', cwd, 'shell:', shell)

      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: request.cols,
        rows: request.rows,
        cwd,
        env: { ...process.env, ...request.env } as Record<string, string>
      })

      ptyProcess.onData((data: string) => {
        this.sendToRenderer(IPC_CHANNELS.TERMINAL.DATA, {
          terminalId,
          data
        } as IPC.Terminal.DataEvent)
      })

      ptyProcess.onExit(({ exitCode, signal }) => {
        this.sendToRenderer(IPC_CHANNELS.TERMINAL.EXIT, {
          terminalId,
          exitCode,
          signal: signal !== undefined ? String(signal) : undefined
        } as IPC.Terminal.ExitEvent)
        this.terminals.delete(terminalId)
      })

      this.terminals.set(terminalId, { pty: ptyProcess, terminalId })

      return { success: true, terminalId }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  public write(request: IPC.Terminal.WriteRequest): IPC.Terminal.OperationResponse {
    const terminal = this.terminals.get(request.terminalId)
    if (!terminal) {
      return { success: false, error: 'Terminal not found' }
    }
    try {
      terminal.pty.write(request.data)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  public resize(request: IPC.Terminal.ResizeRequest): IPC.Terminal.OperationResponse {
    const terminal = this.terminals.get(request.terminalId)
    if (!terminal) {
      return { success: false, error: 'Terminal not found' }
    }
    try {
      terminal.pty.resize(request.cols, request.rows)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  public destroy(request: IPC.Terminal.DestroyRequest): IPC.Terminal.OperationResponse {
    const terminal = this.terminals.get(request.terminalId)
    if (!terminal) {
      return { success: false, error: 'Terminal not found' }
    }
    try {
      terminal.pty.kill()
      this.terminals.delete(request.terminalId)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  public destroyAll(): void {
    for (const [, terminal] of this.terminals) {
      try {
        terminal.pty.kill()
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.terminals.clear()
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }
}

export const ptyService = PtyService.getInstance()
