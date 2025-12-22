import type { ZodSchema } from "zod";

/**
 * Metadata for a single shell tool
 */
export interface ToolMetadata {
  name: string;
  version: string;
  description: string;
}

/**
 * Full tool definition including schemas
 */
export interface ToolDefinition extends ToolMetadata {
  inputSchema: ZodSchema;
  outputSchema: ZodSchema;
}

/**
 * Manifest containing all shell tools metadata
 * Used for runtime registration and version checking
 */
export interface ShellToolsManifest {
  /** Package version from package.json */
  packageVersion: string;
  /** Individual tool metadata */
  tools: ToolMetadata[];
}
