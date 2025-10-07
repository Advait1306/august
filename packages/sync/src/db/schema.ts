import { relations } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: varchar().primaryKey().notNull(),
});

export const tasks = pgTable("tasks", {
  id: varchar().notNull().primaryKey(),
  name: varchar().notNull(),
  author_id: varchar()
    .notNull()
    .references(() => users.id),
  created_at: timestamp().notNull().defaultNow(),
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

export const userToTaskRelation = relations(users, ({ many }) => ({
  tasks: many(tasks),
}));

export const taskToUserRelation = relations(tasks, ({ one }) => ({
  user: one(users, {
    fields: [tasks.author_id],
    references: [users.id],
  }),
}));

export const messageToTaskRelation = relations(messages, ({ one }) => ({
  task: one(tasks, {
    fields: [messages.task_id],
    references: [tasks.id],
  }),
}));

export const taskToMessagesRelation = relations(tasks, ({ many }) => ({
  messages: many(messages),
}));
