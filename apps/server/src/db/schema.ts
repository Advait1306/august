import { relations } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  user_id: varchar().unique().notNull(),
});

export const tasks = pgTable("tasks", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  name: varchar(),
  remote_id: varchar().notNull().unique(),
  author_id: integer()
    .notNull()
    .references(() => users.id),
  created_at: timestamp().notNull().defaultNow(),
  updated_at: timestamp().notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  thread_id: integer()
    .notNull()
    .references(() => tasks.id),
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

export const messageToThreadRelation = relations(messages, ({ one }) => ({
  thread: one(tasks, {
    fields: [messages.thread_id],
    references: [tasks.id],
  }),
}));

export const threadToMessagesRelation = relations(tasks, ({ many }) => ({
  messages: many(messages),
}));
