import { AssistantModelMessage, ModelMessage } from 'ai'

/**
 * Agent interface for all agents in the system.
 *
 * Implementing classes should cache expensive operations (like binary detection)
 * in a static variable to avoid re-running on every message.
 */
interface AgentInterface {
  run(
    runOptions: {
      messages: ModelMessage[]
      runConfig: Record<string, unknown>
      threadId: string
    },
    permissionRequest: (request: {
      toolName: string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input: Record<string, any>
      threadId: string
    }) => Promise<boolean>,
    systemPrompt?: string,
    pathToClaudeCode?: string,
    env?: Record<string, string>
  ): AsyncGenerator<AssistantModelMessage, void>
}

export default AgentInterface
