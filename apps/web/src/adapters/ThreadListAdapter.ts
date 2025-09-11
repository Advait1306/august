import { type unstable_RemoteThreadListAdapter as RemoteThreadListAdapter } from '@assistant-ui/react'

export const ThreadListAdapter: RemoteThreadListAdapter = {
  async list() {
    const threads = await window.api.chat.getThreads()
    return {
      threads: threads.map((t) => ({
        status: t.status as 'regular' | 'archived',
        remoteId: t.id,
        title: t.title
      }))
    }
  },

  async initialize(threadId: string) {
    const thread = await window.api.chat.createThread(threadId)
    return { remoteId: thread.id, externalId: thread.id }
  },

  async rename(remoteId: string, newTitle: string) {
    await window.api.chat.updateThread(remoteId, { title: newTitle })
  },

  async archive(remoteId: string) {
    await window.api.chat.archiveThread(remoteId)
  },

  async unarchive(remoteId: string) {
    await window.api.chat.updateThread(remoteId, { status: 'regular' })
  },

  async delete(remoteId: string) {
    await window.api.chat.deleteThread(remoteId)
  },

  async generateTitle() {
    // const titlePrompt = `Generate a concise title (max 5 words) for this conversation: ${JSON.stringify(messages.slice(-3))}`
    return new ReadableStream()
    // try {
    //   const output = await window.api.agent.run('claude-code', {
    //     messages: [{ role: 'user', content: titlePrompt }],
    //     runConfig: {
    //       custom: {
    //         threadId: remoteId
    //       }
    //     }
    //     systemPrompt: 'Generate only a short title, no explanation',
    //     maxTurns: 1
    //   })

    //   const title = (output.result as string) || 'New Conversation'
    //   await window.api.chat.updateThread(remoteId, { title: title.slice(0, 50) })

    //   return new ReadableStream({
    //     start(controller) {
    //       controller.enqueue({
    //         type: 'part-start',
    //         path: [0],
    //         part: { type: 'text' }
    //       })

    //       const titleText = title.slice(0, 50)
    //       let index = 0

    //       const sendChar = () => {
    //         if (index < titleText.length) {
    //           controller.enqueue({
    //             type: 'text-delta',
    //             path: [0],
    //             textDelta: titleText[index]
    //           })
    //           index++
    //           setTimeout(sendChar, 30)
    //         } else {
    //           controller.enqueue({
    //             type: 'part-finish',
    //             path: [0]
    //           })
    //           controller.close()
    //         }
    //       }

    //       sendChar()
    //     }
    //   })
    // } catch (error) {
    //   console.error('Title generation failed:', error)
    //   return new ReadableStream()
    // }
  }
}
