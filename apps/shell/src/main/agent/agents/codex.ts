// import AgentInterface from '../agent-interface'

// export class CodexAgent implements AgentInterface {
//   async *run(
//     _runOptions: {
//       messages: ChatModelRunOptions['messages']
//       runConfig: ChatModelRunOptions['runConfig']
//       threadId: string
//     },
//     _permissionRequest: (request: {
//       toolName: string
//       input: Record<string, any>
//       threadId: string
//     }) => Promise<boolean>,
//     _systemPrompt?: string
//   ): AsyncGenerator<ChatModelRunResult, void> {
//     // TODO: Implement Codex agent functionality
//     // For now, return an error message
//     yield {
//       content: [
//         {
//           type: 'text' as const,
//           text: 'Codex agent is not yet implemented. Please use Claude Code agent instead.'
//         }
//       ],
//       metadata: {
//         custom: {}
//       }
//     }
//   }
// }
