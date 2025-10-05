import { createBuilder, syncedQueryWithContext } from "@rocicorp/zero";
import z from "zod";
import { schema } from "./zero/zero-schema.gen";

const builder = createBuilder(schema);

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
