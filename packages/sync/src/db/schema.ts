import { relations } from "drizzle-orm";
import {
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: varchar().primaryKey().notNull(),
});

export const organisations = pgTable("organisations", {
  id: varchar().primaryKey().notNull(),
  payment_id: varchar(),
  wallet: doublePrecision().notNull().default(0.0),
});

export const usage = pgTable("usage", {
  organisation_id: varchar()
    .notNull()
    .references(() => organisations.id),
  model: varchar().notNull(),
  input_tokens: integer().notNull(),
  output_tokens: integer().notNull(),
  cache_creation_input_tokens: integer().notNull(),
  cache_read_input_tokens: integer().notNull(),
  cost: doublePrecision().notNull().default(0.0),
  created_at: timestamp().notNull().defaultNow(),
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
  organisation_id: varchar()
    .notNull()
    .references(() => organisations.id),
  author_id: varchar()
    .notNull()
    .references(() => users.id),
});

export const projects = pgTable("projects", {
  id: varchar().notNull().primaryKey(),
  name: varchar().notNull(),
  path: varchar().notNull(),
  created_at: timestamp().notNull().defaultNow(),
  organisation_id: varchar()
    .notNull()
    .references(() => organisations.id),
  author_id: varchar()
    .notNull()
    .references(() => users.id),
});

// TODO: Manage deletion of project
export const tasks = pgTable("tasks", {
  id: varchar().notNull().primaryKey(),
  name: varchar().notNull(),
  organisation_id: varchar()
    .notNull()
    .references(() => organisations.id),
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
export const userkRelations = relations(users, ({ many }) => ({
  tasks: many(tasks),
  agents: many(agents),
  projects: many(projects),
}));

// Organisation relations
export const organisationRelations = relations(organisations, ({ many }) => ({
  agents: many(agents),
  projects: many(projects),
  tasks: many(tasks),
}));

// Agent relations
export const agentRelations = relations(agents, ({ one, many }) => ({
  user: one(users, {
    fields: [agents.author_id],
    references: [users.id],
  }),
  tasks: many(tasks),
  organisation: one(organisations, {
    fields: [agents.organisation_id],
    references: [organisations.id],
  }),
}));

// Project relations
export const projectRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.author_id],
    references: [users.id],
  }),
  tasks: many(tasks),
  organisation: one(organisations, {
    fields: [projects.organisation_id],
    references: [organisations.id],
  }),
}));

// Task relations
export const taskRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, {
    fields: [tasks.author_id],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [tasks.agent_id],
    references: [agents.id],
  }),
  project: one(projects, {
    fields: [tasks.project_id],
    references: [projects.id],
  }),
  messages: many(messages),
  organisation: one(organisations, {
    fields: [tasks.organisation_id],
    references: [organisations.id],
  }),
}));

// Message relations
export const messageRelations = relations(messages, ({ one }) => ({
  task: one(tasks, {
    fields: [messages.task_id],
    references: [tasks.id],
  }),
}));
