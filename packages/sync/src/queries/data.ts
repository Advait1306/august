import { syncedQueryWithContext } from "@rocicorp/zero";
import z from "zod";
import { builder } from "../zero/schema";

export type AuthData = {
  userId: string;
};

export const getTasks = syncedQueryWithContext(
  "getTasks",
  z.tuple([]),
  (context: AuthData) => {
    return builder.users
      .where("id", context.userId)
      .one()
      .related("tasks", (q) => {
        return q.orderBy("created_at", "desc").related("messages");
      });
  }
);

export const getMessages = syncedQueryWithContext(
  "getMessages",
  z.tuple([z.string()]),
  (context: AuthData, taskId: string) => {
    // TODO: Add check for the user having access to this task's messages
    return builder.tasks.where("id", taskId).one().related("messages");
  }
);
