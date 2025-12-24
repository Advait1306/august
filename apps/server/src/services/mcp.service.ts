import { eq } from "drizzle-orm";
import { AppState } from "../config/state";
import {
  mcps,
  mcpOauthIntegrationDetails,
} from "@jupiter/sync/db/schema";
import { OAuthService } from "./oauth.service";
import { ComposioService } from "./composio.service";
import {
  connectMcpServer,
  getMcpTools,
  disconnectAll,
  McpConnection,
} from "@august/harness";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export class McpService {
  private oauthService: OAuthService;
  private composioService: ComposioService;

  constructor(private db: AppState["db"]) {
    this.oauthService = new OAuthService(db);
    this.composioService = new ComposioService(db);
  }

  /**
   * Connect to all MCP servers for a user and return the connections, tools, and mapping
   */
  async connectUserMcps(userId: string): Promise<{
    connections: McpConnection[];
    tools: Tool[];
    toolToMcpId: Map<string, string>;
  }> {
    // Fetch all MCPs for this user
    const userMcps = await this.db
      .select()
      .from(mcps)
      .where(eq(mcps.author_id, userId));

    if (userMcps.length === 0) {
      return { connections: [], tools: [], toolToMcpId: new Map() };
    }

    const connections: McpConnection[] = [];
    const toolToMcpId = new Map<string, string>();

    for (const mcp of userMcps) {
      try {
        let serverUrl: string | null = null;
        let authToken: string | null = null;

        if (mcp.integration_type === "oauth") {
          // Get the MCP server URL
          if (mcp.mcp_store_id) {
            // Store MCP - fetch from oauth integration details
            const [oauthDetails] = await this.db
              .select()
              .from(mcpOauthIntegrationDetails)
              .where(eq(mcpOauthIntegrationDetails.mcp_store_id, mcp.mcp_store_id))
              .limit(1);

            if (oauthDetails) {
              serverUrl = oauthDetails.mcp_server_url;
            }
          } else if (mcp.custom_mcp_server_url) {
            // Custom MCP
            serverUrl = mcp.custom_mcp_server_url;
          }

          if (!serverUrl) {
            console.warn(`[McpService] No server URL found for OAuth MCP: ${mcp.id}`);
            continue;
          }

          // Get the access token
          authToken = await this.oauthService.getAccessToken({ mcpId: mcp.id });

          if (!authToken) {
            console.warn(`[McpService] No access token found for MCP: ${mcp.id}`);
            continue;
          }
        } else if (mcp.integration_type === "composio") {
          // Get the Composio connection URL
          serverUrl = await this.composioService.getConnectionUrl({ mcpId: mcp.id });

          if (!serverUrl) {
            console.warn(`[McpService] No Composio connection URL found for MCP: ${mcp.id}`);
            continue;
          }

          // Composio MCPs don't need auth tokens - the URL contains the auth
        }

        if (!serverUrl) {
          console.warn(`[McpService] No server URL found for MCP: ${mcp.id}`);
          continue;
        }

        console.log(`[McpService] Connecting to MCP: ${mcp.name} (${mcp.id})`);

        const connection = await connectMcpServer({
          name: mcp.name,
          url: serverUrl,
          authToken: authToken ?? undefined,
        });

        connections.push(connection);

        // Map each tool name to its MCP ID
        for (const tool of connection.tools) {
          toolToMcpId.set(tool.name, mcp.id);
        }

        console.log(`[McpService] Connected to MCP: ${mcp.name}, tools: ${connection.tools.length}`);
      } catch (error) {
        // Log error but continue with other MCPs (graceful degradation)
        console.error(`[McpService] Failed to connect to MCP ${mcp.name} (${mcp.id}):`, error);
      }
    }

    // Get all tools from all connections
    const tools = getMcpTools(connections);

    console.log(`[McpService] Connected to ${connections.length} MCPs with ${tools.length} total tools`);

    return { connections, tools, toolToMcpId };
  }

  /**
   * Disconnect all MCP connections
   */
  async disconnectAllConnections(connections: McpConnection[]): Promise<void> {
    if (connections.length === 0) {
      return;
    }

    console.log(`[McpService] Disconnecting ${connections.length} MCP connections`);
    await disconnectAll(connections);
  }

  /**
   * Execute a single MCP tool by mcpId
   * Creates a temporary connection, executes the tool, and disconnects
   */
  async executeTool(params: {
    mcpId: string;
    toolName: string;
    args: Record<string, unknown>;
  }): Promise<unknown> {
    const { mcpId, toolName, args } = params;

    // Fetch the MCP
    const [mcp] = await this.db
      .select()
      .from(mcps)
      .where(eq(mcps.id, mcpId))
      .limit(1);

    if (!mcp) {
      throw new Error(`MCP not found: ${mcpId}`);
    }

    let serverUrl: string | null = null;
    let authToken: string | null = null;

    if (mcp.integration_type === "oauth") {
      // Get the MCP server URL
      if (mcp.mcp_store_id) {
        const [oauthDetails] = await this.db
          .select()
          .from(mcpOauthIntegrationDetails)
          .where(eq(mcpOauthIntegrationDetails.mcp_store_id, mcp.mcp_store_id))
          .limit(1);

        if (oauthDetails) {
          serverUrl = oauthDetails.mcp_server_url;
        }
      } else if (mcp.custom_mcp_server_url) {
        serverUrl = mcp.custom_mcp_server_url;
      }

      if (!serverUrl) {
        throw new Error(`No server URL found for OAuth MCP: ${mcpId}`);
      }

      // Get the access token
      authToken = await this.oauthService.getAccessToken({ mcpId });

      if (!authToken) {
        throw new Error(`No access token found for MCP: ${mcpId}`);
      }
    } else if (mcp.integration_type === "composio") {
      serverUrl = await this.composioService.getConnectionUrl({ mcpId });

      if (!serverUrl) {
        throw new Error(`No Composio connection URL found for MCP: ${mcpId}`);
      }
    }

    if (!serverUrl) {
      throw new Error(`No server URL found for MCP: ${mcpId}`);
    }

    console.log(`[McpService] Executing tool ${toolName} on MCP: ${mcp.name} (${mcpId})`);

    // Connect to the MCP
    const connection = await connectMcpServer({
      name: mcp.name,
      url: serverUrl,
      authToken: authToken ?? undefined,
    });

    try {
      // Execute the tool
      const result = await connection.execute(toolName, args);
      console.log(`[McpService] Tool ${toolName} executed successfully`);
      return result;
    } finally {
      // Always disconnect
      await connection.disconnect();
    }
  }
}
