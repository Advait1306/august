import {
  ChatModelRunOptions,
  ChatModelRunResult,
  TextMessagePart,
  ThreadAssistantMessagePart,
  ThreadUserMessage,
  ToolCallMessagePart
} from '@assistant-ui/react'
import AgentInterface from '../../agent-interface'
import { query } from '@anthropic-ai/claude-code'
import assert from 'node:assert'
import log from 'electron-log/main'
import { findClaudeBinary } from './find-claude-code'

export class ClaudeCodeAgent implements AgentInterface {
  async *run(
    runOptions: {
      messages: ChatModelRunOptions['messages']
      runConfig: ChatModelRunOptions['runConfig']
      threadId: string
    },
    permissionRequest: (request: {
      toolName: string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input: Record<string, any>
      threadId: string
    }) => Promise<boolean>,
    systemPrompt?: string
  ): AsyncGenerator<ChatModelRunResult, void> {
    // Claude code doesn't take old messages, it takes a session id that's generated and stored in all assistant messages
    const sessionId = runOptions.messages.find((m) => m.role === 'assistant')?.metadata?.custom
      ?.sessionId as string | undefined

    const project = (runOptions.runConfig.custom?.project ??
      runOptions.messages.find((m) => m.role === 'assistant')?.metadata?.custom?.project) as
      | {
          id: string
          path: string
        }
      | undefined

    assert(project != null, 'ClaudeCodeAgent: missing project')

    // Last message will always be user message
    const lastMessage = runOptions.messages[runOptions.messages.length - 1] as ThreadUserMessage

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output: any[] = []

    // Workaround for canUseTool - [https://github.com/anthropics/claude-code/issues/4775#issuecomment-3141104425]
    let done
    const receivedResult = new Promise((resolve) => {
      done = resolve
    })

    log.info('Project: ', project.path)
    // Find the claude executable path and environment

    try {
      const claudeInfo = findClaudeBinary()
      log.info('Using Claude executable:', claudeInfo.path)

      try {
        for await (const data of query({
          prompt: (async function* () {
            yield {
              type: 'user' as const,
              message: {
                role: 'user' as const,
                content: (lastMessage.content[0] as TextMessagePart).text
              },
              parent_tool_use_id: null,
              session_id: sessionId || ''
            }
            await receivedResult
          })(),
          options: {
            pathToClaudeCodeExecutable: claudeInfo.path,
            env: claudeInfo.env,
            resume: sessionId,
            cwd: project.path,
            appendSystemPrompt: systemPrompt,
            canUseTool: async (toolName, input) => {
              if (
                await permissionRequest({
                  toolName,
                  input,
                  threadId: runOptions.threadId
                })
              ) {
                return { behavior: 'allow', updatedInput: input }
              } else {
                return { behavior: 'deny', message: 'Permission denied' }
              }
            }
          }
        })) {
          if (data.type === 'system') {
            continue
          }

          if (data.type === 'assistant' || data.type === 'user') {
            output.push(...data.message.content)
            yield {
              content: this.convertToGenericContent(output),
              metadata: {
                custom: {
                  sessionId: data.session_id,
                  agent: 'claude-code',
                  project
                }
              }
            }
          }

          if (data.type === 'result') {
            done()
            return
          }
        }
      } catch (error) {
        log.error('Error in ClaudeCodeAgent:', error)
        console.error('Error in ClaudeCodeAgent:', error)
      }
    } catch (error) {
      log.error('Error executing "which claude":', error)
    }
  }

  // TODO: Fix type of parts, anthropic SDK doesn't expose for some reason
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private convertToGenericContent(parts: any[]): ThreadAssistantMessagePart[] {
    const content: ThreadAssistantMessagePart[] = []

    for (const part of parts) {
      switch (part.type) {
        case 'tool_use':
          content.push({
            type: 'tool-call',
            toolCallId: part.id,
            toolName: part.name,
            args: part.input,
            argsText: JSON.stringify(part.input)
          })
          break
        case 'tool_result': {
          const existingToolCallIndex = content.findIndex(
            (c) => c.type === 'tool-call' && c.toolCallId === part.tool_use_id
          )
          if (existingToolCallIndex !== -1) {
            const existingToolCall = content[existingToolCallIndex] as ToolCallMessagePart
            content.splice(existingToolCallIndex, 1, {
              ...existingToolCall,
              result: part.content
            })
          }
          break
        }
        case 'text':
          content.push({
            type: 'text',
            text: part.text
          })
          break
        default:
          console.error('ClaudeCodeAgent: unknown message part type: ', part.type)
          content.push({
            type: 'text',
            text: 'Unknown message part type: ' + part.type
          })
          break
      }
    }

    return content
  }
}
