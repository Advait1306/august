import { syncedQueryWithContext } from "@rocicorp/zero";
import z from "zod";
import { builder } from "../zero/schema";

export type AuthData = {
  userId: string;
};

export const getTasksAndMessages = syncedQueryWithContext(
  "getTasksAndMessages",
  z.tuple([]),
  (context: AuthData) => {
    return builder.users
      .where("user_id", context.userId)
      .one()
      .related("tasks", (q) => {
        return q.related("messages");
      });
  }
);
