import { ipcMain } from 'electron'
import { db } from '../db'
import { messages } from '../db/schema'
import { eq } from 'drizzle-orm'

export function registerMessageIpcHandlers(): void {
  ipcMain.handle('messages:getByThread', async (_, threadId) => {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.threadId, threadId))
      .orderBy(messages.createdAt)
  })

  ipcMain.handle('messages:save', async (_, message) => {
    const newMessage = {
      id: message.id,
      threadId: message.threadId,
      role: message.role,
      content: JSON.stringify(message.content),
      createdAt: message.createdAt || new Date(),
      metadata: JSON.stringify(message.metadata)
    }

    const result = await db.insert(messages).values(newMessage).returning()
    return result[0]
  })

  ipcMain.handle('messages:delete', async (_, id) => {
    await db.delete(messages).where(eq(messages.id, id))
    return true
  })
}
