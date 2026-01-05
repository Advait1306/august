import { defineQuery } from "@rocicorp/zero";
import { z } from "zod";
import { builder } from "../../zero/schema";

export const taskQueries = {
  all: defineQuery(({ ctx }) => {
    return builder.tasks
      .where("author_id", ctx.userId)
      .where("organisation_id", ctx.orgId)
      .orderBy("created_at", "desc");
  }),
};

export const turnQueries = {
  byTask: defineQuery(
    z.object({ taskId: z.string() }),
    ({ args: { taskId } }) => {
      return builder.turns
        .where("task_id", taskId)
        .orderBy("created_at", "asc");
    }
  ),
};

export const blockQueries = {
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
};

export const todoQueries = {
  byTask: defineQuery(
    z.object({ taskId: z.string() }),
    ({ args: { taskId } }) => {
      return builder.turns
        .where("task_id", taskId)
        .related("blocks", (q) => q.where("type", "tool_use"))
        .orderBy("created_at", "desc");
    }
  ),
};
