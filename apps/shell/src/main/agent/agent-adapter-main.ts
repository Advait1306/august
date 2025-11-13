import AgentInterface from './agent-interface'
import { ClaudeCodeAgent } from './agents/claude-code/claude-code'
// import { CodexAgent } from './agents/codex'
// import { OpenCodeAgent } from './agents/opencode'
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import {
  asyncGeneratorOverIPCCloser,
  asyncGeneratorOverIPCSender,
  asyncGeneratorOverIPCCancelListener
} from '@jupiter/shared/async-generator-over-ipc-sender'
import { agentRequestPermissionOverIPC } from '@jupiter/shared/agent-request-permission-over-ipc'
import { IPC_CHANNELS, IPC } from '@jupiter/shared/ipc'

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
      IPC_CHANNELS.AGENT.RUN,
      async (event: IpcMainInvokeEvent, params: IPC.Agent.RunParams) => {
        await this.runAgent(event, params)
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

  public async runAgent(event: IpcMainInvokeEvent, params: IPC.Agent.RunParams): Promise<void> {
    // Create an AbortController for cancellation
    const abortController = new AbortController()

    // Register cancel listener
    const cleanupCancelListener = asyncGeneratorOverIPCCancelListener(event, params.id, () => {
      abortController.abort()
    })

    try {
      // Run enhanced agent with abort signal
      for await (const message of this.agents['claude-code'].run(
        params,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (request: { toolName: string; input: Record<string, any>; threadId: string }) => {
          return agentRequestPermissionOverIPC(event, request)
        },
        abortController.signal
      )) {
        // Check if cancelled before sending each message
        if (abortController.signal.aborted) {
          break
        }
        asyncGeneratorOverIPCSender(event, params.id, message)
      }

      asyncGeneratorOverIPCCloser(event, params.id)
    } finally {
      // Always cleanup the cancel listener
      cleanupCancelListener()
    }
  }
}
