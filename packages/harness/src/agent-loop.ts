import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type {
  BetaRequestMCPServerURLDefinition,
  BetaMCPToolset,
  BetaRawMessageStreamEvent,
  BetaMessageParam,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { systemPrompt } from "./system";

/**
 * Agent loop configuration
 */
export interface AgentLoopConfig {
  messages: BetaMessageParam[];
  tools?: Tool[];
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

  // Build MCP toolsets for each server
  const mcpToolsets: BetaMCPToolset[] = mcpServers.map((server) => ({
    type: "mcp_toolset" as const,
    mcp_server_name: server.name,
  }));

  const allTools = [...tools, ...mcpToolsets];
  const betas = mcpServers.length > 0 ? ["mcp-client-2025-11-20"] : [];

  const stream = await client.beta.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    tools: allTools.length > 0 ? allTools : undefined,
    messages,
    mcp_servers: mcpServers.length > 0 ? mcpServers : undefined,
    betas,
    stream: true,
  });

  for await (const event of stream) {
    yield event;
  }
}
