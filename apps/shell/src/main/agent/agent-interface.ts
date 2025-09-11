import { ChatModelRunOptions, ChatModelRunResult } from '@assistant-ui/react'

interface AgentInterface {
  run(
    runOptions: {
      messages: ChatModelRunOptions['messages']
      runConfig: ChatModelRunOptions['runConfig']
      threadId: string
    },
    permissionRequest: (request: {
      toolName: string
      input: Record<string, any>
      threadId: string
    }) => Promise<boolean>,
    systemPrompt?: string
  ): AsyncGenerator<ChatModelRunResult, void>
}

export default AgentInterface
