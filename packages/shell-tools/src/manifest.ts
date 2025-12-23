/**
 * Shell tools manifest - aggregates all tool definitions and metadata
 */

import { grepToolDefinition } from "./grep";
import { globToolDefinition } from "./glob";
import { lsToolDefinition } from "./ls";
import { editToolDefinition } from "./edit";
import { writeToolDefinition } from "./write";
import { multieditToolDefinition } from "./multiedit";
import type { ShellToolsManifest, ToolDefinition } from "./types";

/**
 * All tool definitions with full schemas
 */
export const toolDefinitions = [
  grepToolDefinition,
  globToolDefinition,
  lsToolDefinition,
  editToolDefinition,
  writeToolDefinition,
  multieditToolDefinition,
] as const satisfies readonly ToolDefinition[];

/**
 * Tool names as a union type
 */
export type ToolName = (typeof toolDefinitions)[number]["name"];

/**
 * Get the shell tools manifest containing package and tool versions
 * Used for runtime registration and version checking
 */
export function getShellToolsManifest(): ShellToolsManifest {
  return {
    tools: toolDefinitions.map((tool) => ({
      name: tool.name,
      version: tool.version,
      description: tool.description,
    })),
  };
}

/**
 * Pre-built manifest for synchronous access
 */
export const shellToolsManifest: ShellToolsManifest = getShellToolsManifest();
