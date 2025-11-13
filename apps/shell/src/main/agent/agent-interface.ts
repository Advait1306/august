import { AssistantModelMessage } from 'ai'
import { IPC } from '@jupiter/shared/ipc'

/**
 * Agent interface for all agents in the system.
 *
 * Implementing classes should cache expensive operations (like binary detection)
 * in a static variable to avoid re-running on every message.
 */
interface AgentInterface {
  run(
    params: IPC.Agent.RunParams,
    permissionRequest: (request: {
      toolName: string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input: Record<string, any>
      threadId: string
    }) => Promise<boolean>,
    signal?: AbortSignal
  ): AsyncGenerator<AssistantModelMessage, void>
}

export default AgentInterface
