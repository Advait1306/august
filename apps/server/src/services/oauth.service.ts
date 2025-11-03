import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  mcps,
  mcpStore,
  oauthStates,
  oauthConnections,
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
  constructor(private db: NodePgDatabase) {}

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

    console.log(
      "[OAuth Discovery] Response status:",
      discoveryResponse.status
    );

    if (!discoveryResponse.ok) {
      const errorText = await discoveryResponse.text();
      console.error("[OAuth Discovery] Failed:", {
        status: discoveryResponse.status,
        statusText: discoveryResponse.statusText,
        body: errorText,
      });
      throw new Error(`OAuth discovery failed: ${discoveryResponse.statusText}`);
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
   * Accepts either a template MCP or custom MCP details
   * MCP will be created later during the callback
   */
  async initiateOAuthFlow(params: {
    mcpStoreId?: string;
    customMcpUrl?: string;
    customMcpName?: string;
    userId: string;
    organisationId: string;
    redirectUri?: string;
  }): Promise<{ authorizationUrl: string }> {
    const { mcpStoreId, customMcpUrl, customMcpName, userId, organisationId, redirectUri } = params;

    console.log("[OAuth Flow] Starting OAuth flow:", {
      hasTemplateMcp: !!mcpStoreId,
      hasCustomMcp: !!(customMcpUrl && customMcpName),
      userId,
      organisationId,
    });

    // Determine MCP server URL and name
    let mcpServerUrl: string;
    let mcpName: string;
    let defaultScopes: string | null = null;

    if (mcpStoreId) {
      // Template MCP - fetch from store
      console.log("[OAuth Flow] Fetching template MCP from store:", mcpStoreId);
      const [store] = await this.db
        .select()
        .from(mcpStore)
        .where(eq(mcpStore.id, mcpStoreId))
        .limit(1);

      if (!store) {
        throw new Error("Template MCP not found in store");
      }

      mcpServerUrl = store.mcp_server_url;
      mcpName = store.name;
      defaultScopes = store.default_scopes;

      console.log("[OAuth Flow] Template MCP found:", {
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
      throw new Error("Must provide either mcpStoreId or custom MCP details");
    }

    // Discover OAuth metadata from MCP server
    console.log("[OAuth Flow] Discovering OAuth metadata");
    const metadata = await this.discoverOAuthMetadata(mcpServerUrl);

    // Generate state and PKCE
    const state = generateState();
    const { codeVerifier, codeChallenge } = generatePKCE();

    // Use callback URL from request or default to server callback endpoint
    const callbackUri = redirectUri || "http://localhost:8080/api/oauth/callback";

    // Perform OAuth client registration to get client_id
    // We need this before generating the authorization URL
    console.log("[OAuth Flow] Registering OAuth client");

    if (!metadata.registration_endpoint) {
      throw new Error("OAuth provider does not support dynamic client registration");
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
      throw new Error(`OAuth client registration failed: ${registrationResponse.statusText}`);
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
        redirect_uri: stateRecord.redirect_uri || "http://localhost:8080/api/oauth/callback",
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
      let mcpServerUrl: string;
      let mcpName: string;

      if (stateRecord.mcp_store_id) {
        // Template MCP - fetch from store
        console.log("[OAuth Callback] Fetching template MCP details from store");
        const [store] = await this.db
          .select()
          .from(mcpStore)
          .where(eq(mcpStore.id, stateRecord.mcp_store_id))
          .limit(1);

        if (!store) {
          throw new Error("Template MCP not found in store");
        }

        mcpServerUrl = store.mcp_server_url;
        mcpName = store.name;
      } else if (stateRecord.custom_mcp_url && stateRecord.custom_mcp_name) {
        // Custom MCP
        mcpServerUrl = stateRecord.custom_mcp_url;
        mcpName = stateRecord.custom_mcp_name;
      } else {
        throw new Error("Invalid state: missing MCP information");
      }

      console.log("[OAuth Callback] Creating MCP:", {
        name: mcpName,
        url: mcpServerUrl,
      });

      // Create the MCP record
      const newMcpId = crypto.randomUUID();
      await this.db.insert(mcps).values({
        id: newMcpId,
        organisation_id: stateRecord.organisation_id,
        author_id: stateRecord.user_id,
        mcp_store_id: stateRecord.mcp_store_id || null,
        name: mcpName,
        custom_mcp_url: stateRecord.mcp_store_id ? null : mcpServerUrl,
        custom_description: null,
        mcp_server_url: mcpServerUrl,
        oauth_client_id: storedMetadata.client_id,
        oauth_client_secret: storedMetadata.client_secret ? encrypt(storedMetadata.client_secret) : null,
        oauth_metadata: storedMetadata,
        created_at: new Date(),
        updated_at: new Date(),
      });

      console.log("[OAuth Callback] MCP created successfully:", newMcpId);

      // STEP 3: Create OAuth connection
      console.log("[OAuth Callback] Creating OAuth connection");
      await this.db.insert(oauthConnections).values({
        id: crypto.randomUUID(),
        user_id: stateRecord.user_id,
        organisation_id: stateRecord.organisation_id,
        mcp_id: newMcpId,
        access_token: encrypt(tokenData.access_token),
        refresh_token: tokenData.refresh_token
          ? encrypt(tokenData.refresh_token)
          : null,
        token_type: tokenData.token_type,
        expires_at: expiresAt,
        scope: tokenData.scope || null,
        provider_user_id: null,
        provider_metadata: tokenData,
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
   */
  async getAccessToken(params: {
    mcpId: string;
    userId: string;
    organisationId: string;
  }): Promise<string | null> {
    const { mcpId, userId, organisationId } = params;

    const [connection] = await this.db
      .select()
      .from(oauthConnections)
      .where(
        and(
          eq(oauthConnections.mcp_id, mcpId),
          eq(oauthConnections.user_id, userId),
          eq(oauthConnections.organisation_id, organisationId)
        )
      )
      .limit(1);

    if (!connection) {
      return null;
    }

    // Check if token is expired and refresh if needed
    if (connection.expires_at && new Date() >= connection.expires_at) {
      console.log("[OAuth] Token expired, attempting refresh");
      const refreshSuccess = await this.refreshToken({
        mcpId,
        userId,
        organisationId,
      });

      if (!refreshSuccess) {
        console.error("[OAuth] Token refresh failed");
        return null;
      }

      // Fetch the updated connection after refresh
      const [refreshedConnection] = await this.db
        .select()
        .from(oauthConnections)
        .where(
          and(
            eq(oauthConnections.mcp_id, mcpId),
            eq(oauthConnections.user_id, userId),
            eq(oauthConnections.organisation_id, organisationId)
          )
        )
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
  async refreshToken(params: {
    mcpId: string;
    userId: string;
    organisationId: string;
  }): Promise<boolean> {
    const { mcpId, userId, organisationId } = params;

    const [connection] = await this.db
      .select()
      .from(oauthConnections)
      .where(
        and(
          eq(oauthConnections.mcp_id, mcpId),
          eq(oauthConnections.user_id, userId),
          eq(oauthConnections.organisation_id, organisationId)
        )
      )
      .limit(1);

    if (!connection || !connection.refresh_token) {
      return false;
    }

    const [mcp] = await this.db
      .select()
      .from(mcps)
      .where(eq(mcps.id, mcpId))
      .limit(1);

    if (!mcp || !mcp.oauth_client_id || !mcp.oauth_metadata) {
      return false;
    }

    try {
      const metadata = mcp.oauth_metadata as { token_endpoint: string };
      const decryptedSecret = mcp.oauth_client_secret
        ? decrypt(mcp.oauth_client_secret)
        : null;
      const decryptedRefreshToken = decrypt(connection.refresh_token);

      const tokenParams: Record<string, string> = {
        grant_type: "refresh_token",
        refresh_token: decryptedRefreshToken,
        client_id: mcp.oauth_client_id,
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
        .update(oauthConnections)
        .set({
          access_token: encrypt(tokenData.access_token),
          refresh_token: tokenData.refresh_token
            ? encrypt(tokenData.refresh_token)
            : connection.refresh_token,
          expires_at: expiresAt,
          updated_at: new Date(),
        })
        .where(eq(oauthConnections.id, connection.id));

      return true;
    } catch (error) {
      console.error("Error refreshing token:", error);
      return false;
    }
  }

  /**
   * Performs MCP dynamic client registration
   * This should be called when a user creates a new MCP instance
   */
  async registerOAuthClient(params: {
    mcpId: string;
    mcpServerUrl: string;
  }): Promise<boolean> {
    const { mcpId, mcpServerUrl } = params;

    console.log("[OAuth Registration] Starting registration for MCP:", {
      mcpId,
      mcpServerUrl,
    });

    try {
      // Step 1: Discover OAuth metadata from MCP server
      const discoveryUrl = new URL(
        "/.well-known/oauth-authorization-server",
        mcpServerUrl
      );
      console.log(
        "[OAuth Registration] Discovery URL:",
        discoveryUrl.toString()
      );

      const discoveryResponse = await fetch(discoveryUrl.toString());
      console.log(
        "[OAuth Registration] Discovery response status:",
        discoveryResponse.status
      );

      if (!discoveryResponse.ok) {
        const errorText = await discoveryResponse.text();
        console.error("[OAuth Registration] OAuth discovery failed:", {
          status: discoveryResponse.status,
          statusText: discoveryResponse.statusText,
          body: errorText,
        });
        return false;
      }

      const metadata = (await discoveryResponse.json()) as {
        authorization_endpoint: string;
        token_endpoint: string;
        registration_endpoint?: string;
        [key: string]: unknown;
      };
      console.log("[OAuth Registration] Metadata received:", metadata);

      // Step 2: Register client dynamically (if registration endpoint is available)
      let clientId: string;
      let clientSecret: string;

      if (metadata.registration_endpoint) {
        console.log(
          "[OAuth Registration] Registration endpoint found:",
          metadata.registration_endpoint
        );

        const registrationPayload = {
          client_name: "August",
          redirect_uris: ["http://localhost:8080/api/oauth/callback"],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none", // Public client (no client secret)
          application_type: "native",
        };
        console.log(
          "[OAuth Registration] Registration payload:",
          registrationPayload
        );

        const registrationResponse = await fetch(
          metadata.registration_endpoint,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(registrationPayload),
          }
        );

        console.log(
          "[OAuth Registration] Registration response status:",
          registrationResponse.status
        );

        if (!registrationResponse.ok) {
          const errorText = await registrationResponse.text();
          console.error("[OAuth Registration] Client registration failed:", {
            status: registrationResponse.status,
            statusText: registrationResponse.statusText,
            body: errorText,
          });
          return false;
        }

        const registrationData = (await registrationResponse.json()) as {
          client_id: string;
          client_secret?: string;
        };
        console.log("[OAuth Registration] Registration successful:", {
          client_id: registrationData.client_id,
          has_client_secret: !!registrationData.client_secret,
        });

        clientId = registrationData.client_id;
        clientSecret = registrationData.client_secret || ""; // May not have a secret for public clients
      } else {
        // If no registration endpoint, the MCP provider should have given us credentials
        console.error(
          "[OAuth Registration] No registration endpoint available in metadata"
        );
        return false;
      }

      // Step 3: Update MCP record with OAuth credentials
      console.log(
        "[OAuth Registration] Updating MCP record with OAuth credentials"
      );
      await this.db
        .update(mcps)
        .set({
          oauth_client_id: clientId,
          oauth_client_secret: clientSecret ? encrypt(clientSecret) : null,
          oauth_metadata: metadata,
          updated_at: new Date(),
        })
        .where(eq(mcps.id, mcpId));

      console.log("[OAuth Registration] Registration completed successfully");
      return true;
    } catch (error) {
      console.error(
        "[OAuth Registration] Error during OAuth client registration:",
        {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
        }
      );
      return false;
    }
  }
}
