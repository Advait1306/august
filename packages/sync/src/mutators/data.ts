import { Transaction } from "@rocicorp/zero";
import { Schema } from "../zero/schema";

type AuthData = {
  userId: string;
};

export function createMutators(authData: AuthData) {
  return {
    tasks: {
      create: async (
        tx: Transaction<Schema>,
        { task_id }: { task_id: string }
      ) => {
        const user = await tx.query.users
          .where("id", authData.userId)
          .one()
          .run();

        console.log(authData);
        if (!user || !user.id) {
          throw new Error("User not found");
        }

        tx.mutate.tasks.insert({
          id: task_id,
          author_id: user.id,
          name: "New Task",
        });
      },
    },
    message: {
      upsert: async (
        tx: Transaction<Schema>,
        {
          task_id,
          message_id,
          role,
          content,
          metadata,
        }: {
          task_id: string;
          message_id: string;
          role: string;
          content: Record<string, any>;
          metadata: Record<string, any>;
        }
      ) => {
        const task = await tx.query.tasks.where("id", task_id).one().run();

        if (!task || !task.id) {
          throw new Error("Task not found");
        }

        tx.mutate.messages.upsert({
          id: message_id,
          task_id: task.id,
          message_id,
          role,
          content,
          metadata,
        });
      },
    },
  } as const;
}

export type Mutators = ReturnType<typeof createMutators>;
