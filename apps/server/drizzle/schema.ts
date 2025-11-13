import { pgTable, foreignKey, varchar, timestamp, jsonb, doublePrecision, integer, serial, unique, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const baseAgent = pgEnum("base_agent", ['claude-code', 'codex', 'opencode'])


export const agents = pgTable("agents", {
	id: varchar().primaryKey().notNull(),
	name: varchar().notNull(),
	systemPrompt: varchar("system_prompt").notNull(),
	baseAgent: baseAgent("base_agent").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	organisationId: varchar("organisation_id").notNull(),
	authorId: varchar("author_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.organisationId],
			foreignColumns: [organisations.id],
			name: "agents_organisation_id_organisations_id_fk"
		}),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [users.id],
			name: "agents_author_id_users_id_fk"
		}),
]);

export const users = pgTable("users", {
	id: varchar().primaryKey().notNull(),
});

export const tasks = pgTable("tasks", {
	id: varchar().primaryKey().notNull(),
	name: varchar().notNull(),
	organisationId: varchar("organisation_id").notNull(),
	authorId: varchar("author_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	agentId: varchar("agent_id").notNull(),
	projectId: varchar("project_id").notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.organisationId],
			foreignColumns: [organisations.id],
			name: "tasks_organisation_id_organisations_id_fk"
		}),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [users.id],
			name: "tasks_author_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "tasks_agent_id_agents_id_fk"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "tasks_project_id_projects_id_fk"
		}),
]);

export const messages = pgTable("messages", {
	id: varchar().primaryKey().notNull(),
	taskId: varchar("task_id").notNull(),
	messageId: varchar("message_id").notNull(),
	role: varchar().notNull(),
	content: jsonb().notNull(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [tasks.id],
			name: "messages_task_id_tasks_id_fk"
		}),
]);

export const projects = pgTable("projects", {
	id: varchar().primaryKey().notNull(),
	name: varchar().notNull(),
	path: varchar().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	organisationId: varchar("organisation_id").notNull(),
	authorId: varchar("author_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.organisationId],
			foreignColumns: [organisations.id],
			name: "projects_organisation_id_organisations_id_fk"
		}),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [users.id],
			name: "projects_author_id_users_id_fk"
		}),
]);

export const organisations = pgTable("organisations", {
	id: varchar().primaryKey().notNull(),
	paymentId: varchar("payment_id"),
	wallet: doublePrecision().default(0).notNull(),
});

export const usage = pgTable("usage", {
	organisationId: varchar("organisation_id").notNull(),
	model: varchar().notNull(),
	inputTokens: integer("input_tokens").notNull(),
	outputTokens: integer("output_tokens").notNull(),
	cacheCreationInputTokens: integer("cache_creation_input_tokens").notNull(),
	cacheReadInputTokens: integer("cache_read_input_tokens").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	cost: doublePrecision().default(0).notNull(),
	id: serial().primaryKey().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.organisationId],
			foreignColumns: [organisations.id],
			name: "usage_organisation_id_organisations_id_fk"
		}),
]);

export const mcps = pgTable("mcps", {
	id: varchar().primaryKey().notNull(),
	organisationId: varchar("organisation_id").notNull(),
	authorId: varchar("author_id").notNull(),
	mcpStoreId: varchar("mcp_store_id"),
	name: varchar().notNull(),
	customMcpUrl: varchar("custom_mcp_url"),
	customDescription: varchar("custom_description"),
	mcpServerUrl: varchar("mcp_server_url").notNull(),
	oauthClientId: varchar("oauth_client_id"),
	oauthClientSecret: varchar("oauth_client_secret"),
	oauthMetadata: jsonb("oauth_metadata"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.organisationId],
			foreignColumns: [organisations.id],
			name: "mcps_organisation_id_organisations_id_fk"
		}),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [users.id],
			name: "mcps_author_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.mcpStoreId],
			foreignColumns: [mcpStore.id],
			name: "mcps_mcp_store_id_mcp_store_id_fk"
		}),
]);

export const mcpStore = pgTable("mcp_store", {
	id: varchar().primaryKey().notNull(),
	slug: varchar().notNull(),
	name: varchar().notNull(),
	description: varchar(),
	logoUrl: varchar("logo_url"),
	category: varchar(),
	mcpServerUrl: varchar("mcp_server_url").notNull(),
	defaultScopes: varchar("default_scopes"),
	isActive: integer("is_active").default(1).notNull(),
	sortOrder: integer("sort_order"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("mcp_store_slug_unique").on(table.slug),
]);

export const oauthConnections = pgTable("oauth_connections", {
	id: varchar().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	organisationId: varchar("organisation_id").notNull(),
	mcpId: varchar("mcp_id").notNull(),
	accessToken: varchar("access_token").notNull(),
	refreshToken: varchar("refresh_token"),
	tokenType: varchar("token_type").notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	scope: varchar(),
	providerUserId: varchar("provider_user_id"),
	providerMetadata: jsonb("provider_metadata"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "oauth_connections_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.organisationId],
			foreignColumns: [organisations.id],
			name: "oauth_connections_organisation_id_organisations_id_fk"
		}),
	foreignKey({
			columns: [table.mcpId],
			foreignColumns: [mcps.id],
			name: "oauth_connections_mcp_id_mcps_id_fk"
		}),
]);

export const oauthStates = pgTable("oauth_states", {
	id: varchar().primaryKey().notNull(),
	state: varchar().notNull(),
	userId: varchar("user_id").notNull(),
	organisationId: varchar("organisation_id").notNull(),
	redirectUri: varchar("redirect_uri"),
	codeVerifier: varchar("code_verifier"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	mcpStoreId: varchar("mcp_store_id"),
	customMcpUrl: varchar("custom_mcp_url"),
	customMcpName: varchar("custom_mcp_name"),
	oauthMetadata: jsonb("oauth_metadata"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "oauth_states_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.organisationId],
			foreignColumns: [organisations.id],
			name: "oauth_states_organisation_id_organisations_id_fk"
		}),
	foreignKey({
			columns: [table.mcpStoreId],
			foreignColumns: [mcpStore.id],
			name: "oauth_states_mcp_store_id_mcp_store_id_fk"
		}),
	unique("oauth_states_state_unique").on(table.state),
]);
