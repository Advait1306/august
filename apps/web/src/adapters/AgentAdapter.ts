import type { ChatModelAdapter, ChatModelRunOptions } from '@assistant-ui/react'

export const AgentAdapter: ChatModelAdapter = {
  async *run(runOptions: ChatModelRunOptions) {
    const runConfig = runOptions.runConfig
    const messages = runOptions.messages

    // runConfig can only be attached on a new thread run.
    // Hence we infer the agent and project based on previous messages for old threads
    const inferredAgent = (runConfig?.custom?.agent ??
      messages.find((m) => m.role === 'assistant')?.metadata?.custom?.agent) as string | undefined

    if (inferredAgent == null) {
      throw new Error('AgentAdapter: missing agent')
    }

    const threadId = runConfig?.custom?.threadId as string | undefined

    if (threadId == null) {
      throw new Error('AgentAdapter: missing threadId')
    }

    const response = window.api.agent.run(inferredAgent, {
      messages: runOptions.messages,
      runConfig: runOptions.runConfig,
      threadId
    })

    for await (const message of response) {
      yield message
    }
  }
}
