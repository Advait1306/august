import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'
import { app } from 'electron'
import path from 'path'

const sqlite = new Database(path.join(app.getPath('userData'), 'jupiter-database.db'))
export const db = drizzle(sqlite, { schema })

export function initializeDatabase(): void {
  migrate(db, {
    migrationsFolder: app.isPackaged
      ? path.join(__dirname, '../../migrations') // prod
      : './migrations'
  })
}
