import { defineMutator } from "@rocicorp/zero";
import { z } from "zod";
import { builder } from "../../zero/schema";
import { ToolUseBlockParam } from "@anthropic-ai/sdk/resources";
import { taskMutators, messageMutators } from "./mutators";
import type { AsyncTask, AddToAgentLoopQueue, TrackEventFn } from "../types";

export function createTaskServerMutators(
  asyncTasks: AsyncTask,
  addToAgentLoopQueue: AddToAgentLoopQueue,
  createTrackEvent: (userId: string, orgId: string) => TrackEventFn
) {
  return {
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
          // Run the base mutator
          await taskMutators.create.fn({
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
          });

          // Add to agent loop queue
          asyncTasks.push(async () => {
            addToAgentLoopQueue({
              task_id,
              turn_id,
              block_id,
            });
          });

          asyncTasks.push(async () => {
            // Track analytics
            const trackEvent = createTrackEvent(ctx.userId, ctx.orgId);
            await trackEvent("task_created", { task_id });
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

          asyncTasks.push(async () => {
            // TODO: Create a task stop processing job
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
          // Run the base mutator
          await messageMutators.create.fn({
            tx,
            ctx,
            args: {
              message,
              task_id,
              turn_id,
              block_id,
              session_id,
              skill_ids,
            },
          });

          // Add to agent loop queue
          asyncTasks.push(async () => {
            addToAgentLoopQueue({
              task_id,
              turn_id,
              block_id,
            });
          });

          // TODO: Add analytics event
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
          ctx,
          args: { tool_block_id, turn_id, result, block_id, is_error },
        }) => {
          const turn = await tx.run(
            builder.turns
              .where("id", turn_id)
              .related("task", (q) => {
                return q.where("author_id", ctx.userId);
              })
              .one()
          );

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

          asyncTasks.push(async () => {
            addToAgentLoopQueue({
              task_id: turn.task_id,
              turn_id,
              block_id,
            });
          });
          // TODO: Add analytics event
        }
      ),
      approve: defineMutator(
        z.object({
          block_id: z.string(),
        }),
        async ({ tx, ctx, args: { block_id } }) => {
          const block = await tx.run(
            builder.blocks
              .where("id", block_id)
              .related("turn", (q) => {
                return q.related("task", (s) => {
                  return s.where("author_id", ctx.userId);
                });
              })
              .one()
          );

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
          // TODO: Add analytics event
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
          ctx,
          args: { tool_block_id, turn_id, reason, result_block_id },
        }) => {
          const block = await tx.run(
            builder.blocks
              .where("id", tool_block_id)
              .related("turn", (q) => {
                return q.related("task", (s) => {
                  return s.where("author_id", ctx.userId);
                });
              })
              .one()
          );

          const turn = await tx.run(builder.turns.where("id", turn_id).one());

          if (!turn) {
            throw new Error("Turn not found");
          }

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

          asyncTasks.push(async () => {
            addToAgentLoopQueue({
              task_id: turn.task_id,
              turn_id,
              block_id: tool_block_id,
            });
          });
          // TODO: Add analytics event
        }
      ),
    },
  };
}
