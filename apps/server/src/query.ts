import { syncedQuery, createBuilder } from "@rocicorp/zero";
import z from "zod";
import { schema } from "./zero/zero-schema.gen";

const builder = createBuilder(schema);

export const getUser = syncedQuery(
  "getUser",
  z.tuple([z.string()]),
  (userId: string) => {
    return builder.users.where("user_id", userId).one();
  }
);

export const getTasksAndMessages = syncedQuery(
  "getTasksAndMessages",
  z.tuple([z.boolean()]),
  (t: boolean) => {
    console.log("Running on server");
    return builder.tasks.where("author_id", 4).related("messages");
  }
);
