import { relations } from "drizzle-orm";
import {
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: varchar().primaryKey().notNull(),
});

export const baseAgent = pgEnum("base_agent", [
  "claude-code",
  "codex",
  "opencode",
]);

export const agents = pgTable("agents", {
  id: varchar().notNull().primaryKey(),
  name: varchar().notNull(),
  system_prompt: varchar().notNull(),
  base_agent: baseAgent().notNull(),
  created_at: timestamp().notNull().defaultNow(),
  author_id: varchar()
    .notNull()
    .references(() => users.id),
});

export const projects = pgTable("projects", {
  id: varchar().notNull().primaryKey(),
  name: varchar().notNull(),
  path: varchar().notNull(),
  created_at: timestamp().notNull().defaultNow(),
  author_id: varchar()
    .notNull()
    .references(() => users.id),
});

// TODO: Manage deletion of project
export const tasks = pgTable("tasks", {
  id: varchar().notNull().primaryKey(),
  name: varchar().notNull(),
  author_id: varchar()
    .notNull()
    .references(() => users.id),
  created_at: timestamp().notNull().defaultNow(),
  agent_id: varchar()
    .notNull()
    .references(() => agents.id),
  project_id: varchar()
    .notNull()
    .references(() => projects.id),
  updated_at: timestamp().notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar().notNull().primaryKey(),
  task_id: varchar()
    .notNull()
    .references(() => tasks.id),
  message_id: varchar().notNull(),
  role: varchar().notNull(),
  content: jsonb().notNull(),
  metadata: jsonb(),
  created_at: timestamp().notNull().defaultNow(),
});

// User relations
export const userToTaskRelation = relations(users, ({ many }) => ({
  tasks: many(tasks),
}));

export const userToAgentRelation = relations(users, ({ many }) => ({
  agents: many(agents),
}));

export const userToProjectRelation = relations(users, ({ many }) => ({
  projects: many(projects),
}));

// Agent relations
export const agentToUserRelation = relations(agents, ({ one }) => ({
  user: one(users, {
    fields: [agents.author_id],
    references: [users.id],
  }),
}));

export const agentToTaskRelation = relations(agents, ({ many }) => ({
  tasks: many(tasks),
}));

// Project relations
export const projectToUserRelation = relations(projects, ({ one }) => ({
  user: one(users, {
    fields: [projects.author_id],
    references: [users.id],
  }),
}));

export const projectToTaskRelation = relations(projects, ({ many }) => ({
  tasks: many(tasks),
}));

// Task relations
export const taskToUserRelation = relations(tasks, ({ one }) => ({
  user: one(users, {
    fields: [tasks.author_id],
    references: [users.id],
  }),
}));

export const taskToAgentRelation = relations(tasks, ({ one }) => ({
  agent: one(agents, {
    fields: [tasks.agent_id],
    references: [agents.id],
  }),
}));

export const taskToProjectRelation = relations(tasks, ({ one }) => ({
  project: one(projects, {
    fields: [tasks.project_id],
    references: [projects.id],
  }),
}));

export const taskToMessagesRelation = relations(tasks, ({ many }) => ({
  messages: many(messages),
}));

// Message relations
export const messageToTaskRelation = relations(messages, ({ one }) => ({
  task: one(tasks, {
    fields: [messages.task_id],
    references: [tasks.id],
  }),
}));
