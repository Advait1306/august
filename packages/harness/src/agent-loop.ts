import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type {
  BetaRequestMCPServerURLDefinition,
  BetaMCPToolset,
  BetaRawMessageStreamEvent,
  BetaMessageParam,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { systemPrompt } from "./system";
import type { ZodObject } from "zod";
import { toJSONSchema } from "zod/v4/core";

/**
 * Zod-based tool definition (as exported by @august/shell-tools)
 */
export interface ZodToolDefinition {
  name: string;
  description: string;
  inputSchema: ZodObject;
}

/**
 * Agent loop configuration
 */
export interface AgentLoopConfig {
  messages: BetaMessageParam[];
  tools?: (Tool | ZodToolDefinition)[];
  mcpServers?: BetaRequestMCPServerURLDefinition[];
  model?: string;
  maxTokens?: number;
}

/**
 * Run the agent loop as an async generator
 *
 * Takes messages and tools, streams them through the Anthropic API,
 * and yields events as they arrive. MCP tools are executed server-side.
 */
export async function* agentLoop(
  config: AgentLoopConfig
): AsyncGenerator<BetaRawMessageStreamEvent> {
  const {
    messages,
    tools = [],
    mcpServers = [],
    model = "claude-sonnet-4-20250514",
    maxTokens = 8192,
  } = config;

  const client = new Anthropic();

  // Convert tools to Anthropic format (handle both Tool and ZodToolDefinition)
  const convertedTools: Tool[] = tools.map((tool) => {
    if ("input_schema" in tool) {
      // Already in Anthropic Tool format
      return tool;
    }
    // ZodToolDefinition - convert inputSchema to JSON schema
    return {
      name: tool.name,
      description: tool.description,
      input_schema: toJSONSchema(tool.inputSchema) as Tool["input_schema"],
    };
  });

  // Build MCP toolsets for each server
  const mcpToolsets: BetaMCPToolset[] = mcpServers.map((server) => ({
    type: "mcp_toolset" as const,
    mcp_server_name: server.name,
  }));

  const allTools = [...convertedTools, ...mcpToolsets];
  const hasMcp = mcpServers.length > 0;

  const stream = await client.beta.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    tools: allTools.length > 0 ? allTools : undefined,
    messages,
    mcp_servers: hasMcp ? mcpServers : undefined,
    betas: hasMcp ? ["mcp-client-2025-11-20"] : undefined,
    stream: true,
  });

  for await (const event of stream) {
    yield event;
  }
}
