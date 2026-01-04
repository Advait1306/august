import crypto from "crypto";
import { eq } from "drizzle-orm";
import { AppState } from "../config/state";
import {
  mcps,
  mcpStore,
  mcpOauthIntegrationDetails,
  mcpOauthConnections,
  oauthStates,
} from "@jupiter/sync/db/schema";
import { encrypt, decrypt } from "../utils/encryption";

/**
 * Generates a random state parameter for OAuth CSRF protection
 */
function generateState(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Generates PKCE code verifier and challenge
 */
function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return { codeVerifier, codeChallenge };
}

export class OAuthService {
  private static instance: OAuthService;
  private serverUrl: string;

  private constructor(private db: AppState["db"]) {
    this.serverUrl = process.env.SERVER_URL || "http://localhost:8080";
  }

  public static getInstance(db?: AppState["db"]): OAuthService {
    if (!OAuthService.instance) {
      if (!db) {
        throw new Error("OAuthService not initialized. Call getInstance(db) first.");
      }
      OAuthService.instance = new OAuthService(db);
    }
    return OAuthService.instance;
  }

  /**
   * Discovers OAuth metadata from MCP server
   * @private
   */
  private async discoverOAuthMetadata(mcpServerUrl: string): Promise<{
    authorization_endpoint: string;
    token_endpoint: string;
    registration_endpoint?: string;
    [key: string]: unknown;
  }> {
    const discoveryUrl = new URL(
      "/.well-known/oauth-authorization-server",
      mcpServerUrl
    );

    console.log("[OAuth Discovery] Discovery URL:", discoveryUrl.toString());

    const discoveryResponse = await fetch(discoveryUrl.toString());

    console.log("[OAuth Discovery] Response status:", discoveryResponse.status);

    if (!discoveryResponse.ok) {
      const errorText = await discoveryResponse.text();
      console.error("[OAuth Discovery] Failed:", {
        status: discoveryResponse.status,
        statusText: discoveryResponse.statusText,
        body: errorText,
      });
      throw new Error(
        `OAuth discovery failed: ${discoveryResponse.statusText}`
      );
    }

    const metadata = (await discoveryResponse.json()) as {
      authorization_endpoint: string;
      token_endpoint: string;
      registration_endpoint?: string;
      [key: string]: unknown;
    };

    console.log("[OAuth Discovery] Metadata received:", metadata);

    return metadata;
  }

  /**
   * Initiates OAuth flow by creating state and generating authorization URL
   * Accepts either a store MCP (mcpStoreId) or custom MCP (customMcpUrl + customMcpName)
   * MCP will be created later during the callback
   */
  async initiateOAuthFlow(params: {
    mcpStoreId?: string;
    customMcpUrl?: string;
    customMcpName?: string;
    userId: string;
    organisationId: string;
  }): Promise<{ authorizationUrl: string }> {
    const { mcpStoreId, customMcpUrl, customMcpName, userId, organisationId } =
      params;

    console.log("[OAuth Flow] Starting OAuth flow:", {
      hasStoreMcp: !!mcpStoreId,
      hasCustomMcp: !!(customMcpUrl && customMcpName),
      userId,
      organisationId,
    });

    let mcpServerUrl: string;
    let mcpName: string;
    let defaultScopes: string | null = null;

    if (mcpStoreId) {
      // Store MCP - fetch from store and integration details
      console.log("[OAuth Flow] Fetching MCP from store:", mcpStoreId);
      const [store] = await this.db
        .select()
        .from(mcpStore)
        .where(eq(mcpStore.id, mcpStoreId))
        .limit(1);

      if (!store) {
        throw new Error("MCP not found in store");
      }

      // Check integration type
      if (store.integration_type !== "oauth") {
        throw new Error("MCP is not configured for OAuth integration");
      }

      // Fetch OAuth integration details
      const [oauthDetails] = await this.db
        .select()
        .from(mcpOauthIntegrationDetails)
        .where(eq(mcpOauthIntegrationDetails.mcp_store_id, mcpStoreId))
        .limit(1);

      if (!oauthDetails) {
        throw new Error("OAuth integration details not found for this MCP");
      }

      mcpServerUrl = oauthDetails.mcp_server_url;
      mcpName = store.name;
      defaultScopes = oauthDetails.default_scopes;

      console.log("[OAuth Flow] Store MCP found:", {
        name: mcpName,
        url: mcpServerUrl,
      });
    } else if (customMcpUrl && customMcpName) {
      // Custom MCP
      mcpServerUrl = customMcpUrl;
      mcpName = customMcpName;

      console.log("[OAuth Flow] Using custom MCP:", {
        name: mcpName,
        url: mcpServerUrl,
      });
    } else {
      throw new Error(
        "Must provide either mcpStoreId OR both customMcpUrl and customMcpName"
      );
    }

    // Discover OAuth metadata from MCP server
    console.log("[OAuth Flow] Discovering OAuth metadata");
    const metadata = await this.discoverOAuthMetadata(mcpServerUrl);

    // Generate state and PKCE
    const state = generateState();
    const { codeVerifier, codeChallenge } = generatePKCE();

    // Generate callback URL from server URL
    const callbackUri = `${this.serverUrl}/api/mcp/callback`;

    // Perform OAuth client registration to get client_id
    // We need this before generating the authorization URL
    console.log("[OAuth Flow] Registering OAuth client");

    if (!metadata.registration_endpoint) {
      throw new Error(
        "OAuth provider does not support dynamic client registration"
      );
    }

    const registrationPayload = {
      client_name: "August",
      redirect_uris: [callbackUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      application_type: "native",
    };

    const registrationResponse = await fetch(metadata.registration_endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registrationPayload),
    });

    if (!registrationResponse.ok) {
      const errorText = await registrationResponse.text();
      console.error("[OAuth Flow] Client registration failed:", {
        status: registrationResponse.status,
        body: errorText,
      });
      throw new Error(
        `OAuth client registration failed: ${registrationResponse.statusText}`
      );
    }

    const registrationData = (await registrationResponse.json()) as {
      client_id: string;
      client_secret?: string;
      [key: string]: unknown;
    };

    console.log("[OAuth Flow] OAuth client registered successfully:", {
      client_id: registrationData.client_id,
      has_secret: !!registrationData.client_secret,
    });

    // Store state in database (expires in 10 minutes)
    // Include registration data so we can create the MCP later
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const stateData = {
      ...metadata,
      client_id: registrationData.client_id,
      client_secret: registrationData.client_secret,
      registration_data: registrationData,
    };

    console.log("[OAuth Flow] Storing OAuth state");
    await this.db.insert(oauthStates).values({
      id: crypto.randomUUID(),
      state,
      user_id: userId,
      organisation_id: organisationId,
      mcp_store_id: mcpStoreId || null,
      custom_mcp_url: customMcpUrl || null,
      custom_mcp_name: customMcpName || null,
      oauth_metadata: stateData,
      redirect_uri: callbackUri,
      code_verifier: codeVerifier,
      created_at: new Date(),
      expires_at: expiresAt,
    });

    // Build authorization URL with client_id
    const authUrl = new URL(metadata.authorization_endpoint);
    authUrl.searchParams.set("client_id", registrationData.client_id);
    authUrl.searchParams.set("redirect_uri", callbackUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    // Add scopes if available
    if (defaultScopes) {
      authUrl.searchParams.set("scope", defaultScopes);
    }

    const finalAuthUrl = authUrl.toString();
    console.log("[OAuth Flow] Authorization URL generated:", finalAuthUrl);

    return {
      authorizationUrl: finalAuthUrl,
    };
  }

  /**
   * Handles OAuth callback by exchanging code for tokens
   * Creates the MCP and OAuth connection
   */
  async handleOAuthCallback(params: {
    code: string;
    state: string;
  }): Promise<{ success: boolean; redirectUri?: string; error?: string }> {
    const { code, state } = params;

    console.log("[OAuth Callback] Received callback:", {
      code: code.substring(0, 10) + "...",
      state: state.substring(0, 10) + "...",
    });

    // Validate state (no mcpId needed!)
    const [stateRecord] = await this.db
      .select()
      .from(oauthStates)
      .where(eq(oauthStates.state, state))
      .limit(1);

    if (!stateRecord) {
      console.error("[OAuth Callback] Invalid state parameter");
      return { success: false, error: "Invalid state parameter" };
    }

    console.log("[OAuth Callback] State validated successfully");

    // Check if state is expired
    if (new Date() > stateRecord.expires_at) {
      console.error("[OAuth Callback] State expired");
      await this.db
        .delete(oauthStates)
        .where(eq(oauthStates.id, stateRecord.id));
      return { success: false, error: "State expired" };
    }

    try {
      // Extract stored OAuth metadata (includes client_id and client_secret from registration)
      const storedMetadata = stateRecord.oauth_metadata as {
        authorization_endpoint: string;
        token_endpoint: string;
        client_id: string;
        client_secret?: string;
        [key: string]: unknown;
      };

      // STEP 1: Exchange authorization code for access token FIRST
      console.log("[OAuth Callback] Starting token exchange");
      const tokenParams: Record<string, string> = {
        grant_type: "authorization_code",
        code,
        client_id: storedMetadata.client_id,
        code_verifier: stateRecord.code_verifier || "",
        redirect_uri: stateRecord.redirect_uri,
      };

      // Only add client_secret if it exists (public clients don't have secrets)
      if (storedMetadata.client_secret) {
        tokenParams.client_secret = storedMetadata.client_secret;
      }

      console.log("[OAuth Callback] Token exchange request:", {
        endpoint: storedMetadata.token_endpoint,
        client_id: storedMetadata.client_id,
        has_code_verifier: !!stateRecord.code_verifier,
        redirect_uri: tokenParams.redirect_uri,
      });

      const tokenResponse = await fetch(storedMetadata.token_endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(tokenParams),
      });

      console.log(
        "[OAuth Callback] Token exchange response status:",
        tokenResponse.status
      );

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("[OAuth Callback] Token exchange failed:", {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          body: errorText,
        });

        return {
          success: false,
          error: `Token exchange failed: ${tokenResponse.statusText}`,
        };
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token: string;
        refresh_token?: string;
        token_type: string;
        expires_in?: number;
        scope?: string;
        [key: string]: unknown;
      };

      console.log("[OAuth Callback] Token received successfully:", {
        token_type: tokenData.token_type,
        has_refresh_token: !!tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        scope: tokenData.scope,
      });

      // Calculate expiry time
      const expiresAt = tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : null;

      // STEP 2: Token exchange successful! Now determine MCP details and create it
      let mcpName: string;
      let mcpStoreId: string | null = null;
      let customMcpServerUrl: string | null = null;

      if (stateRecord.mcp_store_id) {
        // Store MCP - fetch from store
        console.log("[OAuth Callback] Fetching MCP details from store");
        const [store] = await this.db
          .select()
          .from(mcpStore)
          .where(eq(mcpStore.id, stateRecord.mcp_store_id))
          .limit(1);

        if (!store) {
          throw new Error("MCP not found in store");
        }

        mcpName = store.name;
        mcpStoreId = stateRecord.mcp_store_id;
      } else if (stateRecord.custom_mcp_url && stateRecord.custom_mcp_name) {
        // Custom MCP
        mcpName = stateRecord.custom_mcp_name;
        customMcpServerUrl = stateRecord.custom_mcp_url;
      } else {
        throw new Error("Invalid state: missing MCP information");
      }

      console.log("[OAuth Callback] Creating MCP:", {
        name: mcpName,
        isCustom: !mcpStoreId,
      });

      // Create the MCP record
      const newMcpId = crypto.randomUUID();
      await this.db.insert(mcps).values({
        id: newMcpId,
        organisation_id: stateRecord.organisation_id,
        author_id: stateRecord.user_id,
        name: mcpName,
        mcp_store_id: mcpStoreId,
        integration_type: "oauth",
        custom_mcp_server_url: customMcpServerUrl,
        created_at: new Date(),
        updated_at: new Date(),
      });

      console.log("[OAuth Callback] MCP created successfully:", newMcpId);

      // STEP 3: Create OAuth connection
      console.log("[OAuth Callback] Creating OAuth connection");
      await this.db.insert(mcpOauthConnections).values({
        id: crypto.randomUUID(),
        mcp_id: newMcpId,
        oauth_client_id: storedMetadata.client_id,
        oauth_client_secret: storedMetadata.client_secret
          ? encrypt(storedMetadata.client_secret)
          : null,
        access_token: encrypt(tokenData.access_token),
        refresh_token: tokenData.refresh_token
          ? encrypt(tokenData.refresh_token)
          : null,
        token_type: tokenData.token_type,
        expires_at: expiresAt,
        scope: tokenData.scope || null,
        provider_metadata: tokenData,
        oauth_metadata: storedMetadata,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Delete used state
      await this.db
        .delete(oauthStates)
        .where(eq(oauthStates.id, stateRecord.id));

      console.log("[OAuth Callback] OAuth flow completed successfully");

      return {
        success: true,
        redirectUri: "august://",
      };
    } catch (error) {
      console.error("[OAuth Callback] Error during OAuth callback:", {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Gets decrypted access token for an MCP connection
   * This is used internally by the server to make API calls on behalf of the user
   * Automatically refreshes the token if it's expired
   * Note: Caller should verify MCP ownership before calling this method
   */
  async getAccessToken(params: { mcpId: string }): Promise<string | null> {
    const { mcpId } = params;

    const [connection] = await this.db
      .select()
      .from(mcpOauthConnections)
      .where(eq(mcpOauthConnections.mcp_id, mcpId))
      .limit(1);

    if (!connection) {
      return null;
    }

    // Check if token is expired and refresh if needed
    if (connection.expires_at && new Date() >= connection.expires_at) {
      console.log("[OAuth] Token expired, attempting refresh");
      const refreshSuccess = await this.refreshToken({
        mcpId,
      });

      if (!refreshSuccess) {
        console.error("[OAuth] Token refresh failed");
        return null;
      }

      // Fetch the updated connection after refresh
      const [refreshedConnection] = await this.db
        .select()
        .from(mcpOauthConnections)
        .where(eq(mcpOauthConnections.mcp_id, mcpId))
        .limit(1);

      if (!refreshedConnection) {
        return null;
      }

      return decrypt(refreshedConnection.access_token);
    }

    return decrypt(connection.access_token);
  }

  /**
   * Refreshes an expired OAuth token
   */
  async refreshToken(params: { mcpId: string }): Promise<boolean> {
    const { mcpId } = params;

    const [connection] = await this.db
      .select()
      .from(mcpOauthConnections)
      .where(eq(mcpOauthConnections.mcp_id, mcpId))
      .limit(1);

    if (
      !connection ||
      !connection.refresh_token ||
      !connection.oauth_client_id ||
      !connection.oauth_metadata
    ) {
      return false;
    }

    try {
      const metadata = connection.oauth_metadata as { token_endpoint: string };
      const decryptedSecret = connection.oauth_client_secret
        ? decrypt(connection.oauth_client_secret)
        : null;
      const decryptedRefreshToken = decrypt(connection.refresh_token);

      const tokenParams: Record<string, string> = {
        grant_type: "refresh_token",
        refresh_token: decryptedRefreshToken,
        client_id: connection.oauth_client_id,
      };

      // Only add client_secret if it exists (public clients don't have secrets)
      if (decryptedSecret) {
        tokenParams.client_secret = decryptedSecret;
      }

      const tokenResponse = await fetch(metadata.token_endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(tokenParams),
      });

      if (!tokenResponse.ok) {
        return false;
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token: string;
        refresh_token?: string;
        token_type: string;
        expires_in?: number;
        scope?: string;
      };

      const expiresAt = tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : null;

      await this.db
        .update(mcpOauthConnections)
        .set({
          access_token: encrypt(tokenData.access_token),
          refresh_token: tokenData.refresh_token
            ? encrypt(tokenData.refresh_token)
            : connection.refresh_token,
          expires_at: expiresAt,
          updated_at: new Date(),
        })
        .where(eq(mcpOauthConnections.id, connection.id));

      return true;
    } catch (error) {
      console.error("Error refreshing token:", error);
      return false;
    }
  }

  /**
   * Revokes OAuth tokens for an MCP connection
   * Should be called when a user disconnects or deletes an MCP
   */
  async revokeToken(params: { mcpId: string }): Promise<void> {
    const { mcpId } = params;

    try {
      // Get the OAuth connection
      const [connection] = await this.db
        .select()
        .from(mcpOauthConnections)
        .where(eq(mcpOauthConnections.mcp_id, mcpId))
        .limit(1);

      if (!connection) {
        console.log("[OAuth Revoke] No connection found for MCP:", mcpId);
        return;
      }

      if (!connection.oauth_metadata) {
        console.log("[OAuth Revoke] No OAuth metadata found for:", mcpId);
        return;
      }

      const metadata = connection.oauth_metadata as {
        revocation_endpoint?: string;
        token_endpoint?: string;
      };

      // Try to revoke the token with the provider if revocation endpoint exists
      if (metadata.revocation_endpoint) {
        console.log("[OAuth Revoke] Attempting to revoke token at provider");

        const decryptedAccessToken = decrypt(connection.access_token);
        const decryptedSecret = connection.oauth_client_secret
          ? decrypt(connection.oauth_client_secret)
          : null;

        const revokeParams: Record<string, string> = {
          token: decryptedAccessToken,
          token_type_hint: "access_token",
        };

        if (connection.oauth_client_id) {
          revokeParams.client_id = connection.oauth_client_id;
        }

        if (decryptedSecret) {
          revokeParams.client_secret = decryptedSecret;
        }

        const revokeResponse = await fetch(metadata.revocation_endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(revokeParams),
        });

        if (!revokeResponse.ok) {
          console.warn("[OAuth Revoke] Token revocation failed at provider:", {
            status: revokeResponse.status,
            statusText: revokeResponse.statusText,
          });
          // Continue to delete the connection even if revocation fails
        } else {
          console.log("[OAuth Revoke] Token revoked successfully at provider");
        }
      } else {
        console.log(
          "[OAuth Revoke] No revocation endpoint available, skipping provider revocation"
        );
      }

      // Delete the OAuth connection from our database
      await this.db
        .delete(mcpOauthConnections)
        .where(eq(mcpOauthConnections.mcp_id, mcpId));

      console.log("[OAuth Revoke] OAuth connection deleted for MCP:", mcpId);
    } catch (error) {
      console.error("[OAuth Revoke] Error revoking token:", {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Don't throw - we want to continue with deletion even if revocation fails
    }
  }
}
