import { defineQueries, defineQuery } from "@rocicorp/zero";
import { z } from "zod";
import { builder } from "../zero/schema";

export const queries = defineQueries({
  agents: {
    all: defineQuery(({ ctx }) => {
      return builder.agents.where("organisation_id", ctx.orgId);
    }),
  },
  tasks: {
    all: defineQuery(({ ctx }) => {
      return builder.tasks
        .where("author_id", ctx.userId)
        .where("organisation_id", ctx.orgId)
        .orderBy("created_at", "desc");
    }),
  },
  turns: {
    byTask: defineQuery(
      z.object({ taskId: z.string() }),
      ({ args: { taskId } }) => {
        return builder.turns
          .where("task_id", taskId)
          .orderBy("created_at", "asc");
      }
    ),
  },
  blocks: {
    byTurn: defineQuery(
      z.object({ turnId: z.string() }),
      ({ args: { turnId } }) => {
        return builder.blocks
          .where("turn_id", turnId)
          .orderBy("created_at", "asc");
      }
    ),
    getPendingShellTools: defineQuery(({ ctx }) => {
      return builder.blocks
        .where("status", "client_pending")
        .where("type", "tool_use")
        .where("complete", true)
        .related("turn", (q) => {
          return q.related("task", (s) => {
            return s.where("author_id", ctx.userId);
          });
        });
    }),
  },
  organisations: {
    current: defineQuery(({ ctx }) => {
      return builder.organisations.where("id", ctx.orgId).one();
    }),
  },
  usage: {
    recent: defineQuery(({ ctx }) => {
      return builder.usage
        .where("organisation_id", ctx.orgId)
        .orderBy("created_at", "desc")
        .limit(50);
    }),
  },
  mcpStore: {
    active: defineQuery(() => {
      return builder.mcpStore
        .where("is_active", 1)
        .orderBy("sort_order", "asc");
    }),
  },
  mcps: {
    all: defineQuery(({ ctx }) => {
      return builder.mcps
        .where("author_id", ctx.userId)
        .where("organisation_id", ctx.orgId)
        .orderBy("created_at", "desc");
    }),
  },
});

export type Queries = typeof queries;
