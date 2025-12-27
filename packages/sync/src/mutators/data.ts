import { defineMutator, defineMutators } from "@rocicorp/zero";
import { z } from "zod";
import { builder } from "../zero/schema";
import { ToolUseBlockParam } from "@anthropic-ai/sdk/resources";

export const mutators = defineMutators({
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
        skill_ids: z.array(z.string()).optional(),
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
          skill_ids,
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

        if (skill_ids && skill_ids.length > 0) {
          for (const skill_id of skill_ids) {
            await tx.mutate.taskSkills.upsert({
              task_id,
              skill_id,
            });
          }
        }
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
        skill_ids: z.array(z.string()).optional(),
      }),
      async ({
        tx,
        ctx,
        args: { message, task_id, turn_id, block_id, session_id, skill_ids },
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

        if (skill_ids && skill_ids.length > 0) {
          for (const skill_id of skill_ids) {
            await tx.mutate.taskSkills.upsert({
              task_id,
              skill_id,
            });
          }
        }
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
  skills: {
    create: defineMutator(
      z.object({
        id: z.string(),
        name: z.string(),
        prompt: z.string(),
        description: z.string(),
      }),
      async ({ tx, ctx, args: { id, name, prompt, description } }) => {
        await tx.mutate.skills.insert({
          id,
          organisation_id: ctx.orgId,
          author_id: ctx.userId,
          name,
          prompt,
          description,
          created_at: Date.now(),
          updated_at: Date.now(),
        });
      }
    ),
    update: defineMutator(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        prompt: z.string().optional(),
        description: z.string().optional(),
      }),
      async ({ tx, ctx, args: { id, name, prompt, description } }) => {
        const skill = await tx.run(
          builder.skills
            .where("id", id)
            .where("organisation_id", ctx.orgId)
            .one()
        );

        if (!skill) {
          throw new Error("Skill not found");
        }

        await tx.mutate.skills.update({
          id,
          ...(name !== undefined && { name }),
          ...(prompt !== undefined && { prompt }),
          ...(description !== undefined && { description }),
          updated_at: Date.now(),
        });
      }
    ),
    delete: defineMutator(
      z.object({
        id: z.string(),
      }),
      async ({ tx, ctx, args: { id } }) => {
        const skill = await tx.run(
          builder.skills
            .where("id", id)
            .where("organisation_id", ctx.orgId)
            .one()
        );

        if (!skill) {
          throw new Error("Skill not found");
        }

        await tx.mutate.skills.delete({ id });
      }
    ),
  },
  skillDocuments: {
    create: defineMutator(
      z.object({
        id: z.string(),
        skill_id: z.string(),
        name: z.string(),
        content: z.string(),
        description: z.string(),
      }),
      async ({ tx, ctx, args: { id, skill_id, name, content, description } }) => {
        const skill = await tx.run(
          builder.skills
            .where("id", skill_id)
            .where("organisation_id", ctx.orgId)
            .one()
        );

        if (!skill) {
          throw new Error("Skill not found");
        }

        await tx.mutate.skillDocuments.insert({
          id,
          skill_id,
          name,
          content,
          description,
          created_at: Date.now(),
          updated_at: Date.now(),
        });
      }
    ),
    update: defineMutator(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        content: z.string().optional(),
        description: z.string().optional(),
      }),
      async ({ tx, ctx, args: { id, name, content, description } }) => {
        const doc = await tx.run(
          builder.skillDocuments
            .where("id", id)
            .related("skill", (q) => q.where("organisation_id", ctx.orgId))
            .one()
        );

        if (!doc || !doc.skill) {
          throw new Error("Document not found or access denied");
        }

        await tx.mutate.skillDocuments.update({
          id,
          ...(name !== undefined && { name }),
          ...(content !== undefined && { content }),
          ...(description !== undefined && { description }),
          updated_at: Date.now(),
        });
      }
    ),
    delete: defineMutator(
      z.object({
        id: z.string(),
      }),
      async ({ tx, ctx, args: { id } }) => {
        const doc = await tx.run(
          builder.skillDocuments
            .where("id", id)
            .related("skill", (q) => q.where("organisation_id", ctx.orgId))
            .one()
        );

        if (!doc || !doc.skill) {
          throw new Error("Document not found or access denied");
        }

        await tx.mutate.skillDocuments.delete({ id });
      }
    ),
  },
});

export type Mutators = typeof mutators;
