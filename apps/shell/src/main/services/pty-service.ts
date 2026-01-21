import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import * as os from 'os'
import * as path from 'path'
import { IPC_CHANNELS, IPC } from '@jupiter/shared/ipc'
import { shellEnvSync } from 'shell-env'

// Blocklist of dangerous environment variables that could be used for injection attacks
// Note: PATH is intentionally NOT blocked - it's needed for tools like docker, git, etc.
const BLOCKED_ENV_VARS = ['LD_PRELOAD', 'DYLD_INSERT_LIBRARIES', 'LD_LIBRARY_PATH']

// Cache the shell environment to avoid repeated shell spawns
let cachedShellEnv: Record<string, string> | null = null

function getShellEnv(): Record<string, string> {
  if (!cachedShellEnv) {
    try {
      cachedShellEnv = shellEnvSync()
    } catch {
      // Fallback to process.env if shell-env fails
      cachedShellEnv = process.env as Record<string, string>
    }
  }
  return cachedShellEnv
}

interface PtyInstance {
  pty: pty.IPty
  terminalId: string
}

export class PtyService {
  private static instance: PtyService
  private mainWindow: BrowserWindow | null = null
  private terminals: Map<string, PtyInstance> = new Map()

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  /**
   * Validates that the given cwd is within the user's home directory.
   * Returns the validated cwd or falls back to home directory if invalid.
   */
  private validateCwd(requestedCwd: string | undefined): string {
    const homeDir = os.homedir()

    if (!requestedCwd) {
      return homeDir
    }

    try {
      const resolvedCwd = path.resolve(requestedCwd)
      const normalizedHome = path.resolve(homeDir)

      // Check if resolved path starts with home directory
      if (resolvedCwd.startsWith(normalizedHome + path.sep) || resolvedCwd === normalizedHome) {
        return resolvedCwd
      }

      // Path is outside home directory, fall back to home
      console.warn(
        '[PtyService] Requested cwd outside home directory, falling back to home:',
        requestedCwd
      )
      return homeDir
    } catch {
      return homeDir
    }
  }

  /**
   * Sanitizes environment variables by removing dangerous entries from user-provided env.
   * Uses shell-env to get the full shell environment (including proper PATH).
   */
  private sanitizeEnv(userEnv: Record<string, string> | undefined): Record<string, string> {
    const shellEnv = getShellEnv()

    if (!userEnv) {
      return { ...shellEnv }
    }

    const sanitizedUserEnv = { ...userEnv }
    for (const blockedVar of BLOCKED_ENV_VARS) {
      delete sanitizedUserEnv[blockedVar]
    }

    return { ...shellEnv, ...sanitizedUserEnv }
  }

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

      const cwd = this.validateCwd(request.cwd)
      const env = this.sanitizeEnv(request.env)
      console.log('[PtyService] Creating terminal with cwd:', cwd, 'shell:', shell)

      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: request.cols,
        rows: request.rows,
        cwd,
        env
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
