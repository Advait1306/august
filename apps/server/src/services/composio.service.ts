import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { AppState } from "../config/state";
import { Composio } from "@composio/core";
import {
  mcps,
  mcpStore,
  mcpComposioIntegrationDetails,
  mcpComposioConnections,
  composioStates,
} from "@jupiter/sync/db/schema";

export class ComposioService {
  private composio: Composio;

  constructor(private db: AppState["db"]) {
    const apiKey = process.env.COMPOSIO_API_KEY;
    if (!apiKey) {
      throw new Error("COMPOSIO_API_KEY environment variable is not set");
    }
    this.composio = new Composio({ apiKey });
  }

  /**
   * Initiates Composio connection flow by creating a redirect URL
   * This is step 1: Generate the redirect URL for the user to authenticate
   */
  async initiateComposioFlow(params: {
    mcpStoreId: string;
    userId: string;
    organisationId: string;
  }): Promise<{ redirectUrl: string; connectionRequestId: string }> {
    const { mcpStoreId, userId, organisationId } = params;

    console.log("[Composio Flow] Starting Composio flow:", {
      mcpStoreId,
      userId,
      organisationId,
    });

    // Fetch the MCP from store
    const [store] = await this.db
      .select()
      .from(mcpStore)
      .where(eq(mcpStore.id, mcpStoreId))
      .limit(1);

    if (!store) {
      throw new Error("MCP not found in store");
    }

    // Check integration type
    if (store.integration_type !== "composio") {
      throw new Error("MCP is not configured for Composio integration");
    }

    // Fetch Composio integration details
    const [composioDetails] = await this.db
      .select()
      .from(mcpComposioIntegrationDetails)
      .where(eq(mcpComposioIntegrationDetails.mcp_store_id, mcpStoreId))
      .limit(1);

    if (!composioDetails) {
      throw new Error("Composio integration details not found for this MCP");
    }

    console.log("[Composio Flow] Found Composio details:", {
      authConfigId: composioDetails.auth_config_id,
      mcpConfigId: composioDetails.mcp_config_id,
    });

    // Generate unique user identifier for Composio
    // Format: user-{userId}-org-{orgId}
    const composioUserId = `user-${userId}-org-${organisationId}`;

    console.log(
      "[Composio Flow] Creating connection request for:",
      composioUserId
    );

    // Create the connection request with Composio
    const connectionRequest = await this.composio.connectedAccounts.link(
      composioUserId,
      composioDetails.auth_config_id,
      {
        callbackUrl: `${process.env.SERVER_URL}/api/mcp/callback`,
      }
    );

    console.log("[Composio Flow] Connection request created:", {
      connectionRequestId: connectionRequest.id,
      redirectUrl: connectionRequest.redirectUrl,
    });

    if (!connectionRequest.redirectUrl) {
      throw new Error("Composio did not return a redirect URL");
    }

    // Store the state in database (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    console.log("[Composio Flow] Storing Composio state");
    await this.db.insert(composioStates).values({
      id: randomUUID(),
      connection_request_id: connectionRequest.id,
      user_id: userId,
      organisation_id: organisationId,
      mcp_store_id: mcpStoreId,
      created_at: new Date(),
      expires_at: expiresAt,
    });

    return {
      redirectUrl: connectionRequest.redirectUrl,
      connectionRequestId: connectionRequest.id,
    };
  }

  /**
   * Handles Composio callback after user authentication
   * This is step 2: Wait for connection and generate the MCP instance URL
   * Note: This method doesn't require authentication as it retrieves user/org info from stored state
   */
  async handleComposioCallback(params: {
    connectedAccountId: string;
  }): Promise<{
    success: boolean;
    mcpId?: string;
    error?: string;
    redirectUri?: string;
  }> {
    const { connectedAccountId } = params;

    console.log("[Composio Callback] Handling callback:", {
      connectedAccountId,
    });

    try {
      // Query the composio_states table using connectedAccountId
      // Note: connection_request_id and connected_account_id are the same in Composio
      const [matchingState] = await this.db
        .select()
        .from(composioStates)
        .where(eq(composioStates.connection_request_id, connectedAccountId))
        .limit(1);

      if (!matchingState) {
        throw new Error("Composio state not found or expired");
      }

      console.log("[Composio Callback] State found:", {
        userId: matchingState.user_id,
        organisationId: matchingState.organisation_id,
        mcpStoreId: matchingState.mcp_store_id,
      });

      // Check if state is expired
      if (new Date() > matchingState.expires_at) {
        console.error("[Composio Callback] State expired");
        await this.db
          .delete(composioStates)
          .where(eq(composioStates.id, matchingState.id));
        return {
          success: false,
          error: "State expired",
          redirectUri: `${process.env.WEB_URL}/integrations?status=error&message=${encodeURIComponent("State expired")}`,
        };
      }

      // Extract user and org IDs from the state
      const userId = matchingState.user_id;
      const organisationId = matchingState.organisation_id;
      const mcpStoreId = matchingState.mcp_store_id;

      // Fetch the MCP from store
      const [store] = await this.db
        .select()
        .from(mcpStore)
        .where(eq(mcpStore.id, mcpStoreId))
        .limit(1);

      if (!store) {
        throw new Error("MCP not found in store");
      }

      // Fetch Composio integration details
      const [composioDetails] = await this.db
        .select()
        .from(mcpComposioIntegrationDetails)
        .where(eq(mcpComposioIntegrationDetails.mcp_store_id, mcpStoreId))
        .limit(1);

      if (!composioDetails) {
        throw new Error("Composio integration details not found for this MCP");
      }

      // Generate unique user identifier for Composio (same format as initiate)
      const composioUserId = `user-${userId}-org-${organisationId}`;

      console.log("[Composio Callback] Generating MCP server instance...");

      // Generate the MCP server instance for this user
      const instance = await this.composio.mcp.generate(
        composioUserId,
        composioDetails.mcp_config_id
      );

      console.log("[Composio Callback] MCP server instance generated:", {
        url: instance.url,
      });

      // Create the MCP record
      const newMcpId = randomUUID();
      await this.db.insert(mcps).values({
        id: newMcpId,
        organisation_id: organisationId,
        author_id: userId,
        name: store.name,
        mcp_store_id: mcpStoreId,
        integration_type: "composio",
        custom_mcp_server_url: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      console.log("[Composio Callback] MCP created successfully:", newMcpId);

      // Create the Composio connection record with the generated URL
      await this.db.insert(mcpComposioConnections).values({
        id: randomUUID(),
        mcp_id: newMcpId,
        connection_url: instance.url,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Delete used state
      await this.db
        .delete(composioStates)
        .where(eq(composioStates.id, matchingState.id));

      console.log(
        "[Composio Callback] Composio connection created successfully"
      );

      return {
        success: true,
        mcpId: newMcpId,
        redirectUri: `august://`,
      };
    } catch (error) {
      console.error("[Composio Callback] Error during Composio callback:", {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        redirectUri: `${process.env.WEB_URL}/integrations?status=error&message=${encodeURIComponent(error instanceof Error ? error.message : "Unknown error")}`,
      };
    }
  }

  /**
   * Gets the connection URL for a Composio MCP
   * This is used internally by the proxy to determine where to forward requests
   * Note: Caller should verify MCP ownership before calling this method
   */
  async getConnectionUrl(params: { mcpId: string }): Promise<string | null> {
    const { mcpId } = params;

    const [connection] = await this.db
      .select()
      .from(mcpComposioConnections)
      .where(eq(mcpComposioConnections.mcp_id, mcpId))
      .limit(1);

    if (!connection) {
      return null;
    }

    return connection.connection_url;
  }
}
