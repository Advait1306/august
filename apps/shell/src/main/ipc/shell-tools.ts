import { ipcMain } from 'electron'
import { IPC_CHANNELS, IPC } from '@jupiter/shared/ipc'
import {
  shellToolsManifest,
  grep,
  glob,
  ls,
  edit,
  write,
  multiedit,
  bash,
  type GrepInput,
  type GrepOutput,
  type GlobInput,
  type GlobOutput,
  type LsInput,
  type LsOutput,
  type EditInput,
  type EditOutput,
  type WriteInput,
  type WriteOutput,
  type MultiEditInput,
  type MultiEditOutput,
  type BashInput,
  type BashOutput
} from '@august/shell-tools'

/**
 * Union types for all tool inputs and outputs
 */
type ToolInput =
  | GrepInput
  | GlobInput
  | LsInput
  | EditInput
  | WriteInput
  | MultiEditInput
  | BashInput
type ToolOutput =
  | GrepOutput
  | GlobOutput
  | LsOutput
  | EditOutput
  | WriteOutput
  | MultiEditOutput
  | BashOutput

/**
 * Type mapping from tool names to their input/output types
 */
type ToolExecutorMap = {
  grep: (input: GrepInput) => Promise<GrepOutput>
  glob: (input: GlobInput) => Promise<GlobOutput>
  ls: (input: LsInput) => Promise<LsOutput>
  edit: (input: EditInput) => Promise<EditOutput>
  write: (input: WriteInput) => Promise<WriteOutput>
  multiedit: (input: MultiEditInput) => Promise<MultiEditOutput>
  bash: (input: BashInput) => Promise<BashOutput>
}

/**
 * Tool executor map - maps tool names to their implementation functions
 */
const toolExecutors: ToolExecutorMap = {
  grep,
  glob,
  ls,
  edit,
  write,
  multiedit,
  bash
}

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

      const toolName = name as keyof ToolExecutorMap
      const executor = toolExecutors[toolName] as (input: ToolInput) => Promise<ToolOutput>
      return await executor(input as ToolInput)
    }
  )
}
