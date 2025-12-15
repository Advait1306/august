import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { Tool as McpTool } from "@modelcontextprotocol/sdk/types.js";
import type { Tool as AnthropicTool } from "@anthropic-ai/sdk/resources/messages";

/**
 * Configuration for connecting to an MCP server
 */
export interface McpServerConfig {
  /** Unique name for this server */
  name: string;
  /** URL of the MCP server */
  url: string;
  /** Optional authorization token */
  authToken?: string;
}

/**
 * Result of connecting to an MCP server
 */
export interface McpConnection {
  /** Server name */
  name: string;
  /** MCP client instance */
  client: Client;
  /** Tools available on this server (in Anthropic format with allowed_callers) */
  tools: AnthropicTool[];
  /** Original MCP tools */
  mcpTools: McpTool[];
  /** Execute a tool by name */
  execute: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  /** Disconnect from the server */
  disconnect: () => Promise<void>;
}

/**
 * Convert MCP tool to Anthropic tool format with programmatic calling enabled
 */
function convertMcpToolToAnthropic(tool: McpTool, serverName: string): AnthropicTool {
  return {
    name: `${serverName}__${tool.name}`,
    description: tool.description || `Tool from ${serverName}`,
    input_schema: (tool.inputSchema || { type: "object", properties: {} }) as AnthropicTool["input_schema"],
    // Enable programmatic calling from code execution
    allowed_callers: ["code_execution_20250825"],
  } as AnthropicTool;
}

/**
 * Connect to an MCP server and retrieve its tools
 */
export async function connectMcpServer(config: McpServerConfig): Promise<McpConnection> {
  const client = new Client(
    { name: "august-harness", version: "1.0.0" },
    { capabilities: {} }
  );

  // Create transport with optional auth header
  const url = new URL(config.url);
  const headers: Record<string, string> = {};
  if (config.authToken) {
    headers["Authorization"] = `Bearer ${config.authToken}`;
  }

  let transport: StreamableHTTPClientTransport | SSEClientTransport;

  // Try StreamableHTTP first, fall back to SSE
  try {
    transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers },
    });
    await client.connect(transport);
  } catch (error) {
    // Fall back to SSE transport
    transport = new SSEClientTransport(url, {
      requestInit: { headers },
    });
    await client.connect(transport);
  }

  // List tools from the server
  const toolsResult = await client.listTools();
  const mcpTools = toolsResult.tools;

  // Convert to Anthropic format with allowed_callers
  const tools = mcpTools.map((tool) => convertMcpToolToAnthropic(tool, config.name));

  // Create executor function
  const execute = async (toolName: string, args: Record<string, unknown>): Promise<unknown> => {
    // Strip server name prefix if present
    const actualToolName = toolName.startsWith(`${config.name}__`)
      ? toolName.slice(config.name.length + 2)
      : toolName;

    const result = await client.callTool({ name: actualToolName, arguments: args });

    // Extract content from result
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find((c): c is { type: "text"; text: string } => c.type === "text");
      if (textContent) {
        // Try to parse as JSON if possible
        try {
          return JSON.parse(textContent.text);
        } catch {
          return textContent.text;
        }
      }
      return result.content;
    }
    return result;
  };

  // Create disconnect function
  const disconnect = async () => {
    await client.close();
  };

  return {
    name: config.name,
    client,
    tools,
    mcpTools,
    execute,
    disconnect,
  };
}

/**
 * Connect to multiple MCP servers
 */
export async function connectMcpServers(configs: McpServerConfig[]): Promise<McpConnection[]> {
  return Promise.all(configs.map(connectMcpServer));
}

/**
 * Get all tools from MCP connections (already in Anthropic format with allowed_callers)
 */
export function getMcpTools(connections: McpConnection[]): AnthropicTool[] {
  return connections.flatMap((conn) => conn.tools);
}

/**
 * Create a unified executor for all MCP connections
 */
export function createMcpExecutor(
  connections: McpConnection[]
): (toolName: string, args: Record<string, unknown>) => Promise<unknown> {
  return async (toolName: string, args: Record<string, unknown>) => {
    // Find the connection that owns this tool
    for (const conn of connections) {
      if (toolName.startsWith(`${conn.name}__`)) {
        return conn.execute(toolName, args);
      }
    }
    throw new Error(`No MCP connection found for tool: ${toolName}`);
  };
}

/**
 * Disconnect all MCP connections
 */
export async function disconnectAll(connections: McpConnection[]): Promise<void> {
  await Promise.all(connections.map((conn) => conn.disconnect()));
}
