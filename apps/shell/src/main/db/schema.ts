import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  path: text('path').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
})

export const threads = sqliteTable('threads', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  remoteId: text('remote_id'), // For assistant-ui integration
  status: text('status').notNull().default('regular'), // 'regular' | 'archived'
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
})

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  threadId: text('thread_id')
    .notNull()
    .references(() => threads.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' | 'assistant' | 'system' | 'tool'
  content: text('content', { mode: 'json' }).notNull(), // Store as JSON array
  metadata: text('metadata', { mode: 'json' }), // Store as JSON object
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
})

export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
export type UpdateProject = Pick<Project, 'name' | 'path'>

export type Thread = typeof threads.$inferSelect
export type NewThread = typeof threads.$inferInsert
export type UpdateThread = Partial<Pick<Thread, 'title' | 'status'>>

// Base Agent entity (hardcoded, populated at app launch)
export const baseAgents = sqliteTable('base_agents', {
  id: text('id').primaryKey(), // Hardcoded IDs like 'claude-code', 'codex', 'opencode'
  name: text('name').notNull(),
  apiKey: text('api_key'), // Only this field can be updated by users
  isBuiltIn: integer('is_built_in', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
})

// Customized Agent entity (user-created)
export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  baseAgentId: text('base_agent_id')
    .notNull()
    .references(() => baseAgents.id, { onDelete: 'restrict' }), // Restrict to prevent deletion of base agents
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
})

// Agent Memory entity
export const agentMemories = sqliteTable('agent_memories', {
  id: text('id').primaryKey(),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  memory: text('memory').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
})

export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert

export type BaseAgent = typeof baseAgents.$inferSelect
export type NewBaseAgent = typeof baseAgents.$inferInsert
export type Agent = typeof agents.$inferSelect
export type NewAgent = typeof agents.$inferInsert
export type AgentMemory = typeof agentMemories.$inferSelect
export type NewAgentMemory = typeof agentMemories.$inferInsert
