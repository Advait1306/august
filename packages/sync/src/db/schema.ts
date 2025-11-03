import { relations } from "drizzle-orm";
import {
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
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
  id: serial().primaryKey(),
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

// MCP Store - Global catalog of pre-configured integrations
export const mcpStore = pgTable("mcp_store", {
  id: varchar().primaryKey().notNull(),
  slug: varchar().unique().notNull(),
  name: varchar().notNull(),
  description: varchar(),
  logo_url: varchar(),
  category: varchar(),
  mcp_server_url: varchar().notNull(),
  default_scopes: varchar(),
  is_active: integer().notNull().default(1), // Using integer for boolean (0 or 1)
  sort_order: integer(),
  metadata: jsonb(),
  created_at: timestamp().notNull().defaultNow(),
  updated_at: timestamp().notNull().defaultNow(),
});

// MCPs - Per-user, per-org MCP instances
export const mcps = pgTable("mcps", {
  id: varchar().primaryKey().notNull(),
  organisation_id: varchar()
    .notNull()
    .references(() => organisations.id),
  author_id: varchar()
    .notNull()
    .references(() => users.id),
  mcp_store_id: varchar().references(() => mcpStore.id),
  name: varchar().notNull(),
  custom_mcp_url: varchar(),
  custom_description: varchar(),
  mcp_server_url: varchar().notNull(),
  oauth_client_id: varchar(),
  oauth_client_secret: varchar(), // Encrypted
  oauth_metadata: jsonb(),
  created_at: timestamp().notNull().defaultNow(),
  updated_at: timestamp().notNull().defaultNow(),
});

// OAuth Connections - Links users to their MCPs via OAuth
export const oauthConnections = pgTable("oauth_connections", {
  id: varchar().primaryKey().notNull(),
  user_id: varchar()
    .notNull()
    .references(() => users.id),
  organisation_id: varchar()
    .notNull()
    .references(() => organisations.id),
  mcp_id: varchar()
    .notNull()
    .references(() => mcps.id),
  access_token: varchar().notNull(), // Encrypted
  refresh_token: varchar(), // Encrypted
  token_type: varchar().notNull(),
  expires_at: timestamp(),
  scope: varchar(),
  provider_user_id: varchar(),
  provider_metadata: jsonb(),
  created_at: timestamp().notNull().defaultNow(),
  updated_at: timestamp().notNull().defaultNow(),
});

// OAuth States - Temporary storage for CSRF protection
export const oauthStates = pgTable("oauth_states", {
  id: varchar().primaryKey().notNull(),
  state: varchar().unique().notNull(),
  user_id: varchar()
    .notNull()
    .references(() => users.id),
  organisation_id: varchar()
    .notNull()
    .references(() => organisations.id),
  mcp_store_id: varchar().references(() => mcpStore.id), // For template MCPs
  custom_mcp_url: varchar(), // For custom MCP server URL
  custom_mcp_name: varchar(), // For custom MCP name
  oauth_metadata: jsonb(), // Store discovered OAuth metadata
  redirect_uri: varchar(),
  code_verifier: varchar(), // For PKCE
  created_at: timestamp().notNull().defaultNow(),
  expires_at: timestamp().notNull(),
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
  mcps: many(mcps),
  oauthConnections: many(oauthConnections),
  oauthStates: many(oauthStates),
}));

// Organisation relations
export const organisationRelations = relations(organisations, ({ many }) => ({
  agents: many(agents),
  projects: many(projects),
  tasks: many(tasks),
  usage: many(usage),
  mcps: many(mcps),
  oauthConnections: many(oauthConnections),
  oauthStates: many(oauthStates),
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

// Usage relations
export const usageRelations = relations(usage, ({ one }) => ({
  organisation: one(organisations, {
    fields: [usage.organisation_id],
    references: [organisations.id],
  }),
}));

// MCP Store relations
export const mcpStoreRelations = relations(mcpStore, ({ many }) => ({
  mcps: many(mcps),
  oauthStates: many(oauthStates),
}));

// MCPs relations
export const mcpsRelations = relations(mcps, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [mcps.organisation_id],
    references: [organisations.id],
  }),
  user: one(users, {
    fields: [mcps.author_id],
    references: [users.id],
  }),
  mcpStore: one(mcpStore, {
    fields: [mcps.mcp_store_id],
    references: [mcpStore.id],
  }),
  oauthConnections: many(oauthConnections),
}));

// OAuth Connections relations
export const oauthConnectionsRelations = relations(
  oauthConnections,
  ({ one }) => ({
    user: one(users, {
      fields: [oauthConnections.user_id],
      references: [users.id],
    }),
    organisation: one(organisations, {
      fields: [oauthConnections.organisation_id],
      references: [organisations.id],
    }),
    mcp: one(mcps, {
      fields: [oauthConnections.mcp_id],
      references: [mcps.id],
    }),
  }),
);

// OAuth States relations
export const oauthStatesRelations = relations(oauthStates, ({ one }) => ({
  user: one(users, {
    fields: [oauthStates.user_id],
    references: [users.id],
  }),
  organisation: one(organisations, {
    fields: [oauthStates.organisation_id],
    references: [organisations.id],
  }),
  mcpStore: one(mcpStore, {
    fields: [oauthStates.mcp_store_id],
    references: [mcpStore.id],
  }),
}));
