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
        {
          task_id,
          message_data,
        }: {
          task_id: string;
          message_data: {
            task_id: string;
            message_id: string;
            role: string;
            content: Record<string, any>[];
            metadata: Record<string, any>;
          };
        }
      ) => {
        const user = await tx.query.users
          .where("id", authData.userId)
          .one()
          .run();

        if (!user || !user.id) {
          throw new Error("User not found");
        }

        await tx.mutate.tasks.insert({
          id: task_id,
          author_id: user.id,
          name: "New Task",
        });

        await tx.mutate.messages.upsert({
          id: message_data.message_id,
          task_id,
          message_id: message_data.message_id,
          role: message_data.role,
          content: message_data.content,
          metadata: message_data.metadata,
        });
      },
    },
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
        await tx.mutate.messages.insert({
          id: message_id,
          task_id,
          message_id: message_id,
          role: role,
          content: content,
          metadata: metadata,
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

export type Mutators = ReturnType<typeof createMutators>;
