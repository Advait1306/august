import AgentInterface from './agent-interface'
import { ClaudeCodeAgent } from './agents/claude-code/claude-code'
// import { CodexAgent } from './agents/codex'
// import { OpenCodeAgent } from './agents/opencode'
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import {
  asyncGeneratorOverIPCCloser,
  asyncGeneratorOverIPCSender
} from '@jupiter/shared/async-generator-over-ipc-sender'
import { agentRequestPermissionOverIPC } from '@jupiter/shared/agent-request-permission-over-ipc'
import { ModelMessage } from 'ai'

export class AgentAdapterMain {
  private static instance: AgentAdapterMain | null = null
  private agents: Record<string, AgentInterface> = {}

  private constructor() {
    // Base agents are mapped by their hardcoded IDs
    this.registerAgent('claude-code', new ClaudeCodeAgent())
    // this.registerAgent('codex', new CodexAgent())
    // this.registerAgent('opencode', new OpenCodeAgent())

    // IPC handler now uses agent ID instead of agent name
    ipcMain.handle(
      'agent:run',
      async (
        event,
        id: string,
        options: {
          messages: ModelMessage[]
          runConfig: Record<string, unknown>
          threadId: string
        },
        systemPrompt: string,
        pathToClaudeCode?: string,
        env?: Record<string, string>
      ) => {
        await this.runAgent(event, id, options, systemPrompt, pathToClaudeCode, env)
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
    runOptions: {
      messages: ModelMessage[]
      runConfig: Record<string, unknown>
      threadId: string
    },
    systemPrompt: string,
    pathToClaudeCode?: string,
    env?: Record<string, string>
  ): Promise<void> {
    // Run enhanced agent
    for await (const message of this.agents['claude-code'].run(
      runOptions,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (request: { toolName: string; input: Record<string, any>; threadId: string }) => {
        return agentRequestPermissionOverIPC(event, request)
      },
      systemPrompt,
      pathToClaudeCode,
      env
    )) {
      asyncGeneratorOverIPCSender(event, id, message)
    }

    asyncGeneratorOverIPCCloser(event, id)
  }
}
