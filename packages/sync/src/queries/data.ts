import { syncedQueryWithContext } from "@rocicorp/zero";
import z from "zod";
import { builder } from "../zero/schema";

export type AuthData = {
  userId: string;
};

export const getProjects = syncedQueryWithContext(
  "getProjects",
  z.tuple([]),
  (context: AuthData) => {
    return builder.projects.where("author_id", context.userId);
  }
);

export const getAgents = syncedQueryWithContext(
  "getAgents",
  z.tuple([]),
  (context: AuthData) => {
    return builder.agents.where("author_id", context.userId);
  }
);

export const getTasks = syncedQueryWithContext(
  "getTasks",
  z.tuple([]),
  (context: AuthData) => {
    return builder.tasks
      .where("author_id", context.userId)
      .orderBy("created_at", "desc");
  }
);

export const getMessages = syncedQueryWithContext(
  "getMessages",
  z.tuple([z.string()]),
  (_: AuthData, taskId: string) => {
    // TODO: Add check for the user having access to this task's messages
    return builder.tasks
      .where("id", taskId)
      .one()
      .related("messages", (q) => {
        return q.orderBy("created_at", "asc");
      });
  }
);
