import { syncedQueryWithContext } from "@rocicorp/zero";
import z from "zod";
import { builder } from "../zero/schema";

export type AuthData = {
  userId: string;
  orgId: string;
};

export const getProjects = syncedQueryWithContext(
  "getProjects",
  z.tuple([]),
  (context: AuthData) => {
    return builder.projects
      .where("author_id", context.userId)
      .where("organisation_id", context.orgId);
  }
);

export const getAgents = syncedQueryWithContext(
  "getAgents",
  z.tuple([]),
  (context: AuthData) => {
    return builder.agents.where("organisation_id", context.orgId);
  }
);

export const getTasks = syncedQueryWithContext(
  "getTasks",
  z.tuple([]),
  (context: AuthData) => {
    return builder.tasks
      .where("author_id", context.userId)
      .where("organisation_id", context.orgId)
      .orderBy("created_at", "desc");
  }
);

export const getMessages = syncedQueryWithContext(
  "getMessages",
  z.tuple([z.string()]),
  (context: AuthData, taskId: string) => {
    return builder.tasks
      .where("id", taskId)
      .where("author_id", context.userId)
      .where("organisation_id", context.orgId)
      .one()
      .related("messages", (q) => {
        return q.orderBy("created_at", "asc");
      });
  }
);
