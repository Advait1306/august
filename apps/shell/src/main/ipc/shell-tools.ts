import { ipcMain } from 'electron'
import { IPC_CHANNELS, IPC } from '@jupiter/shared/ipc'
import { shellToolsManifest, grep, glob, ls, edit, write, multiedit } from '@august/shell-tools'

/**
 * Tool executor map - maps tool names to their implementation functions
 */
const toolExecutors = {
  grep,
  glob,
  ls,
  edit,
  write,
  multiedit
} as const

export function registerShellToolsIpcHandlers(): void {
  // Get shell tools manifest (for runtime registration)
  ipcMain.handle(IPC_CHANNELS.SHELL_TOOLS.GET_MANIFEST, (): IPC.ShellTools.GetManifestResponse => {
    return shellToolsManifest
  })

  // Execute a shell tool
  ipcMain.handle(
    IPC_CHANNELS.SHELL_TOOLS.EXECUTE,
    async (_event: Electron.IpcMainInvokeEvent, request: IPC.ShellTools.ExecuteRequest) => {
      const { name, input } = request

      if (!(name in toolExecutors)) {
        throw new Error(`Unknown shell tool: ${name}`)
      }

      const executor = toolExecutors[name as keyof typeof toolExecutors]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (executor as any)(input)
    }
  )
}
