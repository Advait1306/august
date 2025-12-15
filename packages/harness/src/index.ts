export {
  agentLoop,
  type AgentLoopConfig,
  type ZodToolDefinition,
} from "./agent-loop";
export type { BetaRawMessageStreamEvent } from "@anthropic-ai/sdk/resources/beta/messages/messages";

// MCP client utilities for programmatic tool calling
export {
  connectMcpServer,
  connectMcpServers,
  getMcpTools,
  createMcpExecutor,
  disconnectAll,
  type McpServerConfig,
  type McpConnection,
} from "./mcp-client";
