import type { ZodObject } from "zod";
import type { AppState } from "../config/state";

/**
 * Context provided to server tools during execution
 */
export interface ServerToolContext {
  taskId: string;
  turnId: string;
  blockId: string;
  db: AppState["db"];
}

/**
 * Definition for a server-side tool (non-generic for use in arrays/manifests)
 * Uses ZodObject to match ZodToolDefinition from @august/harness
 */
export interface ServerToolDefinition {
  name: string;
  version: string;
  description: string;
  inputSchema: ZodObject;
  outputSchema: ZodObject;
  execute: (input: unknown, context: ServerToolContext) => Promise<unknown>;
}
