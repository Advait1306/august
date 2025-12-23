/**
 * Server tool executor - routes tool execution to the correct implementation
 */

import { getServerTool } from "./index";
import type { ServerToolContext } from "./types";

/**
 * Execute a server-side tool
 *
 * @param name - The name of the tool to execute
 * @param input - The tool input (already validated by Claude)
 * @param context - Execution context including taskId, turnId, blockId, and db
 * @returns The tool output
 */
export async function executeServerTool(
  name: string,
  input: unknown,
  context: ServerToolContext
): Promise<unknown> {
  const tool = getServerTool(name);

  if (!tool) {
    throw new Error(`Unknown server tool: ${name}`);
  }

  // Validate input against schema
  const parsedInput = tool.inputSchema.parse(input);

  // Execute the tool
  const output = await tool.execute(parsedInput, context);

  // Validate output against schema
  return tool.outputSchema.parse(output);
}
