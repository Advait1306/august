/**
 * Server tools manifest - aggregates all server-side tool definitions
 */

import { todoWriteToolDefinition } from "./tools/todo-write";
import { todoReadToolDefinition } from "./tools/todo-read";
import type { ServerToolDefinition } from "./types";

/**
 * All server tool definitions
 */
export const serverToolDefinitions = [
  todoWriteToolDefinition,
  todoReadToolDefinition,
] as const satisfies readonly ServerToolDefinition[];

/**
 * Server tool names as a union type
 */
export type ServerToolName = (typeof serverToolDefinitions)[number]["name"];

/**
 * Set of server tool names for quick lookup
 */
const serverToolNamesSet = new Set<string>(
  serverToolDefinitions.map((tool) => tool.name)
);

/**
 * Check if a tool name is a server-side tool
 */
export function isServerTool(toolName: string): boolean {
  return serverToolNamesSet.has(toolName);
}

/**
 * Get a server tool definition by name
 */
export function getServerTool(
  toolName: string
): ServerToolDefinition | undefined {
  return serverToolDefinitions.find((tool) => tool.name === toolName);
}

// Re-export types
export * from "./types";
export { todoWriteToolDefinition } from "./tools/todo-write";
export { todoReadToolDefinition } from "./tools/todo-read";
