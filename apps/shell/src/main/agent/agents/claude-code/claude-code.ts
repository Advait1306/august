import AgentInterface from '../../agent-interface'
import { query } from '@anthropic-ai/claude-agent-sdk'
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
  private static agentInfo: { path: string; env: NodeJS.ProcessEnv } | null = null
  private static initPromise: Promise<void> | null = null

  constructor() {
    if (ClaudeCodeAgent.initPromise === null) {
      ClaudeCodeAgent.initPromise = this.initialize()
    }
  }

  private async initialize(): Promise<void> {
    if (ClaudeCodeAgent.agentInfo === null) {
      log.info('Finding Claude executable...')
      const binary = await findClaudeBinary()
      log.debug('Found Claude executable:', binary)
      ClaudeCodeAgent.agentInfo = binary
      log.info('Initialized Claude executable:', ClaudeCodeAgent.agentInfo.path)
    }
  }

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
    systemPrompt?: string,
    pathToClaudeCode?: string,
    env?: Record<string, string>
  ): AsyncGenerator<AssistantModelMessage, void> {
    log.info('ClaudeCodeAgent.run called', {
      threadId: runOptions.threadId,
      messageCount: runOptions.messages.length,
      hasSystemPrompt: !!systemPrompt
    })

    // Claude code doesn't take old messages, it takes a session id
    // that's generated and stored in assistant messages.
    //
    // NOTE: The session id changes with every new message, which is done
    // to allow branching of chats. Hence we look for the last assistant message and
    // use it's session id. Claude code will automatically string together the chat chain.
    const sessionId = runOptions.messages.findLast((m) => m.role === 'assistant')?.providerOptions
      ?.claude?.sessionId as string | undefined

    log.info('Resolved session ID:', sessionId || 'new session')

    const project = (runOptions.runConfig.project ??
      runOptions.messages.find((m) => m.role === 'assistant')?.providerOptions?.claude?.project) as
      | {
          id: string
          path: string
        }
      | undefined

    log.info('Resolved project:', project)
    assert(project != null, 'ClaudeCodeAgent: missing project')

    // Last message will always be user message
    const lastMessage = runOptions.messages[runOptions.messages.length - 1] as UserModelMessage
    log.info('Last message:', {
      role: lastMessage.role,
      contentLength: JSON.stringify(lastMessage.content).length
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output: any = []

    // Workaround for canUseTool - [https://github.com/anthropics/claude-code/issues/4775#issuecomment-3141104425]
    let done
    const receivedResult = new Promise((resolve) => {
      done = resolve
    })

    try {
      // Wait for initialization to complete
      log.info('Waiting for initialization...')
      if (ClaudeCodeAgent.initPromise) {
        await ClaudeCodeAgent.initPromise
      }
      log.info('Initialization complete')

      if (ClaudeCodeAgent.agentInfo === null) {
        log.error('ClaudeCodeAgent.agentInfo is null after initialization')
        throw new Error('ClaudeCodeAgent not initialized properly.')
      }

      const agentInfo = ClaudeCodeAgent.agentInfo
      log.info('Using Claude executable:', agentInfo.path)

      // Merge provided env with agentInfo.env
      const mergedEnv = { ...agentInfo.env, ...env }

      try {
        log.info('Starting query to Claude Code binary', {
          cwd: project.path,
          hasSessionId: !!sessionId,
          hasSystemPrompt: !!systemPrompt
        })

        log.info('Path to Claude Code executable:', pathToClaudeCode)
        log.info('Environment:', mergedEnv)

        for await (const data of query({
          prompt: (async function* () {
            log.info('Yielding user prompt to Claude Code')
            yield {
              type: 'user' as const,
              message: {
                role: 'user' as const,
                content: (lastMessage.content[0] as TextPart).text
              },
              parent_tool_use_id: null,
              session_id: sessionId || ''
            }
            log.info('Waiting for receivedResult promise...')
            await receivedResult
            log.info('receivedResult resolved')
          })(),
          options: {
            pathToClaudeCodeExecutable: pathToClaudeCode,
            env: mergedEnv,
            resume: sessionId,
            cwd: project.path,
            systemPrompt: { type: 'preset', preset: 'claude_code', append: systemPrompt },
            canUseTool: async (toolName, input) => {
              log.debug('Permission requested for tool:', toolName)
              if (
                await permissionRequest({
                  toolName,
                  input,
                  threadId: runOptions.threadId
                })
              ) {
                log.debug('Tool permission granted:', toolName)
                return { behavior: 'allow', updatedInput: input }
              } else {
                log.debug('Tool permission denied:', toolName)
                return { behavior: 'deny', message: 'Permission denied' }
              }
            }
          }
        })) {
          log.debug('Received data from Claude Code:', { type: data.type })

          // We also let the user message type through as
          // tool results in CC SDK are treated as sent by user
          if (data.type !== 'assistant' && data.type !== 'result' && data.type !== 'user') {
            log.warn('Skipping message type:', data.type)
            console.log('Skipping message type: ', data.type)
            continue
          }

          if (data.type === 'assistant' || data.type === 'user') {
            log.debug('Processing assistant/user message', {
              contentLength: data.message.content.length,
              sessionId: data.session_id
            })
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
            log.info('Received result type, calling done() and returning')
            done()
            return
          }
        }
        log.info('Query loop completed without result type')
      } catch (error) {
        log.error('Error in ClaudeCodeAgent query loop:', error)
        console.error('Error in ClaudeCodeAgent query loop:', error)
        throw error
      }
    } catch (error) {
      log.error('Error in ClaudeCodeAgent initialization or execution:', error)
      throw error
    } finally {
      log.info('ClaudeCodeAgent.run completed', { threadId: runOptions.threadId })
    }
  }

  // TODO: Fix type of parts, anthropic SDK doesn't expose for some reason
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private convertToGenericContent(parts: any[]): AssistantContent {
    log.debug('Converting content parts:', { partCount: parts.length })
    const content: AssistantContent = []

    for (const part of parts) {
      log.debug('Converting part type:', part.type)
      switch (part.type) {
        case 'tool_use':
          log.debug('Converting tool_use:', { toolName: part.name, toolId: part.id })
          content.push({
            type: 'tool-call',
            toolCallId: part.id,
            toolName: part.name,
            input: part.input
            // argsText: JSON.stringify(part.input)
          })
          break
        case 'tool_result': {
          log.debug('Converting tool_result:', { toolName: part.name, toolUseId: part.tool_use_id })
          content.push({
            type: 'tool-result',
            toolCallId: part.tool_use_id,
            toolName: part.name,
            output: part.content
          })
          break
        }
        case 'text':
          log.debug('Converting text:', { textLength: part.text?.length || 0 })
          content.push({
            type: 'text',
            text: part.text
          })
          break
        default:
          log.error('ClaudeCodeAgent: unknown message part type:', part.type)
          console.error('ClaudeCodeAgent: unknown message part type: ', part.type)
          content.push({
            type: 'text',
            text: 'Unknown message part type: ' + part.type
          })
          break
      }
    }

    log.debug('Converted content:', { outputPartCount: content.length })
    return content
  }
}
