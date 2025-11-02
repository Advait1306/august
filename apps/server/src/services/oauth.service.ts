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
   * Initiates OAuth flow by creating state and generating authorization URL
   * Handles registration automatically if needed
   */
  async initiateOAuthFlow(params: {
    mcpId: string;
    mcpServerUrl: string;
    userId: string;
    organisationId: string;
    redirectUri?: string;
  }): Promise<{ authorizationUrl: string }> {
    const { mcpId, mcpServerUrl, userId, organisationId, redirectUri } = params;

    // Fetch the MCP configuration with store info
    const [mcp] = await this.db
      .select({
        mcp: mcps,
        store: mcpStore,
      })
      .from(mcps)
      .leftJoin(mcpStore, eq(mcps.mcp_store_id, mcpStore.id))
      .where(
        and(
          eq(mcps.id, mcpId),
          eq(mcps.author_id, userId),
          eq(mcps.organisation_id, organisationId)
        )
      )
      .limit(1);

    if (!mcp || !mcp.mcp) {
      throw new Error("MCP not found or access denied");
    }

    const mcpData = mcp.mcp;

    // If OAuth client is not registered, register it first
    if (!mcpData.oauth_client_id || !mcpData.oauth_metadata) {
      console.log("[OAuth Flow] MCP not registered, starting registration:", {
        mcpId,
        mcpServerUrl,
      });

      const registrationSuccess = await this.registerOAuthClient({
        mcpId,
        mcpServerUrl,
      });

      if (!registrationSuccess) {
        console.error("[OAuth Flow] Registration failed");
        throw new Error("Failed to register OAuth client with MCP server");
      }

      console.log(
        "[OAuth Flow] Registration successful, fetching updated MCP data"
      );

      // Fetch the MCP again to get updated OAuth credentials
      const [updatedMcp] = await this.db
        .select({
          mcp: mcps,
          store: mcpStore,
        })
        .from(mcps)
        .leftJoin(mcpStore, eq(mcps.mcp_store_id, mcpStore.id))
        .where(eq(mcps.id, mcpId))
        .limit(1);

      if (
        !updatedMcp ||
        !updatedMcp.mcp ||
        !updatedMcp.mcp.oauth_client_id ||
        !updatedMcp.mcp.oauth_metadata
      ) {
        console.error("[OAuth Flow] Failed to retrieve updated MCP data:", {
          hasUpdatedMcp: !!updatedMcp,
          hasMcp: !!updatedMcp?.mcp,
          hasClientId: !!updatedMcp?.mcp?.oauth_client_id,
          hasMetadata: !!updatedMcp?.mcp?.oauth_metadata,
        });
        throw new Error(
          "Failed to retrieve OAuth credentials after registration"
        );
      }

      console.log("[OAuth Flow] Updated MCP data retrieved successfully");

      // Update local references
      mcp.mcp = updatedMcp.mcp;
      mcp.store = updatedMcp.store;
    } else {
      console.log(
        "[OAuth Flow] MCP already registered, proceeding with authorization"
      );
    }

    // At this point, OAuth credentials are guaranteed to exist
    const finalMcpData = mcp.mcp;
    if (!finalMcpData.oauth_client_id || !finalMcpData.oauth_metadata) {
      throw new Error("OAuth credentials are missing after registration");
    }

    // Generate state and PKCE
    const state = generateState();
    const { codeVerifier, codeChallenge } = generatePKCE();

    // Build authorization URL
    const metadata = finalMcpData.oauth_metadata as {
      authorization_endpoint: string;
      scope?: string;
    };

    // Use callback URL from request or default to server callback endpoint
    const callbackUri =
      redirectUri || `http://localhost:8080/api/oauth/callback/${mcpId}`;

    // Store state in database (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.db.insert(oauthStates).values({
      id: crypto.randomUUID(),
      state,
      user_id: userId,
      organisation_id: organisationId,
      mcp_id: mcpId,
      redirect_uri: callbackUri,
      code_verifier: codeVerifier,
      created_at: new Date(),
      expires_at: expiresAt,
    });

    // Build authorization URL with all required OAuth parameters
    const authUrl = new URL(metadata.authorization_endpoint);
    authUrl.searchParams.set("client_id", finalMcpData.oauth_client_id);
    authUrl.searchParams.set("redirect_uri", callbackUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    // Add scopes - use from metadata, or default scopes from MCP store
    const scopes = metadata.scope || mcp.store?.default_scopes;
    if (scopes) {
      authUrl.searchParams.set("scope", scopes);
    }

    const finalAuthUrl = authUrl.toString();
    console.log("[OAuth Flow] Authorization URL generated:", finalAuthUrl);

    return {
      authorizationUrl: finalAuthUrl,
    };
  }

  /**
   * Handles OAuth callback by exchanging code for tokens
   */
  async handleOAuthCallback(params: {
    mcpId: string;
    code: string;
    state: string;
  }): Promise<{ success: boolean; redirectUri?: string; error?: string }> {
    const { mcpId, code, state } = params;

    console.log("[OAuth Callback] Received callback:", {
      mcpId,
      code: code.substring(0, 10) + "...",
      state: state.substring(0, 10) + "...",
    });

    // Validate state
    const [stateRecord] = await this.db
      .select()
      .from(oauthStates)
      .where(and(eq(oauthStates.mcp_id, mcpId), eq(oauthStates.state, state)))
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

    // Fetch MCP configuration
    const [mcp] = await this.db
      .select()
      .from(mcps)
      .where(eq(mcps.id, mcpId))
      .limit(1);

    if (!mcp) {
      console.error("[OAuth Callback] MCP not found");
      return { success: false, error: "MCP not found" };
    }

    if (!mcp.oauth_client_id || !mcp.oauth_metadata) {
      console.error("[OAuth Callback] OAuth not configured for this MCP");
      return { success: false, error: "OAuth not configured for this MCP" };
    }

    console.log("[OAuth Callback] MCP found, starting token exchange");

    try {
      // Exchange authorization code for access token
      const metadata = mcp.oauth_metadata as { token_endpoint: string };
      const decryptedSecret = mcp.oauth_client_secret
        ? decrypt(mcp.oauth_client_secret)
        : null;

      const tokenParams: Record<string, string> = {
        grant_type: "authorization_code",
        code,
        client_id: mcp.oauth_client_id,
        code_verifier: stateRecord.code_verifier || "",
        redirect_uri:
          stateRecord.redirect_uri ||
          `http://localhost:8080/api/oauth/callback/${mcpId}`,
      };

      // Only add client_secret if it exists (public clients don't have secrets)
      if (decryptedSecret) {
        tokenParams.client_secret = decryptedSecret;
      }

      console.log("[OAuth Callback] Token exchange request:", {
        endpoint: metadata.token_endpoint,
        client_id: mcp.oauth_client_id,
        grant_type: "authorization_code",
        has_code_verifier: !!stateRecord.code_verifier,
        redirect_uri: tokenParams.redirect_uri,
      });

      const tokenResponse = await fetch(metadata.token_endpoint, {
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

      // Check if connection already exists
      const [existingConnection] = await this.db
        .select()
        .from(oauthConnections)
        .where(
          and(
            eq(oauthConnections.mcp_id, mcpId),
            eq(oauthConnections.user_id, stateRecord.user_id),
            eq(oauthConnections.organisation_id, stateRecord.organisation_id)
          )
        )
        .limit(1);

      if (existingConnection) {
        console.log("[OAuth Callback] Updating existing connection");
        // Update existing connection
        await this.db
          .update(oauthConnections)
          .set({
            access_token: encrypt(tokenData.access_token),
            refresh_token: tokenData.refresh_token
              ? encrypt(tokenData.refresh_token)
              : null,
            token_type: tokenData.token_type,
            expires_at: expiresAt,
            scope: tokenData.scope || null,
            provider_metadata: tokenData,
            updated_at: new Date(),
          })
          .where(eq(oauthConnections.id, existingConnection.id));
      } else {
        console.log("[OAuth Callback] Creating new connection");
        // Create new connection
        await this.db.insert(oauthConnections).values({
          id: crypto.randomUUID(),
          user_id: stateRecord.user_id,
          organisation_id: stateRecord.organisation_id,
          mcp_id: mcpId,
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
      }

      // Delete used state
      await this.db
        .delete(oauthStates)
        .where(eq(oauthStates.id, stateRecord.id));

      console.log("[OAuth Callback] OAuth connection saved successfully");

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

    // TODO: Check if token is expired and refresh if needed

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
          redirect_uris: [`http://localhost:8080/api/oauth/callback/${mcpId}`],
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
