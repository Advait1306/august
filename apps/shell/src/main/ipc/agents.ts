import { ipcMain } from 'electron'
import { discoverClaudeInstallations } from '../agent/agents/claude-code/find-claude-code'

export function registerAgentIpcHandlers(): void {
  // Claude Code installations
  ipcMain.handle('claude-code:discoverInstallations', async () => {
    return await discoverClaudeInstallations()
  })
}
