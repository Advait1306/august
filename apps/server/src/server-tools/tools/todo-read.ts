import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { blocks, turns } from "@jupiter/sync/db/schema";
import type { ToolUseBlockParam } from "@anthropic-ai/sdk/resources";
import type { ServerToolContext, ServerToolDefinition } from "../types";
import type { TodoWriteInput } from "./todo-write";

/**
 * Input schema for the todo_read tool (empty - no input needed)
 */
export const TodoReadInputSchema = z.object({});

export type TodoReadInput = z.infer<typeof TodoReadInputSchema>;

/**
 * Schema for a single todo item (same as todo_write)
 */
const TodoItemSchema = z.object({
  content: z.string().describe("The content/description of the todo item"),
  status: z
    .enum(["pending", "in_progress", "completed"])
    .describe("The status of the todo item"),
  activeForm: z
    .string()
    .optional()
    .describe("Present continuous form shown during execution"),
});

/**
 * Output schema for the todo_read tool
 */
export const TodoReadOutputSchema = z.object({
  todos: z.array(TodoItemSchema).describe("The list of todos"),
});

export type TodoReadOutput = z.infer<typeof TodoReadOutputSchema>;

/**
 * todo_read tool definition
 *
 * This tool retrieves the latest todo list by scanning conversation history
 * for the most recent todo_write block.
 */
export const todoReadToolDefinition: ServerToolDefinition = {
  name: "todo_read",
  version: "0.0.1",
  description:
    "Retrieves the current todo list from conversation history. Returns the todos from the most recent todo_write call.",
  inputSchema: TodoReadInputSchema,
  outputSchema: TodoReadOutputSchema,
  execute: async (_input: unknown, context: ServerToolContext) => {
    const { taskId, db } = context;

    // Get all turns for the task ordered by creation time
    const taskTurns = await db.query.turns.findMany({
      where: eq(turns.task_id, taskId),
      with: {
        blocks: {
          where: eq(blocks.type, "tool_use"),
          orderBy: [asc(blocks.created_at)],
        },
      },
      orderBy: [asc(turns.created_at)],
    });

    // Iterate turns in reverse order to find the latest todo_write
    for (let i = taskTurns.length - 1; i >= 0; i--) {
      const turn = taskTurns[i];

      // Check each block in this turn (also in reverse for latest)
      for (let j = turn.blocks.length - 1; j >= 0; j--) {
        const block = turn.blocks[j];
        const content = block.content as ToolUseBlockParam;

        if (content.name === "todo_write") {
          // Found the latest todo_write block
          const input = content.input as TodoWriteInput;
          return {
            todos: input.todos ?? [],
          };
        }
      }
    }

    // No todo_write found, return empty array
    return {
      todos: [],
    };
  },
};
