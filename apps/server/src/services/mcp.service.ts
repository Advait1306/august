import { eq } from "drizzle-orm";
import { AppState } from "../config/state";
import {
  mcps,
  mcpOauthIntegrationDetails,
  mcpStore,
} from "@jupiter/sync/db/schema";
import {
  connectMcpServer,
  getMcpTools,
  disconnectAll,
  McpConnection,
} from "@august/harness";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";

/**
 * Represents a user's MCP record from the database
 */
export type Mcp = typeof mcps.$inferSelect;

/**
 * Represents an MCP store record from the database
 */
export type McpStore = typeof mcpStore.$inferSelect;

/**
 * Parameters for connecting to an MCP server
 */
export interface ConnectToMcpParams {
  name: string;
  url: string;
  authToken?: string;
}

/**
 * Service for managing MCP (Model Context Protocol) connections.
 * This service handles fetching MCP configurations and establishing connections.
 *
 * Note: This service does not handle authentication. The orchestrator (worker) is
 * responsible for obtaining auth tokens from OAuth/Composio services and passing
 * them to the connection methods.
 */
export class McpService {
  private static instance: McpService | null = null;
  private db: AppState["db"];

  private constructor(db: AppState["db"]) {
    this.db = db;
  }

  /**
   * Get the singleton instance of McpService
   */
  static getInstance(db: AppState["db"]): McpService {
    if (!McpService.instance) {
      McpService.instance = new McpService(db);
    }
    return McpService.instance;
  }

  /**
   * Fetch all MCPs for a user from the database
   */
  async getUserMcps(userId: string): Promise<Mcp[]> {
    const userMcps = await this.db
      .select()
      .from(mcps)
      .where(eq(mcps.author_id, userId));

    return userMcps;
  }

  /**
   * Fetch an MCP store entry by ID
   * @param id - The MCP store ID
   * @returns The MCP store record or null if not found
   */
  async getMcpStoreById(id: string): Promise<McpStore | null> {
    const [store] = await this.db
      .select()
      .from(mcpStore)
      .where(eq(mcpStore.id, id))
      .limit(1);

    return store || null;
  }

  /**
   * Get the server URL for an MCP based on its configuration.
   * For OAuth MCPs from the store, fetches the URL from oauth integration details.
   * For custom MCPs, returns the custom server URL.
   *
   * Note: This does NOT return URLs for Composio MCPs - those are obtained
   * through the ComposioService as they require connection-specific URLs.
   *
   * @returns The server URL or null if not found
   */
  async getMcpServerUrl(mcp: Mcp): Promise<string | null> {
    // For OAuth MCPs from the store, fetch URL from integration details
    if (mcp.mcp_store_id) {
      const [oauthDetails] = await this.db
        .select()
        .from(mcpOauthIntegrationDetails)
        .where(eq(mcpOauthIntegrationDetails.mcp_store_id, mcp.mcp_store_id))
        .limit(1);

      if (oauthDetails) {
        return oauthDetails.mcp_server_url;
      }
    }

    // For custom MCPs, use the custom server URL
    if (mcp.custom_mcp_server_url) {
      return mcp.custom_mcp_server_url;
    }

    return null;
  }

  /**
   * Connect to an MCP server with the provided credentials
   *
   * @param params - Connection parameters including name, URL, and optional auth token
   * @returns The MCP connection
   */
  async connectToMcp(params: ConnectToMcpParams): Promise<McpConnection> {
    console.log(`[McpService] Connecting to MCP: ${params.name}`);

    const connection = await connectMcpServer({
      name: params.name,
      url: params.url,
      authToken: params.authToken,
    });

    console.log(`[McpService] Connected to MCP: ${params.name}, tools: ${connection.tools.length}`);

    return connection;
  }

  /**
   * Get all tools from MCP connections in Anthropic format
   */
  getToolsFromConnections(connections: McpConnection[]): Tool[] {
    return getMcpTools(connections);
  }

  /**
   * Build a mapping from tool names to MCP IDs
   */
  buildToolToMcpIdMap(connections: McpConnection[], mcpIds: string[]): Map<string, string> {
    const toolToMcpId = new Map<string, string>();

    connections.forEach((connection, index) => {
      const mcpId = mcpIds[index];
      if (mcpId) {
        for (const tool of connection.tools) {
          toolToMcpId.set(tool.name, mcpId);
        }
      }
    });

    return toolToMcpId;
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
}
