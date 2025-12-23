import { z } from "zod";
import type { ServerToolDefinition } from "../types";

/**
 * Schema for a single todo item
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
 * Input schema for the todo_write tool
 */
export const TodoWriteInputSchema = z.object({
  todos: z
    .array(TodoItemSchema)
    .describe("The list of todos to save"),
});

export type TodoWriteInput = z.infer<typeof TodoWriteInputSchema>;

/**
 * Output schema for the todo_write tool
 */
export const TodoWriteOutputSchema = z.object({
  message: z.string().describe("Confirmation message"),
});

export type TodoWriteOutput = z.infer<typeof TodoWriteOutputSchema>;

/**
 * todo_write tool definition
 *
 * This tool stores todos in the tool_use block's input - execution simply
 * returns a confirmation message. The actual todos are retrieved by todo_read
 * which scans conversation history for the latest todo_write block.
 */
export const todoWriteToolDefinition: ServerToolDefinition = {
  name: "todo_write",
  version: "0.0.1",
  description:
    "Saves the current todo list. The todos are stored in the conversation history and can be retrieved using todo_read.",
  inputSchema: TodoWriteInputSchema,
  outputSchema: TodoWriteOutputSchema,
  execute: async () => {
    // The todos are already stored in the tool_use block's input
    // No additional storage is needed
    return {
      message: "Your todos have been saved.",
    };
  },
};
