import { ChatModelRunOptions } from '@assistant-ui/react'
import AgentInterface from './agent-interface'
import { ClaudeCodeAgent } from './agents/claude-code'
import { CodexAgent } from './agents/codex'
import { OpenCodeAgent } from './agents/opencode'
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import {
  asyncGeneratorOverIPCCloser,
  asyncGeneratorOverIPCSender
} from '@jupiter/shared/async-generator-over-ipc-sender'
import { agentRequestPermissionOverIPC } from '@jupiter/shared/agent-request-permission-over-ipc'
import { agentService } from '../services/agent-service'

export class AgentAdapterMain {
  private static instance: AgentAdapterMain | null = null
  private agents: Record<string, AgentInterface> = {}

  private constructor() {
    // Base agents are mapped by their hardcoded IDs
    this.registerAgent('claude-code', new ClaudeCodeAgent())
    this.registerAgent('codex', new CodexAgent())
    this.registerAgent('opencode', new OpenCodeAgent())

    // IPC handler now uses agent ID instead of agent name
    ipcMain.handle(
      'agent:run',
      async (
        event,
        id: string,
        agentId: string,
        options: {
          messages: ChatModelRunOptions['messages']
          runConfig: ChatModelRunOptions['runConfig']
          threadId: string
        }
      ) => {
        await this.runAgent(event, id, agentId, options)
      }
    )
  }

  public static getInstance(): AgentAdapterMain {
    if (AgentAdapterMain.instance === null) {
      AgentAdapterMain.instance = new AgentAdapterMain()
    }

    return AgentAdapterMain.instance
  }

  public registerAgent(name: string, agent: AgentInterface): void {
    this.agents[name] = agent
  }

  public async runAgent(
    event: IpcMainInvokeEvent,
    id: string,
    agentId: string,
    runOptions: {
      messages: ChatModelRunOptions['messages']
      runConfig: ChatModelRunOptions['runConfig']
      threadId: string
    }
  ): Promise<void> {
    // Get custom agent + base agent + memories from DB
    const agentDetails = await agentService.getAgentWithMemories(agentId)

    // Get base agent implementation using hardcoded mapping
    const baseAgent = this.agents[agentDetails.baseAgent.id]
    if (!baseAgent) {
      throw new Error(`AgentAdapterMain: base agent ${agentDetails.baseAgent.id} not found`)
    }

    // Combine system prompt with memories
    const enhancedSystemPrompt = this.buildEnhancedSystemPrompt(agentDetails)

    // Run enhanced agent
    for await (const message of baseAgent.run(
      runOptions,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (request: { toolName: string; input: Record<string, any>; threadId: string }) => {
        return agentRequestPermissionOverIPC(event, request)
      },
      enhancedSystemPrompt
    )) {
      asyncGeneratorOverIPCSender(event, id, message)
    }

    asyncGeneratorOverIPCCloser(event, id)
  }

  private buildEnhancedSystemPrompt(agentDetails: {
    name: string
    systemPrompt: string
    memories: Array<{ memory: string }>
    baseAgent: { name: string }
  }): string {
    // Combine system prompt with memories
    let enhancedSystemPrompt = agentDetails.systemPrompt

    if (agentDetails.memories.length > 0) {
      enhancedSystemPrompt += '\n\n# Agent Memories:\n'
      agentDetails.memories.forEach((mem, index) => {
        enhancedSystemPrompt += `${index + 1}. ${mem.memory}\n`
      })
    }

    return enhancedSystemPrompt
  }
}
