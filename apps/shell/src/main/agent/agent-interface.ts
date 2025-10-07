import { AssistantModelMessage, ModelMessage } from 'ai'

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
    systemPrompt?: string
  ): AsyncGenerator<AssistantModelMessage, void>
}

export default AgentInterface
