import { defineMutator, defineMutators } from "@rocicorp/zero";
import { z } from "zod";
import { builder } from "../zero/schema";
import { ToolUseBlockParam } from "@anthropic-ai/sdk/resources";

export const mutators = defineMutators({
  agents: {
    create: defineMutator(
      z.object({
        agent_id: z.string(),
        name: z.string(),
        system_prompt: z.string(),
        base_agent: z.enum(["claude-code", "codex", "opencode"]),
      }),
      async ({
        tx,
        ctx,
        args: { agent_id, name, system_prompt, base_agent },
      }) => {
        await tx.mutate.agents.insert({
          id: agent_id,
          name,
          system_prompt,
          base_agent,
          author_id: ctx.userId,
          organisation_id: ctx.orgId,
        });
      }
    ),
    update: defineMutator(
      z.object({
        agent_id: z.string(),
        name: z.string().optional(),
        system_prompt: z.string().optional(),
      }),
      async ({ tx, args: { agent_id, name, system_prompt } }) => {
        await tx.mutate.agents.update({
          id: agent_id,
          name,
          system_prompt,
        });
      }
    ),
    delete: defineMutator(
      z.object({
        agent_id: z.string(),
      }),
      async ({ tx, args: { agent_id } }) => {
        await tx.mutate.agents.delete({ id: agent_id });
      }
    ),
  },
  tasks: {
    create: defineMutator(
      z.object({
        message: z.string(),
        task_id: z.string(),
        turn_id: z.string(),
        block_id: z.string(),
        runtime_id: z.string(),
        session_id: z.string(),
        metadata: z.object({ cwd: z.string().optional() }).optional(),
      }),
      async ({
        tx,
        ctx,
        args: {
          message,
          task_id,
          turn_id,
          block_id,
          runtime_id,
          session_id,
          metadata,
        },
      }) => {
        await tx.mutate.tasks.insert({
          id: task_id,
          name: message.length > 40 ? message.slice(0, 40) + "..." : message,
          author_id: ctx.userId,
          organisation_id: ctx.orgId,
          status: "starting",
          runtime_id: runtime_id,
          last_session_id: session_id,
          metadata,
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
          complete: true,
          processed: false,
        });
      }
    ),
    abort: defineMutator(
      z.object({
        task_id: z.string(),
      }),
      async ({ tx, ctx, args: { task_id } }) => {
        const task = await tx.run(
          builder.tasks
            .where("id", task_id)
            .where("author_id", ctx.userId)
            .one()
        );

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
      }
    ),
  },
  message: {
    create: defineMutator(
      z.object({
        message: z.string(),
        task_id: z.string(),
        turn_id: z.string(),
        block_id: z.string(),
        session_id: z.string(),
      }),
      async ({
        tx,
        ctx,
        args: { message, task_id, turn_id, block_id, session_id },
      }) => {
        const task = await tx.run(
          builder.tasks
            .where("id", task_id)
            .where("author_id", ctx.userId)
            .one()
        );

        if (!task) {
          throw new Error("Task not found with user");
        }

        if (task.status !== "available") {
          throw new Error("Task is not in available state");
        }

        await tx.mutate.tasks.update({
          id: task_id,
          status: "starting",
          last_session_id: session_id,
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
          complete: true,
          processed: false,
          created_at: Date.now(),
          updated_at: Date.now(),
        });
      }
    ),
  },
  tools: {
    submitResult: defineMutator(
      z.object({
        tool_block_id: z.string(),
        turn_id: z.string(),
        result: z.string(),
        block_id: z.string(),
        is_error: z.boolean(),
      }),
      async ({
        tx,
        args: { tool_block_id, turn_id, result, block_id, is_error },
      }) => {
        const turn = await tx.run(builder.turns.where("id", turn_id).one());
        const tool = await tx.run(
          builder.blocks
            .where("id", tool_block_id)
            .where("type", "tool_use")
            .one()
        );

        if (!tool) {
          throw new Error("Tool block not found");
        }

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
          status: "none",
          content: {
            type: "tool_result",
            tool_use_id: (tool.content as ToolUseBlockParam).id,
            content: result,
            is_error,
          },
          created_at: Date.now(),
          updated_at: Date.now(),
          processed: false,
        });

        await tx.mutate.blocks.update({
          id: tool_block_id,
          status: "completed",
        });
      }
    ),
    approve: defineMutator(
      z.object({
        block_id: z.string(),
      }),
      async ({ tx, args: { block_id } }) => {
        const block = await tx.run(builder.blocks.where("id", block_id).one());

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
      }
    ),
    deny: defineMutator(
      z.object({
        tool_block_id: z.string(),
        turn_id: z.string(),
        reason: z.string(),
        result_block_id: z.string(),
      }),
      async ({
        tx,
        args: { tool_block_id, turn_id, reason, result_block_id },
      }) => {
        const block = await tx.run(
          builder.blocks.where("id", tool_block_id).one()
        );

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
      }
    ),
  },
  mcps: {
    delete: defineMutator(
      z.object({
        mcp_id: z.string(),
      }),
      async ({ tx, args: { mcp_id } }) => {
        await tx.mutate.mcps.delete({ id: mcp_id });
      }
    ),
  },
  runtimes: {
    register: defineMutator(
      z.object({
        runtime_id: z.string(),
        tools: z.array(z.object({ name: z.string(), version: z.string() })),
      }),
      async ({ tx, ctx, args: { runtime_id, tools } }) => {
        await tx.mutate.runtimes.upsert({
          id: runtime_id,
          user_id: ctx.userId,
          tools,
          created_at: Date.now(),
          updated_at: Date.now(),
        });
      }
    ),
  },
});

export type Mutators = typeof mutators;
