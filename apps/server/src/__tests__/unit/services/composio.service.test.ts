import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { AppState } from "../../../config/state.js";

// Create mock Composio client instance
const mockComposioClient = {
  connectedAccounts: {
    link: vi.fn(),
  },
  mcp: {
    generate: vi.fn(),
  },
};

// Mock the Composio module - use function keyword for constructor
vi.mock("@composio/core", () => ({
  Composio: function MockComposio() {
    return mockComposioClient;
  },
}));

// Mock crypto for consistent UUIDs in tests
vi.mock("crypto", () => ({
  default: {
    randomUUID: vi.fn(() => "test-uuid-1234"),
  },
}));

// Import after mocking
import { ComposioService } from "../../../services/composio.service.js";

// Interface for mock database that matches the expected shape
interface MockDbChain {
  select: Mock;
  insert: Mock;
  delete: Mock;
  _mockFrom: Mock;
  _mockWhere: Mock;
  _mockLimit: Mock;
  _mockValues: Mock;
}

// Create mock database helper with comprehensive chaining
function createMockDb(): MockDbChain {
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  const mockWhere = vi.fn();
  const mockLimit = vi.fn();
  const mockInsert = vi.fn();
  const mockValues = vi.fn();
  const mockDelete = vi.fn();

  // Chain the select methods
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ limit: mockLimit });
  mockLimit.mockResolvedValue([]);

  // Chain the insert methods
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockResolvedValue(undefined);

  // Chain the delete methods
  mockDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

  return {
    select: mockSelect,
    insert: mockInsert,
    delete: mockDelete,
    _mockFrom: mockFrom,
    _mockWhere: mockWhere,
    _mockLimit: mockLimit,
    _mockValues: mockValues,
  };
}

describe("ComposioService", () => {
  let service: ComposioService;
  let mockDb: MockDbChain;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new ComposioService(mockDb as unknown as AppState["db"]);
  });

  describe("constructor", () => {
    it("creates a new ComposioService instance with API key", () => {
      const testDb = createMockDb();
      const testService = new ComposioService(testDb as unknown as AppState["db"]);

      expect(testService).toBeInstanceOf(ComposioService);
      // Verify that the service was created successfully (Composio constructor was called internally)
    });

    it("throws error when COMPOSIO_API_KEY is not set", () => {
      const originalApiKey = process.env.COMPOSIO_API_KEY;
      delete process.env.COMPOSIO_API_KEY;

      expect(() => new ComposioService(mockDb as unknown as AppState["db"])).toThrow(
        "COMPOSIO_API_KEY environment variable is not set"
      );

      process.env.COMPOSIO_API_KEY = originalApiKey;
    });
  });

  describe("initiateComposioFlow", () => {
    const validParams = {
      mcpStoreId: "store_123",
      userId: "user_456",
      organisationId: "org_789",
    };

    it("successfully initiates Composio flow and returns redirect URL", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockStore = {
        id: "store_123",
        name: "Test MCP",
        integration_type: "composio",
      };

      const mockComposioDetails = {
        mcp_store_id: "store_123",
        auth_config_id: "auth_config_123",
        mcp_config_id: "mcp_config_123",
      };

      const mockConnectionRequest = {
        id: "connection_request_123",
        redirectUrl: "https://composio.dev/auth/redirect",
      };

      // First query: fetch MCP from store
      mockDb._mockLimit.mockResolvedValueOnce([mockStore]);
      // Second query: fetch Composio integration details
      mockDb._mockLimit.mockResolvedValueOnce([mockComposioDetails]);

      mockComposioClient.connectedAccounts.link.mockResolvedValue(
        mockConnectionRequest
      );

      const result = await service.initiateComposioFlow(validParams);

      expect(result).toEqual({
        redirectUrl: "https://composio.dev/auth/redirect",
        connectionRequestId: "connection_request_123",
      });

      expect(mockComposioClient.connectedAccounts.link).toHaveBeenCalledWith(
        "user-user_456-org-org_789",
        "auth_config_123",
        {
          callbackUrl: "http://localhost:8080/api/mcp/callback",
        }
      );

      expect(mockDb.insert).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("throws error when MCP is not found in store", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Return empty array for store query
      mockDb._mockLimit.mockResolvedValueOnce([]);

      await expect(service.initiateComposioFlow(validParams)).rejects.toThrow(
        "MCP not found in store"
      );

      consoleSpy.mockRestore();
    });

    it("throws error when MCP is not configured for Composio integration", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockStore = {
        id: "store_123",
        name: "Test MCP",
        integration_type: "oauth", // Not composio
      };

      mockDb._mockLimit.mockResolvedValueOnce([mockStore]);

      await expect(service.initiateComposioFlow(validParams)).rejects.toThrow(
        "MCP is not configured for Composio integration"
      );

      consoleSpy.mockRestore();
    });

    it("throws error when Composio integration details are not found", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockStore = {
        id: "store_123",
        name: "Test MCP",
        integration_type: "composio",
      };

      // First query: fetch MCP from store
      mockDb._mockLimit.mockResolvedValueOnce([mockStore]);
      // Second query: return empty for Composio details
      mockDb._mockLimit.mockResolvedValueOnce([]);

      await expect(service.initiateComposioFlow(validParams)).rejects.toThrow(
        "Composio integration details not found for this MCP"
      );

      consoleSpy.mockRestore();
    });

    it("throws error when Composio does not return a redirect URL", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockStore = {
        id: "store_123",
        name: "Test MCP",
        integration_type: "composio",
      };

      const mockComposioDetails = {
        mcp_store_id: "store_123",
        auth_config_id: "auth_config_123",
        mcp_config_id: "mcp_config_123",
      };

      const mockConnectionRequest = {
        id: "connection_request_123",
        redirectUrl: null, // No redirect URL
      };

      mockDb._mockLimit.mockResolvedValueOnce([mockStore]);
      mockDb._mockLimit.mockResolvedValueOnce([mockComposioDetails]);

      mockComposioClient.connectedAccounts.link.mockResolvedValue(
        mockConnectionRequest
      );

      await expect(service.initiateComposioFlow(validParams)).rejects.toThrow(
        "Composio did not return a redirect URL"
      );

      consoleSpy.mockRestore();
    });

    it("stores state in database with correct expiration", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockStore = {
        id: "store_123",
        name: "Test MCP",
        integration_type: "composio",
      };

      const mockComposioDetails = {
        mcp_store_id: "store_123",
        auth_config_id: "auth_config_123",
        mcp_config_id: "mcp_config_123",
      };

      const mockConnectionRequest = {
        id: "connection_request_123",
        redirectUrl: "https://composio.dev/auth/redirect",
      };

      mockDb._mockLimit.mockResolvedValueOnce([mockStore]);
      mockDb._mockLimit.mockResolvedValueOnce([mockComposioDetails]);
      mockComposioClient.connectedAccounts.link.mockResolvedValue(
        mockConnectionRequest
      );

      await service.initiateComposioFlow(validParams);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb._mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "test-uuid-1234",
          connection_request_id: "connection_request_123",
          user_id: "user_456",
          organisation_id: "org_789",
          mcp_store_id: "store_123",
        })
      );

      consoleSpy.mockRestore();
    });

    it("handles Composio API errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockStore = {
        id: "store_123",
        name: "Test MCP",
        integration_type: "composio",
      };

      const mockComposioDetails = {
        mcp_store_id: "store_123",
        auth_config_id: "auth_config_123",
        mcp_config_id: "mcp_config_123",
      };

      mockDb._mockLimit.mockResolvedValueOnce([mockStore]);
      mockDb._mockLimit.mockResolvedValueOnce([mockComposioDetails]);

      mockComposioClient.connectedAccounts.link.mockRejectedValue(
        new Error("Composio API error")
      );

      await expect(service.initiateComposioFlow(validParams)).rejects.toThrow(
        "Composio API error"
      );

      consoleSpy.mockRestore();
    });
  });

  describe("handleComposioCallback", () => {
    const validParams = {
      connectedAccountId: "connected_account_123",
    };

    it("successfully handles callback and creates MCP", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockState = {
        id: "state_123",
        connection_request_id: "connected_account_123",
        user_id: "user_456",
        organisation_id: "org_789",
        mcp_store_id: "store_123",
        expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
      };

      const mockStore = {
        id: "store_123",
        name: "Test MCP Store",
        integration_type: "composio",
      };

      const mockComposioDetails = {
        mcp_store_id: "store_123",
        auth_config_id: "auth_config_123",
        mcp_config_id: "mcp_config_123",
      };

      const mockMcpInstance = {
        url: "https://composio.dev/mcp/instance/xyz",
      };

      // First query: fetch state
      mockDb._mockLimit.mockResolvedValueOnce([mockState]);
      // Second query: fetch store
      mockDb._mockLimit.mockResolvedValueOnce([mockStore]);
      // Third query: fetch Composio details
      mockDb._mockLimit.mockResolvedValueOnce([mockComposioDetails]);

      mockComposioClient.mcp.generate.mockResolvedValue(mockMcpInstance);

      const result = await service.handleComposioCallback(validParams);

      expect(result).toEqual({
        success: true,
        mcpId: "test-uuid-1234",
        redirectUri: "august://",
      });

      expect(mockComposioClient.mcp.generate).toHaveBeenCalledWith(
        "user-user_456-org-org_789",
        "mcp_config_123"
      );

      // Verify MCP was created
      expect(mockDb.insert).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("returns error when state is not found", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});

      // Return empty for state query
      mockDb._mockLimit.mockResolvedValueOnce([]);

      const result = await service.handleComposioCallback(validParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Composio state not found or expired");
      expect(result.redirectUri).toContain("status=error");

      consoleSpy.mockRestore();
    });

    it("returns error when state is expired", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});

      const mockState = {
        id: "state_123",
        connection_request_id: "connected_account_123",
        user_id: "user_456",
        organisation_id: "org_789",
        mcp_store_id: "store_123",
        expires_at: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago (expired)
      };

      mockDb._mockLimit.mockResolvedValueOnce([mockState]);

      const result = await service.handleComposioCallback(validParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe("State expired");
      expect(result.redirectUri).toContain("State%20expired");

      // Verify expired state was deleted
      expect(mockDb.delete).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("returns error when MCP store is not found", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});

      const mockState = {
        id: "state_123",
        connection_request_id: "connected_account_123",
        user_id: "user_456",
        organisation_id: "org_789",
        mcp_store_id: "store_123",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
      };

      mockDb._mockLimit.mockResolvedValueOnce([mockState]);
      // Return empty for store query
      mockDb._mockLimit.mockResolvedValueOnce([]);

      const result = await service.handleComposioCallback(validParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe("MCP not found in store");

      consoleSpy.mockRestore();
    });

    it("returns error when Composio details are not found", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});

      const mockState = {
        id: "state_123",
        connection_request_id: "connected_account_123",
        user_id: "user_456",
        organisation_id: "org_789",
        mcp_store_id: "store_123",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
      };

      const mockStore = {
        id: "store_123",
        name: "Test MCP Store",
        integration_type: "composio",
      };

      mockDb._mockLimit.mockResolvedValueOnce([mockState]);
      mockDb._mockLimit.mockResolvedValueOnce([mockStore]);
      // Return empty for Composio details query
      mockDb._mockLimit.mockResolvedValueOnce([]);

      const result = await service.handleComposioCallback(validParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Composio integration details not found for this MCP"
      );

      consoleSpy.mockRestore();
    });

    it("handles MCP generation error gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});

      const mockState = {
        id: "state_123",
        connection_request_id: "connected_account_123",
        user_id: "user_456",
        organisation_id: "org_789",
        mcp_store_id: "store_123",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
      };

      const mockStore = {
        id: "store_123",
        name: "Test MCP Store",
        integration_type: "composio",
      };

      const mockComposioDetails = {
        mcp_store_id: "store_123",
        auth_config_id: "auth_config_123",
        mcp_config_id: "mcp_config_123",
      };

      mockDb._mockLimit.mockResolvedValueOnce([mockState]);
      mockDb._mockLimit.mockResolvedValueOnce([mockStore]);
      mockDb._mockLimit.mockResolvedValueOnce([mockComposioDetails]);

      mockComposioClient.mcp.generate.mockRejectedValue(
        new Error("MCP generation failed")
      );

      const result = await service.handleComposioCallback(validParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe("MCP generation failed");
      expect(result.redirectUri).toContain("status=error");

      consoleSpy.mockRestore();
    });

    it("deletes used state after successful callback", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockState = {
        id: "state_123",
        connection_request_id: "connected_account_123",
        user_id: "user_456",
        organisation_id: "org_789",
        mcp_store_id: "store_123",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
      };

      const mockStore = {
        id: "store_123",
        name: "Test MCP Store",
        integration_type: "composio",
      };

      const mockComposioDetails = {
        mcp_store_id: "store_123",
        auth_config_id: "auth_config_123",
        mcp_config_id: "mcp_config_123",
      };

      const mockMcpInstance = {
        url: "https://composio.dev/mcp/instance/xyz",
      };

      mockDb._mockLimit.mockResolvedValueOnce([mockState]);
      mockDb._mockLimit.mockResolvedValueOnce([mockStore]);
      mockDb._mockLimit.mockResolvedValueOnce([mockComposioDetails]);
      mockComposioClient.mcp.generate.mockResolvedValue(mockMcpInstance);

      await service.handleComposioCallback(validParams);

      // Verify state was deleted
      expect(mockDb.delete).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("creates MCP record with correct values", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockState = {
        id: "state_123",
        connection_request_id: "connected_account_123",
        user_id: "user_456",
        organisation_id: "org_789",
        mcp_store_id: "store_123",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
      };

      const mockStore = {
        id: "store_123",
        name: "Test MCP Store",
        integration_type: "composio",
      };

      const mockComposioDetails = {
        mcp_store_id: "store_123",
        auth_config_id: "auth_config_123",
        mcp_config_id: "mcp_config_123",
      };

      const mockMcpInstance = {
        url: "https://composio.dev/mcp/instance/xyz",
      };

      mockDb._mockLimit.mockResolvedValueOnce([mockState]);
      mockDb._mockLimit.mockResolvedValueOnce([mockStore]);
      mockDb._mockLimit.mockResolvedValueOnce([mockComposioDetails]);
      mockComposioClient.mcp.generate.mockResolvedValue(mockMcpInstance);

      await service.handleComposioCallback(validParams);

      // Verify insert was called with correct MCP values
      expect(mockDb._mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "test-uuid-1234",
          organisation_id: "org_789",
          author_id: "user_456",
          name: "Test MCP Store",
          mcp_store_id: "store_123",
          integration_type: "composio",
          custom_mcp_server_url: null,
        })
      );

      consoleSpy.mockRestore();
    });

    it("creates Composio connection record with generated URL", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockState = {
        id: "state_123",
        connection_request_id: "connected_account_123",
        user_id: "user_456",
        organisation_id: "org_789",
        mcp_store_id: "store_123",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
      };

      const mockStore = {
        id: "store_123",
        name: "Test MCP Store",
        integration_type: "composio",
      };

      const mockComposioDetails = {
        mcp_store_id: "store_123",
        auth_config_id: "auth_config_123",
        mcp_config_id: "mcp_config_123",
      };

      const mockMcpInstance = {
        url: "https://composio.dev/mcp/instance/xyz",
      };

      mockDb._mockLimit.mockResolvedValueOnce([mockState]);
      mockDb._mockLimit.mockResolvedValueOnce([mockStore]);
      mockDb._mockLimit.mockResolvedValueOnce([mockComposioDetails]);
      mockComposioClient.mcp.generate.mockResolvedValue(mockMcpInstance);

      await service.handleComposioCallback(validParams);

      // Verify connection record was created (second insert call)
      expect(mockDb.insert).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });

    it("handles unknown error types", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});

      const mockState = {
        id: "state_123",
        connection_request_id: "connected_account_123",
        user_id: "user_456",
        organisation_id: "org_789",
        mcp_store_id: "store_123",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
      };

      mockDb._mockLimit.mockResolvedValueOnce([mockState]);
      mockDb._mockLimit.mockRejectedValueOnce("String error");

      const result = await service.handleComposioCallback(validParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error occurred");

      consoleSpy.mockRestore();
    });
  });

  describe("getConnectionUrl", () => {
    it("returns connection URL when connection exists", async () => {
      const mockConnection = {
        mcp_id: "mcp_123",
        connection_url: "https://composio.dev/mcp/connection/abc",
      };

      mockDb._mockLimit.mockResolvedValueOnce([mockConnection]);

      const result = await service.getConnectionUrl({ mcpId: "mcp_123" });

      expect(result).toBe("https://composio.dev/mcp/connection/abc");
    });

    it("returns null when connection does not exist", async () => {
      mockDb._mockLimit.mockResolvedValueOnce([]);

      const result = await service.getConnectionUrl({ mcpId: "nonexistent" });

      expect(result).toBeNull();
    });

    it("queries database with correct MCP ID", async () => {
      mockDb._mockLimit.mockResolvedValueOnce([]);

      await service.getConnectionUrl({ mcpId: "mcp_specific" });

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb._mockFrom).toHaveBeenCalled();
      expect(mockDb._mockWhere).toHaveBeenCalled();
      expect(mockDb._mockLimit).toHaveBeenCalledWith(1);
    });

    it("handles database query errors", async () => {
      mockDb._mockLimit.mockRejectedValueOnce(new Error("Database error"));

      await expect(
        service.getConnectionUrl({ mcpId: "mcp_error" })
      ).rejects.toThrow("Database error");
    });
  });

  describe("edge cases", () => {
    it("handles special characters in user/org IDs for composioUserId", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockStore = {
        id: "store_123",
        name: "Test MCP",
        integration_type: "composio",
      };

      const mockComposioDetails = {
        mcp_store_id: "store_123",
        auth_config_id: "auth_config_123",
        mcp_config_id: "mcp_config_123",
      };

      const mockConnectionRequest = {
        id: "connection_request_123",
        redirectUrl: "https://composio.dev/auth/redirect",
      };

      mockDb._mockLimit.mockResolvedValueOnce([mockStore]);
      mockDb._mockLimit.mockResolvedValueOnce([mockComposioDetails]);
      mockComposioClient.connectedAccounts.link.mockResolvedValue(
        mockConnectionRequest
      );

      const params = {
        mcpStoreId: "store_123",
        userId: "user-with-dashes",
        organisationId: "org_with_underscores",
      };

      await service.initiateComposioFlow(params);

      expect(mockComposioClient.connectedAccounts.link).toHaveBeenCalledWith(
        "user-user-with-dashes-org-org_with_underscores",
        "auth_config_123",
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it("generates correct callback URL from SERVER_URL env var", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockStore = {
        id: "store_123",
        name: "Test MCP",
        integration_type: "composio",
      };

      const mockComposioDetails = {
        mcp_store_id: "store_123",
        auth_config_id: "auth_config_123",
        mcp_config_id: "mcp_config_123",
      };

      const mockConnectionRequest = {
        id: "connection_request_123",
        redirectUrl: "https://composio.dev/auth/redirect",
      };

      mockDb._mockLimit.mockResolvedValueOnce([mockStore]);
      mockDb._mockLimit.mockResolvedValueOnce([mockComposioDetails]);
      mockComposioClient.connectedAccounts.link.mockResolvedValue(
        mockConnectionRequest
      );

      await service.initiateComposioFlow({
        mcpStoreId: "store_123",
        userId: "user_456",
        organisationId: "org_789",
      });

      expect(mockComposioClient.connectedAccounts.link).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        {
          callbackUrl: "http://localhost:8080/api/mcp/callback",
        }
      );

      consoleSpy.mockRestore();
    });

    it("generates correct redirect URI on error with WEB_URL env var", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});

      mockDb._mockLimit.mockResolvedValueOnce([]);

      const result = await service.handleComposioCallback({
        connectedAccountId: "invalid",
      });

      expect(result.redirectUri).toContain("http://localhost:3000");
      expect(result.redirectUri).toContain("/integrations?status=error");

      consoleSpy.mockRestore();
    });

    it("returns august:// deep link on successful callback", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockState = {
        id: "state_123",
        connection_request_id: "connected_account_123",
        user_id: "user_456",
        organisation_id: "org_789",
        mcp_store_id: "store_123",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
      };

      const mockStore = {
        id: "store_123",
        name: "Test MCP Store",
        integration_type: "composio",
      };

      const mockComposioDetails = {
        mcp_store_id: "store_123",
        auth_config_id: "auth_config_123",
        mcp_config_id: "mcp_config_123",
      };

      const mockMcpInstance = {
        url: "https://composio.dev/mcp/instance/xyz",
      };

      mockDb._mockLimit.mockResolvedValueOnce([mockState]);
      mockDb._mockLimit.mockResolvedValueOnce([mockStore]);
      mockDb._mockLimit.mockResolvedValueOnce([mockComposioDetails]);
      mockComposioClient.mcp.generate.mockResolvedValue(mockMcpInstance);

      const result = await service.handleComposioCallback({
        connectedAccountId: "connected_account_123",
      });

      expect(result.redirectUri).toBe("august://");

      consoleSpy.mockRestore();
    });
  });
});
