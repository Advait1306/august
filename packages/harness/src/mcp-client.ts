import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { Tool as McpTool } from "@modelcontextprotocol/sdk/types.js";
import type { Tool as AnthropicTool } from "@anthropic-ai/sdk/resources/messages";

/**
 * Sanitize a tool name to match Anthropic API requirements.
 * Anthropic requires tool names to match: ^[a-zA-Z0-9_-]{1,128}$
 * Replaces invalid characters (like dots) with underscores.
 */
function sanitizeToolName(name: string): string {
  // Replace any character that's not alphanumeric, underscore, or hyphen with underscore
  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  // Truncate to 128 characters if needed
  return sanitized.slice(0, 128);
}

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
  /** Mapping from sanitized tool names to original MCP tool names */
  toolNameMap: Map<string, string>;
  /** Execute a tool by name (accepts sanitized name, maps to original) */
  execute: (
    toolName: string,
    args: Record<string, unknown>
  ) => Promise<unknown>;
  /** Disconnect from the server */
  disconnect: () => Promise<void>;
}

/**
 * Convert MCP tool to Anthropic tool format with programmatic calling enabled.
 * Returns both the Anthropic tool and the sanitized full name for mapping.
 */
function convertMcpToolToAnthropic(
  tool: McpTool,
  serverName: string
): { anthropicTool: AnthropicTool; sanitizedName: string } {
  // Sanitize both server name and tool name to ensure valid Anthropic tool name
  const sanitizedServerName = sanitizeToolName(serverName);
  const sanitizedToolName = sanitizeToolName(tool.name);
  const sanitizedName = `${sanitizedServerName}__${sanitizedToolName}`;

  return {
    anthropicTool: {
      name: sanitizedName,
      description: tool.description || `Tool from ${serverName}`,
      input_schema: (tool.inputSchema || {
        type: "object",
        properties: {},
      }) as AnthropicTool["input_schema"],
      // Enable programmatic calling from code execution
      allowed_callers: ["code_execution_20250825"],
    } as AnthropicTool,
    sanitizedName,
  };
}

/**
 * Connect to an MCP server and retrieve its tools
 */
export async function connectMcpServer(
  config: McpServerConfig
): Promise<McpConnection> {
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

  // Convert to Anthropic format and build name mapping
  // Map: sanitized full name -> original MCP tool name
  const toolNameMap = new Map<string, string>();
  const tools: AnthropicTool[] = [];

  for (const tool of mcpTools) {
    const { anthropicTool, sanitizedName } = convertMcpToolToAnthropic(
      tool,
      config.name
    );
    tools.push(anthropicTool);
    // Map the sanitized name to the original MCP tool name
    toolNameMap.set(sanitizedName, tool.name);
  }

  // Create executor function
  const execute = async (
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> => {
    // Look up the original tool name from the mapping
    const originalToolName = toolNameMap.get(toolName);
    if (!originalToolName) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const result = await client.callTool({
      name: originalToolName,
      arguments: args,
    });

    // Extract content from result
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find(
        (c): c is { type: "text"; text: string } => c.type === "text"
      );
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
    toolNameMap,
    execute,
    disconnect,
  };
}

/**
 * Connect to multiple MCP servers
 */
export async function connectMcpServers(
  configs: McpServerConfig[]
): Promise<McpConnection[]> {
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
    // Find the connection that owns this tool by checking the toolNameMap
    for (const conn of connections) {
      if (conn.toolNameMap.has(toolName)) {
        return conn.execute(toolName, args);
      }
    }
    throw new Error(`No MCP connection found for tool: ${toolName}`);
  };
}

/**
 * Disconnect all MCP connections
 */
export async function disconnectAll(
  connections: McpConnection[]
): Promise<void> {
  await Promise.all(connections.map((conn) => conn.disconnect()));
}
