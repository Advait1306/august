import { defineQueries } from "@rocicorp/zero";
import {
  taskQueries,
  turnQueries,
  blockQueries,
  todoQueries,
} from "../features/tasks/queries";
import {
  skillQueries,
  skillDocumentQueries,
} from "../features/skills/queries";
import { mcpQueries, mcpStoreQueries } from "../features/mcps/queries";
import {
  organisationQueries,
  usageQueries,
  dodoCustomerPortalQueries,
} from "../features/organisation/queries";

export const queries = defineQueries({
  tasks: taskQueries,
  skills: skillQueries,
  skillDocuments: skillDocumentQueries,
  turns: turnQueries,
  blocks: blockQueries,
  organisations: organisationQueries,
  usage: usageQueries,
  mcpStore: mcpStoreQueries,
  mcps: mcpQueries,
  todos: todoQueries,
  dodoCustomerPortal: dodoCustomerPortalQueries,
});

export type Queries = typeof queries;
