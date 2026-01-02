import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";

export const integrationType = pgEnum("integration_type", [
  "oauth",
  "composio",
]);

export const users = pgTable("users", {
  id: varchar().primaryKey().notNull(),
  deleted_at: timestamp(),
});

export const subscriptionStatus = pgEnum("subscription_status", [
  "pending",
  "active",
  "on_hold",
  "cancelled",
  "failed",
  "expired",
]);

export const organisations = pgTable("organisations", {
  id: varchar().primaryKey().notNull(),
  payment_id: varchar(),
  subscription_id: varchar(),
  subscription_status: subscriptionStatus(),
  billing_exempt: boolean().notNull().default(false),
  deleted_at: timestamp(),
});

export const usage = pgTable("usage", {
  id: serial().primaryKey(),
  organisation_id: varchar()
    .notNull()
    .references(() => organisations.id),
  task_id: varchar().references(() => tasks.id),
  message_id: varchar().unique(), // Anthropic message ID for deduplication
  model: varchar().notNull(),
  input_tokens: integer().notNull(),
  output_tokens: integer().notNull(),
  cache_creation_input_tokens: integer().notNull(),
  cache_read_input_tokens: integer().notNull(),
  created_at: timestamp().notNull().defaultNow(),
});

// Dodo Customer Portal - Cached portal links per organization
export const dodoCustomerPortal = pgTable("dodo_customer_portal", {
  organisation_id: varchar()
    .primaryKey()
    .notNull()
    .references(() => organisations.id),
  link: varchar().notNull(),
  created_at: timestamp().notNull().defaultNow(),
});

// MCP Store - Global catalog of pre-configured integrations (public-facing only)
export const mcpStore = pgTable("mcp_store", {
  id: varchar().primaryKey().notNull(),
  slug: varchar().unique().notNull(),
  name: varchar().notNull(),
  description: varchar(),
  logo_url: varchar(),
  category: varchar(),
  integration_type: integrationType().notNull(),
  is_active: integer().notNull().default(1), // Using integer for boolean (0 or 1)
  sort_order: integer(),
  metadata: jsonb(),
  created_at: timestamp().notNull().defaultNow(),
  updated_at: timestamp().notNull().defaultNow(),
});

// OAuth Integration Details - Server-side only (NEVER sent to client)
export const mcpOauthIntegrationDetails = pgTable(
  "mcp_oauth_integration_details",
  {
    id: varchar().primaryKey().notNull(),
    mcp_store_id: varchar()
      .unique()
      .notNull()
      .references(() => mcpStore.id),
    mcp_server_url: varchar().notNull(),
    default_scopes: varchar(),
    created_at: timestamp().notNull().defaultNow(),
    updated_at: timestamp().notNull().defaultNow(),
  }
);

// Composio Integration Details - Server-side only (NEVER sent to client)
export const mcpComposioIntegrationDetails = pgTable(
  "mcp_composio_integration_details",
  {
    id: varchar().primaryKey().notNull(),
    mcp_store_id: varchar()
      .unique()
      .notNull()
      .references(() => mcpStore.id),
    auth_config_id: varchar().notNull(),
    mcp_config_id: varchar().notNull(),
    metadata: jsonb(),
    created_at: timestamp().notNull().defaultNow(),
    updated_at: timestamp().notNull().defaultNow(),
  }
);

// MCPs - Per-user, per-org MCP instances
export const mcps = pgTable("mcps", {
  id: varchar().primaryKey().notNull(),
  organisation_id: varchar()
    .notNull()
    .references(() => organisations.id),
  author_id: varchar()
    .notNull()
    .references(() => users.id),
  name: varchar().notNull(),
  mcp_store_id: varchar().references(() => mcpStore.id), // null for custom MCPs
  integration_type: integrationType().notNull(),
  custom_mcp_server_url: varchar(), // Only for custom MCPs (when mcp_store_id is null)
  created_at: timestamp().notNull().defaultNow(),
  updated_at: timestamp().notNull().defaultNow(),
});

// OAuth Connections - Per-user OAuth connections
export const mcpOauthConnections = pgTable("mcp_oauth_connections", {
  id: varchar().primaryKey().notNull(),
  mcp_id: varchar()
    .notNull()
    .references(() => mcps.id),
  // OAuth client credentials
  oauth_client_id: varchar(),
  oauth_client_secret: varchar(), // Encrypted
  // OAuth tokens
  access_token: varchar().notNull(), // Encrypted
  refresh_token: varchar(), // Encrypted
  token_type: varchar().notNull(),
  expires_at: timestamp(),
  scope: varchar(),
  provider_metadata: jsonb(),
  oauth_metadata: jsonb(),
  created_at: timestamp().notNull().defaultNow(),
  updated_at: timestamp().notNull().defaultNow(),
});

// Composio Connections - Per-user Composio connections
export const mcpComposioConnections = pgTable("mcp_composio_connections", {
  id: varchar().primaryKey().notNull(),
  mcp_id: varchar()
    .notNull()
    .references(() => mcps.id),
  connection_url: varchar().notNull(),
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
  redirect_uri: varchar().notNull(),
  code_verifier: varchar(), // For PKCE
  created_at: timestamp().notNull().defaultNow(),
  expires_at: timestamp().notNull(),
});

// Composio States - Temporary storage for Composio connection requests
export const composioStates = pgTable("composio_states", {
  id: varchar().primaryKey().notNull(),
  connection_request_id: varchar().unique().notNull(),
  user_id: varchar()
    .notNull()
    .references(() => users.id),
  organisation_id: varchar()
    .notNull()
    .references(() => organisations.id),
  mcp_store_id: varchar()
    .notNull()
    .references(() => mcpStore.id),
  created_at: timestamp().notNull().defaultNow(),
  expires_at: timestamp().notNull(),
});

export const runtimes = pgTable("runtimes", {
  id: varchar().notNull().primaryKey(),
  user_id: varchar()
    .notNull()
    .references(() => users.id),
  tools: jsonb().$type<{ name: string; version: string }[]>(),
  created_at: timestamp().notNull().defaultNow(),
  updated_at: timestamp().notNull().defaultNow(),
});

export const taskStatus = pgEnum("task_status", [
  "available",
  "starting",
  "executing",
  "stopping",
]);

export interface TaskMetadata {
  cwd?: string;
}

// Skills - Main skill definitions with prompt and metadata
export const skills = pgTable("skills", {
  id: varchar().primaryKey().notNull(),
  organisation_id: varchar()
    .notNull()
    .references(() => organisations.id),
  author_id: varchar()
    .notNull()
    .references(() => users.id),
  name: varchar().notNull(),
  prompt: varchar().notNull(),
  description: varchar().notNull(),
  created_at: timestamp().notNull().defaultNow(),
  updated_at: timestamp().notNull().defaultNow(),
});

// Skill Documents - Supporting documents for skills
export const skillDocuments = pgTable("skill_documents", {
  id: varchar().primaryKey().notNull(),
  skill_id: varchar()
    .notNull()
    .references(() => skills.id),
  name: varchar().notNull(),
  content: varchar().notNull(),
  description: varchar().notNull(),
  created_at: timestamp().notNull().defaultNow(),
  updated_at: timestamp().notNull().defaultNow(),
});

// Task Skills - Junction table for many-to-many relationship between tasks and skills
export const taskSkills = pgTable(
  "task_skills",
  {
    task_id: varchar()
      .notNull()
      .references(() => tasks.id),
    skill_id: varchar()
      .notNull()
      .references(() => skills.id),
  },
  (table) => [primaryKey({ columns: [table.task_id, table.skill_id] })]
);

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
  last_session_id: varchar(),
  status: taskStatus().notNull().default("available"),
  runtime_id: varchar()
    .notNull()
    .references(() => runtimes.id),
  metadata: jsonb().$type<TaskMetadata>(),
  updated_at: timestamp().notNull().defaultNow(),
});

export const turnType = pgEnum("turn_type", ["user", "assistant"]);

export const turns = pgTable("turns", {
  id: varchar().notNull().primaryKey(),
  type: turnType().notNull(),
  complete: boolean().notNull().default(false),
  metadata: jsonb(),
  task_id: varchar()
    .notNull()
    .references(() => tasks.id),
  created_at: timestamp().notNull().defaultNow(),
  updated_at: timestamp().notNull().defaultNow(),
  locked: boolean().notNull().default(false),
});

export const blockType = pgEnum("block_type", [
  "text",
  "tool_use",
  "tool_result",
  "server_tool_use",
  "code_execution_tool_result",
  "bash_code_execution_tool_result",
  "web_search_tool_result",
  "thinking",
] as const satisfies readonly BetaContentBlockParam["type"][]);

export const blockStatus = pgEnum("block_status", [
  "none",
  "permission_pending",
  "client_pending",
  "server_pending",
  "mcp_pending",
  "completed",
]);

export interface BlockMetadata {
  mcpId?: string;
}

export const blocks = pgTable("blocks", {
  id: varchar().notNull().primaryKey(),
  turn_id: varchar()
    .notNull()
    .references(() => turns.id),
  type: blockType().notNull(),
  status: blockStatus().notNull().default("none"),
  complete: boolean().notNull().default(false),
  content: jsonb().$type<BetaContentBlockParam>().notNull(),
  metadata: jsonb().$type<BlockMetadata>(),
  created_at: timestamp().notNull().defaultNow(),
  updated_at: timestamp().notNull().defaultNow(),
  processed: boolean().notNull().default(false),
  response_turn_id: varchar().references(() => turns.id),
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
export const userRelations = relations(users, ({ many }) => ({
  tasks: many(tasks),
  mcps: many(mcps),
  oauthStates: many(oauthStates),
  composioStates: many(composioStates),
  runtimes: many(runtimes),
  skills: many(skills),
}));

// Organisation relations
export const organisationRelations = relations(organisations, ({ one, many }) => ({
  tasks: many(tasks),
  usage: many(usage),
  mcps: many(mcps),
  oauthStates: many(oauthStates),
  composioStates: many(composioStates),
  skills: many(skills),
  dodoCustomerPortal: one(dodoCustomerPortal),
}));

// Dodo Customer Portal relations
export const dodoCustomerPortalRelations = relations(dodoCustomerPortal, ({ one }) => ({
  organisation: one(organisations, {
    fields: [dodoCustomerPortal.organisation_id],
    references: [organisations.id],
  }),
}));

// Runtime relations
export const runtimeRelations = relations(runtimes, ({ one, many }) => ({
  user: one(users, {
    fields: [runtimes.user_id],
    references: [users.id],
  }),
  tasks: many(tasks),
}));

// Task relations
export const taskRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, {
    fields: [tasks.author_id],
    references: [users.id],
  }),
  messages: many(messages),
  organisation: one(organisations, {
    fields: [tasks.organisation_id],
    references: [organisations.id],
  }),
  turns: many(turns),
  runtime: one(runtimes, {
    fields: [tasks.runtime_id],
    references: [runtimes.id],
  }),
  taskSkills: many(taskSkills),
  usage: many(usage),
}));

// Turn relations
export const turnRelations = relations(turns, ({ one, many }) => ({
  task: one(tasks, {
    fields: [turns.task_id],
    references: [tasks.id],
  }),
  blocks: many(blocks, { relationName: "turn" }),
  response_blocks: many(blocks, { relationName: "response_turn" }),
}));

// Block relations
export const blockRelations = relations(blocks, ({ one }) => ({
  turn: one(turns, {
    fields: [blocks.turn_id],
    references: [turns.id],
    relationName: "turn",
  }),
  response_turn: one(turns, {
    fields: [blocks.response_turn_id],
    references: [turns.id],
    relationName: "response_turn",
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
  task: one(tasks, {
    fields: [usage.task_id],
    references: [tasks.id],
  }),
}));

// MCP Store relations
export const mcpStoreRelations = relations(mcpStore, ({ one, many }) => ({
  oauthDetails: one(mcpOauthIntegrationDetails),
  composioDetails: one(mcpComposioIntegrationDetails),
  mcps: many(mcps),
  oauthStates: many(oauthStates),
  composioStates: many(composioStates),
}));

// OAuth Integration Details relations
export const mcpOauthIntegrationDetailsRelations = relations(
  mcpOauthIntegrationDetails,
  ({ one }) => ({
    mcpStore: one(mcpStore, {
      fields: [mcpOauthIntegrationDetails.mcp_store_id],
      references: [mcpStore.id],
    }),
  })
);

// Composio Integration Details relations
export const mcpComposioIntegrationDetailsRelations = relations(
  mcpComposioIntegrationDetails,
  ({ one }) => ({
    mcpStore: one(mcpStore, {
      fields: [mcpComposioIntegrationDetails.mcp_store_id],
      references: [mcpStore.id],
    }),
  })
);

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
  oauthConnections: many(mcpOauthConnections),
  composioConnections: many(mcpComposioConnections),
}));

// OAuth Connections relations
export const mcpOauthConnectionsRelations = relations(
  mcpOauthConnections,
  ({ one }) => ({
    mcp: one(mcps, {
      fields: [mcpOauthConnections.mcp_id],
      references: [mcps.id],
    }),
  })
);

// Composio Connections relations
export const mcpComposioConnectionsRelations = relations(
  mcpComposioConnections,
  ({ one }) => ({
    mcp: one(mcps, {
      fields: [mcpComposioConnections.mcp_id],
      references: [mcps.id],
    }),
  })
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

// Composio States relations
export const composioStatesRelations = relations(composioStates, ({ one }) => ({
  user: one(users, {
    fields: [composioStates.user_id],
    references: [users.id],
  }),
  organisation: one(organisations, {
    fields: [composioStates.organisation_id],
    references: [organisations.id],
  }),
  mcpStore: one(mcpStore, {
    fields: [composioStates.mcp_store_id],
    references: [mcpStore.id],
  }),
}));

// Skills relations
export const skillsRelations = relations(skills, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [skills.organisation_id],
    references: [organisations.id],
  }),
  author: one(users, {
    fields: [skills.author_id],
    references: [users.id],
  }),
  documents: many(skillDocuments),
  taskSkills: many(taskSkills),
}));

// Skill Documents relations
export const skillDocumentsRelations = relations(skillDocuments, ({ one }) => ({
  skill: one(skills, {
    fields: [skillDocuments.skill_id],
    references: [skills.id],
  }),
}));

// Task Skills relations (junction table)
export const taskSkillsRelations = relations(taskSkills, ({ one }) => ({
  task: one(tasks, {
    fields: [taskSkills.task_id],
    references: [tasks.id],
  }),
  skill: one(skills, {
    fields: [taskSkills.skill_id],
    references: [skills.id],
  }),
}));
