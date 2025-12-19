import { Transaction } from "@rocicorp/zero";
import { Schema } from "../zero/schema";

type AuthData = {
  userId: string;
  orgId: string;
};

export function createMutators(authData: AuthData) {
  return {
    // TODO: Remove agents mutators as no longer needed
    // OR Replace with skill mutators when available
    agents: {
      create: async (
        tx: Transaction<Schema>,
        {
          agent_id,
          name,
          system_prompt,
          base_agent,
        }: {
          agent_id: string;
          name: string;
          system_prompt: string;
          base_agent: "claude-code" | "codex" | "opencode";
        }
      ) => {
        await tx.mutate.agents.insert({
          id: agent_id,
          name,
          system_prompt,
          base_agent,
          author_id: authData.userId,
          organisation_id: authData.orgId,
        });
      },
      update: async (
        tx: Transaction<Schema>,
        {
          agent_id,
          name,
          system_prompt,
        }: {
          agent_id: string;
          name?: string;
          system_prompt?: string;
        }
      ) => {
        await tx.mutate.agents.update({
          id: agent_id,
          name,
          system_prompt,
        });
      },
      delete: async (
        tx: Transaction<Schema>,
        { agent_id }: { agent_id: string }
      ) => {
        await tx.mutate.agents.delete({ id: agent_id });
      },
    },
    tasks: {
      create: async (
        tx: Transaction<Schema>,
        {
          message,
          task_id,
          turn_id,
          block_id,
        }: {
          message: string;
          task_id: string;
          turn_id: string;
          block_id: string;
        }
      ) => {
        await tx.mutate.tasks.insert({
          id: task_id,
          name: message.length > 40 ? message.slice(0, 40) + "..." : message,
          author_id: authData.userId,
          organisation_id: authData.orgId,
          status: "starting",
          created_at: Date.now(),
          updated_at: Date.now(),
        });

        await tx.mutate.turns.insert({
          id: turn_id,
          type: "user",
          task_id: task_id,
          complete: true,
          created_at: Date.now(),
          updated_at: Date.now(),
          locked: true,
        });

        await tx.mutate.blocks.insert({
          id: block_id,
          turn_id: turn_id,
          type: "text",
          content: {
            type: "text",
            text: message,
          },
          created_at: Date.now(),
          updated_at: Date.now(),
          processed: false,
        });
      },
      abort: async (
        tx: Transaction<Schema>,
        {
          task_id,
        }: {
          task_id: string;
        }
      ) => {
        const task = await tx.query.tasks
          .where("id", task_id)
          .where("author_id", authData.userId)
          .one()
          .run();

        if (!task) {
          throw new Error("Task not found with user");
        }

        if (task.status !== "executing") {
          throw new Error("Can't stop a non-executing task");
        }

        await tx.mutate.tasks.update({
          id: task_id,
          status: "stopping",
        });
      },
    },
    message: {
      create: async (
        tx: Transaction<Schema>,
        {
          message,
          task_id,
          turn_id,
          block_id,
        }: {
          message: string;
          task_id: string;
          turn_id: string;
          block_id: string;
        }
      ) => {
        const task = await tx.query.tasks
          .where("id", task_id)
          .where("author_id", authData.userId)
          .one()
          .run();

        if (!task) {
          throw new Error("Task not found with user");
        }

        if (task.status !== "available") {
          throw new Error("Task is not in available state");
        }

        await tx.mutate.tasks.update({
          id: task_id,
          status: "starting",
        });

        await tx.mutate.turns.insert({
          id: turn_id,
          type: "user",
          task_id: task_id,
          complete: true,
          created_at: Date.now(),
          updated_at: Date.now(),
          locked: true,
        });

        await tx.mutate.blocks.insert({
          id: block_id,
          turn_id: turn_id,
          type: "text",
          content: {
            type: "text",
            text: message,
          },
          processed: false,
          created_at: Date.now(),
          updated_at: Date.now(),
        });
      },
      // TODO: Remove update function as no longer needed
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
    tools: {
      submitResult: async (
        tx: Transaction<Schema>,
        {
          tool_use_id,
          turn_id,
          result,
          block_id,
        }: {
          tool_use_id: string;
          turn_id: string;
          result: string;
          block_id: string;
        }
      ) => {
        const turn = await tx.query.turns.where("id", turn_id).one().run();

        if (!turn) {
          throw new Error("Turn not found");
        }

        if (turn.type !== "user") {
          throw new Error("Turn is not a user turn");
        }

        if (turn.locked) {
          throw new Error("Turn is locked");
        }

        await tx.mutate.blocks.insert({
          id: block_id,
          turn_id: turn_id,
          type: "tool_result",
          status: "completed",
          content: {
            type: "tool_result",
            tool_use_id,
            content: result,
          },
          created_at: Date.now(),
          updated_at: Date.now(),
          processed: false,
        });
      },
      approve: async (
        tx: Transaction<Schema>,
        {
          block_id,
        }: {
          block_id: string;
        }
      ) => {
        const block = await tx.query.blocks.where("id", block_id).one().run();

        if (!block) {
          throw new Error("Block not found");
        }

        switch (block.type) {
          case "tool_use": {
            await tx.mutate.blocks.update({
              id: block_id,
              status: "client_pending",
            });
            break;
          }
          case "server_tool_use": {
            await tx.mutate.blocks.update({
              id: block_id,
              status: "server_pending",
            });
            break;
          }
          default: {
            throw new Error("Block doesn't support permission approval");
          }
        }
      },
      deny: async (
        tx: Transaction<Schema>,
        {
          tool_block_id,
          turn_id,
          reason,
          result_block_id,
        }: {
          tool_block_id: string;
          turn_id: string;
          reason: string;
          result_block_id: string;
        }
      ) => {
        const block = await tx.query.blocks
          .where("id", tool_block_id)
          .one()
          .run();

        if (!block) {
          throw new Error("Block not found");
        }

        if (block.type !== "tool_use" && block.type !== "server_tool_use") {
          throw new Error("Block doesn't support permission denial");
        }

        await tx.mutate.blocks.update({
          id: tool_block_id,
          status: "completed",
        });

        await tx.mutate.blocks.insert({
          id: result_block_id,
          turn_id: turn_id,
          type: "tool_result",
          // TODO: Fix content here in order to match anthropic's expectations
          content: {
            type: "tool_result",
            tool_use_id: tool_block_id,
            content: reason,
            is_error: true,
          },
          created_at: Date.now(),
          updated_at: Date.now(),
          processed: false,
          complete: true,
        });
      },
    },
    mcps: {
      delete: async (
        tx: Transaction<Schema>,
        { mcp_id }: { mcp_id: string }
      ) => {
        await tx.mutate.mcps.delete({ id: mcp_id });
      },
    },
  } as const;
}

export type Mutators = ReturnType<typeof createMutators>;
