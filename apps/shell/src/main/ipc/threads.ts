import { ipcMain } from 'electron'
import { db } from '../db'
import { threads } from '../db/schema'
import { eq, desc } from 'drizzle-orm'

export function registerThreadIpcHandlers(): void {
  ipcMain.handle('threads:getAll', async () => {
    return await db.select().from(threads).orderBy(desc(threads.updatedAt))
  })

  ipcMain.handle('threads:create', async (_, threadId: string) => {
    const newThread = {
      id: threadId,
      title: 'New Conversation',
      status: 'regular' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const thread = await db.insert(threads).values(newThread).returning()
    return thread[0]
  })

  ipcMain.handle('threads:update', async (_, id, updates) => {
    const result = await db
      .update(threads)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(threads.id, id))
      .returning()
    return result[0]
  })

  ipcMain.handle('threads:delete', async (_, id) => {
    await db.delete(threads).where(eq(threads.id, id))
    return true
  })

  ipcMain.handle('threads:archive', async (_, id) => {
    const result = await db
      .update(threads)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(threads.id, id))
      .returning()
    return result[0]
  })
}
