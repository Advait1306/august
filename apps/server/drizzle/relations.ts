import { relations } from "drizzle-orm/relations";
import { organisations, agents, users, tasks, projects, messages, usage, mcps, mcpStore, oauthConnections, oauthStates } from "./schema";

export const agentsRelations = relations(agents, ({one, many}) => ({
	organisation: one(organisations, {
		fields: [agents.organisationId],
		references: [organisations.id]
	}),
	user: one(users, {
		fields: [agents.authorId],
		references: [users.id]
	}),
	tasks: many(tasks),
}));

export const organisationsRelations = relations(organisations, ({many}) => ({
	agents: many(agents),
	tasks: many(tasks),
	projects: many(projects),
	usages: many(usage),
	mcps: many(mcps),
	oauthConnections: many(oauthConnections),
	oauthStates: many(oauthStates),
}));

export const usersRelations = relations(users, ({many}) => ({
	agents: many(agents),
	tasks: many(tasks),
	projects: many(projects),
	mcps: many(mcps),
	oauthConnections: many(oauthConnections),
	oauthStates: many(oauthStates),
}));

export const tasksRelations = relations(tasks, ({one, many}) => ({
	organisation: one(organisations, {
		fields: [tasks.organisationId],
		references: [organisations.id]
	}),
	user: one(users, {
		fields: [tasks.authorId],
		references: [users.id]
	}),
	agent: one(agents, {
		fields: [tasks.agentId],
		references: [agents.id]
	}),
	project: one(projects, {
		fields: [tasks.projectId],
		references: [projects.id]
	}),
	messages: many(messages),
}));

export const projectsRelations = relations(projects, ({one, many}) => ({
	tasks: many(tasks),
	organisation: one(organisations, {
		fields: [projects.organisationId],
		references: [organisations.id]
	}),
	user: one(users, {
		fields: [projects.authorId],
		references: [users.id]
	}),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	task: one(tasks, {
		fields: [messages.taskId],
		references: [tasks.id]
	}),
}));

export const usageRelations = relations(usage, ({one}) => ({
	organisation: one(organisations, {
		fields: [usage.organisationId],
		references: [organisations.id]
	}),
}));

export const mcpsRelations = relations(mcps, ({one, many}) => ({
	organisation: one(organisations, {
		fields: [mcps.organisationId],
		references: [organisations.id]
	}),
	user: one(users, {
		fields: [mcps.authorId],
		references: [users.id]
	}),
	mcpStore: one(mcpStore, {
		fields: [mcps.mcpStoreId],
		references: [mcpStore.id]
	}),
	oauthConnections: many(oauthConnections),
}));

export const mcpStoreRelations = relations(mcpStore, ({many}) => ({
	mcps: many(mcps),
	oauthStates: many(oauthStates),
}));

export const oauthConnectionsRelations = relations(oauthConnections, ({one}) => ({
	user: one(users, {
		fields: [oauthConnections.userId],
		references: [users.id]
	}),
	organisation: one(organisations, {
		fields: [oauthConnections.organisationId],
		references: [organisations.id]
	}),
	mcp: one(mcps, {
		fields: [oauthConnections.mcpId],
		references: [mcps.id]
	}),
}));

export const oauthStatesRelations = relations(oauthStates, ({one}) => ({
	user: one(users, {
		fields: [oauthStates.userId],
		references: [users.id]
	}),
	organisation: one(organisations, {
		fields: [oauthStates.organisationId],
		references: [organisations.id]
	}),
	mcpStore: one(mcpStore, {
		fields: [oauthStates.mcpStoreId],
		references: [mcpStore.id]
	}),
}));