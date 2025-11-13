import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@jupiter/shared/ipc'
import { discoverClaudeInstallations } from '../agent/agents/claude-code/find-claude-code'

export function registerAgentIpcHandlers(): void {
  // Claude Code installations
  ipcMain.handle(IPC_CHANNELS.CLAUDE_CODE.DISCOVER_INSTALLATIONS, async () => {
    return await discoverClaudeInstallations()
  })
}
