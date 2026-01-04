import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OAuthService } from "../../../services/oauth.service.js";

// Mock the encryption utilities
vi.mock("../../../utils/encryption", () => ({
  encrypt: vi.fn((text: string) => `encrypted:${text}`),
  decrypt: vi.fn((text: string) => text.replace("encrypted:", "")),
}));

import { encrypt, decrypt } from "../../../utils/encryption";

// Mock database helper functions
function createMockDb() {
  const insertValues = vi.fn();
  const selectFrom = vi.fn();
  const selectWhere = vi.fn();
  const selectLimit = vi.fn();
  const updateSet = vi.fn();
  const updateWhere = vi.fn();
  const deleteWhere = vi.fn();

  return {
    insert: vi.fn().mockReturnValue({
      values: insertValues.mockResolvedValue(undefined),
    }),
    select: vi.fn().mockReturnValue({
      from: selectFrom.mockReturnValue({
        where: selectWhere.mockReturnValue({
          limit: selectLimit.mockResolvedValue([]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: updateSet.mockReturnValue({
        where: updateWhere.mockResolvedValue(undefined),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: deleteWhere.mockResolvedValue(undefined),
    }),
    // Expose internal mocks for assertions
    _mocks: {
      insertValues,
      selectFrom,
      selectWhere,
      selectLimit,
      updateSet,
      updateWhere,
      deleteWhere,
    },
  };
}

// Create type-safe mock database
type MockDb = ReturnType<typeof createMockDb>;

describe("OAuthService", () => {
  let service: OAuthService;
  let mockDb: MockDb;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new OAuthService(mockDb as any);
    vi.clearAllMocks();
    // Reset console spies
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("initiateOAuthFlow", () => {
    const mockStoreRecord = {
      id: "store-123",
      name: "Test MCP",
      integration_type: "oauth",
    };

    const mockOAuthDetails = {
      mcp_store_id: "store-123",
      mcp_server_url: "https://mcp.example.com",
      default_scopes: "read write",
    };

    const mockOAuthMetadata = {
      authorization_endpoint: "https://mcp.example.com/oauth/authorize",
      token_endpoint: "https://mcp.example.com/oauth/token",
      registration_endpoint: "https://mcp.example.com/oauth/register",
    };

    const mockRegistrationResponse = {
      client_id: "client-abc",
      client_secret: "secret-xyz",
    };

    beforeEach(() => {
      // Setup fetch mock for OAuth discovery and registration
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/.well-known/oauth-authorization-server")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOAuthMetadata),
          });
        }
        if (url.includes("/oauth/register")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockRegistrationResponse),
          });
        }
        return Promise.reject(new Error("Unexpected URL"));
      });
    });

    it("successfully initiates OAuth flow for store MCP", async () => {
      // Mock database responses for store MCP
      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockStoreRecord]) // mcpStore query
        .mockResolvedValueOnce([mockOAuthDetails]); // oauthIntegrationDetails query

      const result = await service.initiateOAuthFlow({
        mcpStoreId: "store-123",
        userId: "user-1",
        organisationId: "org-1",
      });

      expect(result.authorizationUrl).toContain(
        mockOAuthMetadata.authorization_endpoint
      );
      expect(result.authorizationUrl).toContain("client_id=client-abc");
      expect(result.authorizationUrl).toContain("response_type=code");
      expect(result.authorizationUrl).toContain("code_challenge=");
      expect(result.authorizationUrl).toContain("code_challenge_method=S256");
      expect(result.authorizationUrl).toContain("scope=read+write");
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("successfully initiates OAuth flow for custom MCP", async () => {
      const result = await service.initiateOAuthFlow({
        customMcpUrl: "https://custom-mcp.example.com",
        customMcpName: "Custom MCP",
        userId: "user-1",
        organisationId: "org-1",
      });

      expect(result.authorizationUrl).toContain(
        mockOAuthMetadata.authorization_endpoint
      );
      expect(result.authorizationUrl).toContain("client_id=client-abc");
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("throws error when neither mcpStoreId nor custom MCP details provided", async () => {
      await expect(
        service.initiateOAuthFlow({
          userId: "user-1",
          organisationId: "org-1",
        })
      ).rejects.toThrow(
        "Must provide either mcpStoreId OR both customMcpUrl and customMcpName"
      );
    });

    it("throws error when MCP not found in store", async () => {
      mockDb._mocks.selectLimit.mockResolvedValueOnce([]); // Empty result

      await expect(
        service.initiateOAuthFlow({
          mcpStoreId: "nonexistent-store",
          userId: "user-1",
          organisationId: "org-1",
        })
      ).rejects.toThrow("MCP not found in store");
    });

    it("throws error when MCP is not configured for OAuth", async () => {
      mockDb._mocks.selectLimit.mockResolvedValueOnce([
        { ...mockStoreRecord, integration_type: "api_key" },
      ]);

      await expect(
        service.initiateOAuthFlow({
          mcpStoreId: "store-123",
          userId: "user-1",
          organisationId: "org-1",
        })
      ).rejects.toThrow("MCP is not configured for OAuth integration");
    });

    it("throws error when OAuth integration details not found", async () => {
      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockStoreRecord])
        .mockResolvedValueOnce([]); // No OAuth details

      await expect(
        service.initiateOAuthFlow({
          mcpStoreId: "store-123",
          userId: "user-1",
          organisationId: "org-1",
        })
      ).rejects.toThrow("OAuth integration details not found for this MCP");
    });

    it("throws error when OAuth discovery fails", async () => {
      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockStoreRecord])
        .mockResolvedValueOnce([mockOAuthDetails]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve("Discovery endpoint not found"),
      });

      await expect(
        service.initiateOAuthFlow({
          mcpStoreId: "store-123",
          userId: "user-1",
          organisationId: "org-1",
        })
      ).rejects.toThrow("OAuth discovery failed: Not Found");
    });

    it("throws error when provider does not support dynamic client registration", async () => {
      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockStoreRecord])
        .mockResolvedValueOnce([mockOAuthDetails]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            authorization_endpoint: "https://mcp.example.com/oauth/authorize",
            token_endpoint: "https://mcp.example.com/oauth/token",
            // No registration_endpoint
          }),
      });

      await expect(
        service.initiateOAuthFlow({
          mcpStoreId: "store-123",
          userId: "user-1",
          organisationId: "org-1",
        })
      ).rejects.toThrow(
        "OAuth provider does not support dynamic client registration"
      );
    });

    it("throws error when client registration fails", async () => {
      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockStoreRecord])
        .mockResolvedValueOnce([mockOAuthDetails]);

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/.well-known/oauth-authorization-server")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOAuthMetadata),
          });
        }
        if (url.includes("/oauth/register")) {
          return Promise.resolve({
            ok: false,
            status: 400,
            statusText: "Bad Request",
            text: () => Promise.resolve("Invalid registration request"),
          });
        }
        return Promise.reject(new Error("Unexpected URL"));
      });

      await expect(
        service.initiateOAuthFlow({
          mcpStoreId: "store-123",
          userId: "user-1",
          organisationId: "org-1",
        })
      ).rejects.toThrow("OAuth client registration failed: Bad Request");
    });

    it("stores OAuth state with correct expiration (10 minutes)", async () => {
      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockStoreRecord])
        .mockResolvedValueOnce([mockOAuthDetails]);

      const beforeTime = Date.now();
      await service.initiateOAuthFlow({
        mcpStoreId: "store-123",
        userId: "user-1",
        organisationId: "org-1",
      });
      const afterTime = Date.now();

      expect(mockDb.insert).toHaveBeenCalled();
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];

      // Verify state expiration is approximately 10 minutes from now
      const expiresAt = insertCall.expires_at.getTime();
      const expectedExpiry = 10 * 60 * 1000; // 10 minutes
      expect(expiresAt).toBeGreaterThanOrEqual(beforeTime + expectedExpiry - 1000);
      expect(expiresAt).toBeLessThanOrEqual(afterTime + expectedExpiry + 1000);
    });
  });

  describe("handleOAuthCallback", () => {
    const mockStateRecord = {
      id: "state-id-123",
      state: "valid-state-token",
      user_id: "user-1",
      organisation_id: "org-1",
      mcp_store_id: "store-123",
      custom_mcp_url: null,
      custom_mcp_name: null,
      oauth_metadata: {
        authorization_endpoint: "https://mcp.example.com/oauth/authorize",
        token_endpoint: "https://mcp.example.com/oauth/token",
        client_id: "client-abc",
        client_secret: "secret-xyz",
      },
      redirect_uri: "http://localhost:8080/api/mcp/callback",
      code_verifier: "code-verifier-123",
      expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
    };

    const mockStoreRecord = {
      id: "store-123",
      name: "Test MCP",
    };

    const mockTokenResponse = {
      access_token: "access-token-xyz",
      refresh_token: "refresh-token-abc",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "read write",
    };

    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      });
    });

    it("successfully handles OAuth callback and creates MCP connection", async () => {
      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockStateRecord]) // oauthStates query
        .mockResolvedValueOnce([mockStoreRecord]); // mcpStore query

      const result = await service.handleOAuthCallback({
        code: "auth-code-123",
        state: "valid-state-token",
      });

      expect(result.success).toBe(true);
      expect(result.redirectUri).toBe("august://");
      expect(mockDb.insert).toHaveBeenCalledTimes(2); // MCP and OAuth connection
      expect(mockDb.delete).toHaveBeenCalled(); // Delete used state
    });

    it("successfully handles OAuth callback for custom MCP", async () => {
      const customStateRecord = {
        ...mockStateRecord,
        mcp_store_id: null,
        custom_mcp_url: "https://custom-mcp.example.com",
        custom_mcp_name: "Custom MCP",
      };

      mockDb._mocks.selectLimit.mockResolvedValueOnce([customStateRecord]);

      const result = await service.handleOAuthCallback({
        code: "auth-code-123",
        state: "valid-state-token",
      });

      expect(result.success).toBe(true);
      expect(result.redirectUri).toBe("august://");
    });

    it("returns error for invalid state parameter", async () => {
      mockDb._mocks.selectLimit.mockResolvedValueOnce([]);

      const result = await service.handleOAuthCallback({
        code: "auth-code-123",
        state: "invalid-state",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid state parameter");
    });

    it("returns error for expired state", async () => {
      const expiredStateRecord = {
        ...mockStateRecord,
        expires_at: new Date(Date.now() - 1000), // Already expired
      };

      mockDb._mocks.selectLimit.mockResolvedValueOnce([expiredStateRecord]);

      const result = await service.handleOAuthCallback({
        code: "auth-code-123",
        state: "valid-state-token",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("State expired");
      expect(mockDb.delete).toHaveBeenCalled(); // Expired state should be deleted
    });

    it("returns error when token exchange fails", async () => {
      mockDb._mocks.selectLimit.mockResolvedValueOnce([mockStateRecord]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: () => Promise.resolve("Invalid authorization code"),
      });

      const result = await service.handleOAuthCallback({
        code: "invalid-code",
        state: "valid-state-token",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Token exchange failed: Bad Request");
    });

    it("returns error when MCP not found in store after token exchange", async () => {
      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockStateRecord])
        .mockResolvedValueOnce([]); // MCP not found

      const result = await service.handleOAuthCallback({
        code: "auth-code-123",
        state: "valid-state-token",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("MCP not found in store");
    });

    it("returns error for invalid state with missing MCP information", async () => {
      const invalidStateRecord = {
        ...mockStateRecord,
        mcp_store_id: null,
        custom_mcp_url: null,
        custom_mcp_name: null,
      };

      mockDb._mocks.selectLimit.mockResolvedValueOnce([invalidStateRecord]);

      const result = await service.handleOAuthCallback({
        code: "auth-code-123",
        state: "valid-state-token",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid state: missing MCP information");
    });

    it("encrypts tokens before storing", async () => {
      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockStateRecord])
        .mockResolvedValueOnce([mockStoreRecord]);

      await service.handleOAuthCallback({
        code: "auth-code-123",
        state: "valid-state-token",
      });

      expect(encrypt).toHaveBeenCalledWith("access-token-xyz");
      expect(encrypt).toHaveBeenCalledWith("refresh-token-abc");
      expect(encrypt).toHaveBeenCalledWith("secret-xyz"); // client_secret
    });

    it("handles token response without refresh token", async () => {
      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockStateRecord])
        .mockResolvedValueOnce([mockStoreRecord]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "access-token-xyz",
            token_type: "Bearer",
            // No refresh_token
          }),
      });

      const result = await service.handleOAuthCallback({
        code: "auth-code-123",
        state: "valid-state-token",
      });

      expect(result.success).toBe(true);
    });

    it("handles token response without expires_in", async () => {
      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockStateRecord])
        .mockResolvedValueOnce([mockStoreRecord]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "access-token-xyz",
            token_type: "Bearer",
            // No expires_in
          }),
      });

      const result = await service.handleOAuthCallback({
        code: "auth-code-123",
        state: "valid-state-token",
      });

      expect(result.success).toBe(true);
    });

    it("handles state without client_secret (public client)", async () => {
      const publicClientStateRecord = {
        ...mockStateRecord,
        oauth_metadata: {
          ...mockStateRecord.oauth_metadata,
          client_secret: undefined,
        },
      };

      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([publicClientStateRecord])
        .mockResolvedValueOnce([mockStoreRecord]);

      const result = await service.handleOAuthCallback({
        code: "auth-code-123",
        state: "valid-state-token",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("getAccessToken", () => {
    const mockConnection = {
      id: "connection-id-123",
      mcp_id: "mcp-123",
      access_token: "encrypted:access-token-xyz",
      refresh_token: "encrypted:refresh-token-abc",
      expires_at: new Date(Date.now() + 3600 * 1000), // 1 hour from now
      oauth_client_id: "client-abc",
      oauth_client_secret: "encrypted:secret-xyz",
      oauth_metadata: {
        token_endpoint: "https://mcp.example.com/oauth/token",
      },
    };

    it("returns decrypted access token when not expired", async () => {
      mockDb._mocks.selectLimit.mockResolvedValueOnce([mockConnection]);

      const token = await service.getAccessToken({ mcpId: "mcp-123" });

      expect(token).toBe("access-token-xyz");
      expect(decrypt).toHaveBeenCalledWith("encrypted:access-token-xyz");
    });

    it("returns null when connection not found", async () => {
      mockDb._mocks.selectLimit.mockResolvedValueOnce([]);

      const token = await service.getAccessToken({ mcpId: "nonexistent-mcp" });

      expect(token).toBeNull();
    });

    it("refreshes token when expired and returns new token", async () => {
      const expiredConnection = {
        ...mockConnection,
        expires_at: new Date(Date.now() - 1000), // Already expired
      };

      const refreshedConnection = {
        ...mockConnection,
        access_token: "encrypted:new-access-token",
        expires_at: new Date(Date.now() + 3600 * 1000),
      };

      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([expiredConnection]) // Initial query
        .mockResolvedValueOnce([expiredConnection]) // refreshToken query
        .mockResolvedValueOnce([refreshedConnection]); // After refresh query

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new-access-token",
            token_type: "Bearer",
            expires_in: 3600,
          }),
      });

      const token = await service.getAccessToken({ mcpId: "mcp-123" });

      expect(token).toBe("new-access-token");
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("returns null when refresh fails", async () => {
      const expiredConnection = {
        ...mockConnection,
        expires_at: new Date(Date.now() - 1000), // Already expired
      };

      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([expiredConnection]) // Initial query
        .mockResolvedValueOnce([expiredConnection]); // refreshToken query

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      });

      const token = await service.getAccessToken({ mcpId: "mcp-123" });

      expect(token).toBeNull();
    });

    it("returns null when connection not found after refresh", async () => {
      const expiredConnection = {
        ...mockConnection,
        expires_at: new Date(Date.now() - 1000), // Already expired
      };

      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([expiredConnection]) // Initial query
        .mockResolvedValueOnce([expiredConnection]) // refreshToken query
        .mockResolvedValueOnce([]); // After refresh - connection not found

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new-access-token",
            token_type: "Bearer",
            expires_in: 3600,
          }),
      });

      const token = await service.getAccessToken({ mcpId: "mcp-123" });

      expect(token).toBeNull();
    });

    it("does not refresh when expires_at is null", async () => {
      const noExpiryConnection = {
        ...mockConnection,
        expires_at: null,
      };

      mockDb._mocks.selectLimit.mockResolvedValueOnce([noExpiryConnection]);

      // Setup fetch as a spy to verify it's not called
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      const token = await service.getAccessToken({ mcpId: "mcp-123" });

      expect(token).toBe("access-token-xyz");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("refreshToken", () => {
    const mockConnection = {
      id: "connection-id-123",
      mcp_id: "mcp-123",
      access_token: "encrypted:access-token-xyz",
      refresh_token: "encrypted:refresh-token-abc",
      expires_at: new Date(Date.now() - 1000), // Expired
      oauth_client_id: "client-abc",
      oauth_client_secret: "encrypted:secret-xyz",
      oauth_metadata: {
        token_endpoint: "https://mcp.example.com/oauth/token",
      },
    };

    it("successfully refreshes token", async () => {
      mockDb._mocks.selectLimit.mockResolvedValueOnce([mockConnection]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            token_type: "Bearer",
            expires_in: 3600,
          }),
      });

      const result = await service.refreshToken({ mcpId: "mcp-123" });

      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
      expect(encrypt).toHaveBeenCalledWith("new-access-token");
      expect(encrypt).toHaveBeenCalledWith("new-refresh-token");
    });

    it("returns false when connection not found", async () => {
      mockDb._mocks.selectLimit.mockResolvedValueOnce([]);

      const result = await service.refreshToken({ mcpId: "nonexistent-mcp" });

      expect(result).toBe(false);
    });

    it("returns false when refresh_token is missing", async () => {
      const noRefreshTokenConnection = {
        ...mockConnection,
        refresh_token: null,
      };

      mockDb._mocks.selectLimit.mockResolvedValueOnce([
        noRefreshTokenConnection,
      ]);

      const result = await service.refreshToken({ mcpId: "mcp-123" });

      expect(result).toBe(false);
    });

    it("returns false when oauth_client_id is missing", async () => {
      const noClientIdConnection = {
        ...mockConnection,
        oauth_client_id: null,
      };

      mockDb._mocks.selectLimit.mockResolvedValueOnce([noClientIdConnection]);

      const result = await service.refreshToken({ mcpId: "mcp-123" });

      expect(result).toBe(false);
    });

    it("returns false when oauth_metadata is missing", async () => {
      const noMetadataConnection = {
        ...mockConnection,
        oauth_metadata: null,
      };

      mockDb._mocks.selectLimit.mockResolvedValueOnce([noMetadataConnection]);

      const result = await service.refreshToken({ mcpId: "mcp-123" });

      expect(result).toBe(false);
    });

    it("returns false when token refresh API fails", async () => {
      mockDb._mocks.selectLimit.mockResolvedValueOnce([mockConnection]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      });

      const result = await service.refreshToken({ mcpId: "mcp-123" });

      expect(result).toBe(false);
    });

    it("keeps existing refresh_token if new one not provided", async () => {
      mockDb._mocks.selectLimit.mockResolvedValueOnce([mockConnection]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new-access-token",
            token_type: "Bearer",
            expires_in: 3600,
            // No new refresh_token
          }),
      });

      const result = await service.refreshToken({ mcpId: "mcp-123" });

      expect(result).toBe(true);
      const updateCall = mockDb._mocks.updateSet.mock.calls[0][0];
      expect(updateCall.refresh_token).toBe(mockConnection.refresh_token);
    });

    it("handles refresh without client_secret (public client)", async () => {
      const publicClientConnection = {
        ...mockConnection,
        oauth_client_secret: null,
      };

      mockDb._mocks.selectLimit.mockResolvedValueOnce([publicClientConnection]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new-access-token",
            token_type: "Bearer",
            expires_in: 3600,
          }),
      });

      const result = await service.refreshToken({ mcpId: "mcp-123" });

      expect(result).toBe(true);

      // Verify client_secret was not included in the request
      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = fetchCall[1].body as URLSearchParams;
      expect(body.has("client_secret")).toBe(false);
    });

    it("returns false and logs error when fetch throws", async () => {
      mockDb._mocks.selectLimit.mockResolvedValueOnce([mockConnection]);

      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await service.refreshToken({ mcpId: "mcp-123" });

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        "Error refreshing token:",
        expect.any(Error)
      );
    });

    it("sets expires_at to null when expires_in not provided", async () => {
      mockDb._mocks.selectLimit.mockResolvedValueOnce([mockConnection]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new-access-token",
            token_type: "Bearer",
            // No expires_in
          }),
      });

      const result = await service.refreshToken({ mcpId: "mcp-123" });

      expect(result).toBe(true);
      const updateCall = mockDb._mocks.updateSet.mock.calls[0][0];
      expect(updateCall.expires_at).toBeNull();
    });
  });

  describe("revokeToken", () => {
    const mockConnection = {
      id: "connection-id-123",
      mcp_id: "mcp-123",
      access_token: "encrypted:access-token-xyz",
      refresh_token: "encrypted:refresh-token-abc",
      oauth_client_id: "client-abc",
      oauth_client_secret: "encrypted:secret-xyz",
      oauth_metadata: {
        revocation_endpoint: "https://mcp.example.com/oauth/revoke",
        token_endpoint: "https://mcp.example.com/oauth/token",
      },
    };

    it("successfully revokes token at provider and deletes connection", async () => {
      mockDb._mocks.selectLimit.mockResolvedValueOnce([mockConnection]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });

      await service.revokeToken({ mcpId: "mcp-123" });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://mcp.example.com/oauth/revoke",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        })
      );
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("deletes connection even when no connection found", async () => {
      mockDb._mocks.selectLimit.mockResolvedValueOnce([]);

      await service.revokeToken({ mcpId: "nonexistent-mcp" });

      // Should not throw, should just return early
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it("deletes connection when oauth_metadata is missing", async () => {
      const noMetadataConnection = {
        ...mockConnection,
        oauth_metadata: null,
      };

      mockDb._mocks.selectLimit.mockResolvedValueOnce([noMetadataConnection]);

      await service.revokeToken({ mcpId: "mcp-123" });

      // Should not throw, should just return early
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it("skips provider revocation when no revocation_endpoint", async () => {
      const noRevocationEndpointConnection = {
        ...mockConnection,
        oauth_metadata: {
          token_endpoint: "https://mcp.example.com/oauth/token",
          // No revocation_endpoint
        },
      };

      mockDb._mocks.selectLimit.mockResolvedValueOnce([
        noRevocationEndpointConnection,
      ]);

      // Setup fetch as a spy to verify it's not called
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      await service.revokeToken({ mcpId: "mcp-123" });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("continues with deletion when provider revocation fails", async () => {
      mockDb._mocks.selectLimit.mockResolvedValueOnce([mockConnection]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      });

      await service.revokeToken({ mcpId: "mcp-123" });

      expect(console.warn).toHaveBeenCalledWith(
        "[OAuth Revoke] Token revocation failed at provider:",
        expect.objectContaining({
          status: 400,
          statusText: "Bad Request",
        })
      );
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("includes client credentials in revocation request", async () => {
      mockDb._mocks.selectLimit.mockResolvedValueOnce([mockConnection]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });

      await service.revokeToken({ mcpId: "mcp-123" });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = fetchCall[1].body as URLSearchParams;

      expect(body.get("token")).toBe("access-token-xyz");
      expect(body.get("token_type_hint")).toBe("access_token");
      expect(body.get("client_id")).toBe("client-abc");
      expect(body.get("client_secret")).toBe("secret-xyz");
    });

    it("handles revocation without client_secret (public client)", async () => {
      const publicClientConnection = {
        ...mockConnection,
        oauth_client_secret: null,
      };

      mockDb._mocks.selectLimit.mockResolvedValueOnce([publicClientConnection]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });

      await service.revokeToken({ mcpId: "mcp-123" });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = fetchCall[1].body as URLSearchParams;

      expect(body.has("client_secret")).toBe(false);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("handles revocation without client_id", async () => {
      const noClientIdConnection = {
        ...mockConnection,
        oauth_client_id: null,
      };

      mockDb._mocks.selectLimit.mockResolvedValueOnce([noClientIdConnection]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });

      await service.revokeToken({ mcpId: "mcp-123" });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = fetchCall[1].body as URLSearchParams;

      expect(body.has("client_id")).toBe(false);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("does not throw when fetch throws (graceful error handling)", async () => {
      mockDb._mocks.selectLimit.mockResolvedValueOnce([mockConnection]);

      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      // Should not throw
      await expect(
        service.revokeToken({ mcpId: "mcp-123" })
      ).resolves.toBeUndefined();

      expect(console.error).toHaveBeenCalledWith(
        "[OAuth Revoke] Error revoking token:",
        expect.objectContaining({
          error: "Network error",
        })
      );
    });
  });
});
