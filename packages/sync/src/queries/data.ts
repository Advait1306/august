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
    byTask: defineQuery(z.object({ taskId: z.string() }), ({ args: { taskId } }) => {
      return builder.turns.where("task_id", taskId).orderBy("created_at", "asc");
    }),
  },
  messages: {
    byTask: defineQuery(
      z.object({ taskId: z.string() }),
      ({ ctx, args: { taskId } }) => {
        return builder.tasks
          .where("id", taskId)
          .where("author_id", ctx.userId)
          .where("organisation_id", ctx.orgId)
          .one()
          .related("messages", (q: typeof builder.messages) => {
            return q.orderBy("created_at", "asc");
          });
      }
    ),
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
      return builder.mcpStore.where("is_active", 1).orderBy("sort_order", "asc");
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
