import { ipcMain } from 'electron'
import { agentService } from '../services/agent-service'
import type { NewAgent, NewAgentMemory } from '../db/schema'
import { discoverClaudeInstallations } from '../agent/agents/claude-code/find-claude-code'

export function registerAgentIpcHandlers(): void {
  // Base agents (limited operations)
  ipcMain.handle('base-agents:getAll', async () => {
    return await agentService.getAllBaseAgents()
  })

  ipcMain.handle('base-agents:updateApiKey', async (_, id: string, apiKey: string) => {
    return await agentService.updateBaseAgentApiKey(id, apiKey)
  })

  // Custom agents (full CRUD)
  ipcMain.handle('agents:getAll', async () => {
    return await agentService.getAllAgents()
  })

  ipcMain.handle('agents:create', async (_, data: Omit<NewAgent, 'id'>) => {
    return await agentService.createAgent(data)
  })

  ipcMain.handle('agents:get', async (_, id: string) => {
    return await agentService.getAgentWithMemories(id)
  })

  ipcMain.handle('agents:update', async (_, id: string, data: Partial<NewAgent>) => {
    return await agentService.updateAgent(id, data)
  })

  ipcMain.handle('agents:delete', async (_, id: string) => {
    await agentService.deleteAgent(id)
    return true
  })

  // Memories
  ipcMain.handle('agents:getMemories', async (_, agentId: string) => {
    return await agentService.getAgentMemories(agentId)
  })

  ipcMain.handle('agents:addMemory', async (_, data: Omit<NewAgentMemory, 'id'>) => {
    return await agentService.addMemory(data)
  })

  ipcMain.handle('agents:updateMemory', async (_, id: string, memory: string) => {
    return await agentService.updateMemory(id, memory)
  })

  ipcMain.handle('agents:deleteMemory', async (_, id: string) => {
    await agentService.deleteMemory(id)
    return true
  })

  // Claude Code installations
  ipcMain.handle('claude-code:discoverInstallations', async () => {
    return await discoverClaudeInstallations()
  })
}
