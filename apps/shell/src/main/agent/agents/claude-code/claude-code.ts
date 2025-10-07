import AgentInterface from '../../agent-interface'
import { query } from '@anthropic-ai/claude-code'
import assert from 'node:assert'
import log from 'electron-log/main'
import { findClaudeBinary } from './find-claude-code'
import {
  AssistantContent,
  AssistantModelMessage,
  ModelMessage,
  TextPart,
  UserModelMessage
} from 'ai'

export class ClaudeCodeAgent implements AgentInterface {
  async *run(
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
  ): AsyncGenerator<AssistantModelMessage, void> {
    // Claude code doesn't take old messages, it takes a session id that's generated and stored in all assistant messages
    const sessionId = runOptions.messages.findLast((m) => m.role === 'assistant')?.providerOptions
      ?.claude?.session_id as string | undefined

    const project = (runOptions.runConfig.project ??
      runOptions.messages.find((m) => m.role === 'assistant')?.providerOptions?.claude?.project) as
      | {
          id: string
          path: string
        }
      | undefined

    assert(project != null, 'ClaudeCodeAgent: missing project')

    // Last message will always be user message
    const lastMessage = runOptions.messages[runOptions.messages.length - 1] as UserModelMessage

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output: any = []

    // Workaround for canUseTool - [https://github.com/anthropics/claude-code/issues/4775#issuecomment-3141104425]
    let done
    const receivedResult = new Promise((resolve) => {
      done = resolve
    })

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
                content: (lastMessage.content[0] as TextPart).text
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
          if (data.type !== 'assistant' && data.type !== 'result') {
            console.log('Skipping message type: ', data.type)
            continue
          }

          if (data.type === 'assistant') {
            output.push(...data.message.content)
            yield {
              role: 'assistant',
              content: this.convertToGenericContent(output),
              providerOptions: {
                claude: {
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
  private convertToGenericContent(parts: any[]): AssistantContent {
    const content: AssistantContent = []

    for (const part of parts) {
      switch (part.type) {
        case 'tool_use':
          content.push({
            type: 'tool-call',
            toolCallId: part.id,
            toolName: part.name,
            input: part.input
            // argsText: JSON.stringify(part.input)
          })
          break
        case 'tool_result': {
          content.push({
            type: 'tool-result',
            toolCallId: part.tool_use_id,
            toolName: part.name,
            output: part.content
          })
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
