// server-mutators.ts
import { CustomMutatorDefs, Transaction } from "@rocicorp/zero";
import { Schema } from "../zero/schema";

type AuthData = {
  userId: string;
  orgId: string;
};

type AsyncTask = Array<() => Promise<void>>;

export function createServerMutators(
  clientMutators: CustomMutatorDefs,
  authData: AuthData,
  asyncTasks: AsyncTask
) {
  return {
    // Reuse all client mutators
    ...clientMutators,
    message: {
      create: async (
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
          content: Record<string, any>[];
          metadata: Record<string, any>;
        }
      ) => {
        // Check if task belongs to user
        const task = tx.query.tasks
          .where("id", task_id)
          .where("author_id", authData.userId)
          .one();

        if (!task) {
          throw new Error("Task not found with user");
        }

        await tx.mutate.messages.insert({
          id: message_id,
          task_id,
          message_id,
          role,
          content,
        });
      },

      update: async (
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
          content: Record<string, any>[];
          metadata: Record<string, any>;
        }
      ) => {
        // Check if the task belongs to the user
        const task = tx.query.tasks
          .where("id", task_id)
          .where("author_id", authData.userId)
          .one();

        if (!task) {
          throw new Error("Task not found with user");
        }

        await tx.mutate.messages.update({
          id: message_id,
          task_id,
          message_id: message_id,
          role: role,
          content: content,
          metadata: metadata,
        });
      },
    },
  } as const;
}
