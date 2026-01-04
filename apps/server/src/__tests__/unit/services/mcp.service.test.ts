import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Create mock instances that will be used across tests
const mockOAuthServiceInstance = {
  getAccessToken: vi.fn(),
};

const mockComposioServiceInstance = {
  getConnectionUrl: vi.fn(),
};

// Mock OAuthService as a constructor function
vi.mock("../../../services/oauth.service.js", () => ({
  OAuthService: function MockOAuthService() {
    return mockOAuthServiceInstance;
  },
}));

// Mock ComposioService as a constructor function
vi.mock("../../../services/composio.service.js", () => ({
  ComposioService: function MockComposioService() {
    return mockComposioServiceInstance;
  },
}));

// Mock the @august/harness module
vi.mock("@august/harness", () => ({
  connectMcpServer: vi.fn(),
  getMcpTools: vi.fn(),
  disconnectAll: vi.fn(),
}));

// Import after mocking
import { McpService } from "../../../services/mcp.service.js";
import {
  connectMcpServer,
  getMcpTools,
  disconnectAll,
} from "@august/harness";

// Create mock database helper
// The service uses different query patterns:
// - .select().from(mcps).where(eq(mcps.author_id, userId)) - returns array directly from where()
// - .select().from(mcpOauthIntegrationDetails).where(...).limit(1) - returns array from limit()
function createMockDb() {
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  const mockWhere = vi.fn();
  const mockLimit = vi.fn();

  // Chain the methods
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  // where() can either resolve directly (no limit) or chain to limit
  // We'll track call count to determine behavior
  mockWhere.mockImplementation(() => {
    const result = { limit: mockLimit };
    // Also make where() thenable so it can be awaited directly
    (result as any).then = (resolve: Function, reject: Function) => {
      return Promise.resolve(mockWhere._directResult ?? []).then(resolve, reject);
    };
    return result;
  });
  mockLimit.mockResolvedValue([]);

  // Store a reference to set the direct result
  (mockWhere as any)._directResult = [];

  return {
    select: mockSelect,
    _mockFrom: mockFrom,
    _mockWhere: mockWhere,
    _mockLimit: mockLimit,
    // Helper to set what .where() returns when awaited directly
    setWhereResult: (value: any[]) => {
      (mockWhere as any)._directResult = value;
    },
  };
}

describe("McpService", () => {
  let service: McpService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new McpService(mockDb as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("connectUserMcps", () => {
    it("returns empty results when user has no MCPs", async () => {
      // User has no MCPs - set where result directly
      mockDb.setWhereResult([]);

      const result = await service.connectUserMcps("user_123");

      expect(result).toEqual({
        connections: [],
        tools: [],
        toolToMcpId: new Map(),
      });
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("connects to OAuth MCP with store ID successfully", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockMcp = {
        id: "mcp_1",
        name: "Test OAuth MCP",
        author_id: "user_123",
        integration_type: "oauth",
        mcp_store_id: "store_1",
        custom_mcp_server_url: null,
      };

      const mockOAuthDetails = {
        mcp_server_url: "https://mcp.example.com",
      };

      const mockConnection = {
        name: "Test OAuth MCP",
        tools: [{ name: "tool1", description: "Test tool" }],
      };

      // First query (user MCPs) - returns from .where() directly
      mockDb.setWhereResult([mockMcp]);
      // Second query (OAuth details) - returns from .limit()
      mockDb._mockLimit.mockResolvedValueOnce([mockOAuthDetails]);

      mockOAuthServiceInstance.getAccessToken.mockResolvedValue("access_token_123");

      vi.mocked(connectMcpServer).mockResolvedValue(mockConnection as any);
      vi.mocked(getMcpTools).mockReturnValue([
        { name: "tool1", description: "Test tool", input_schema: { type: "object" } },
      ] as any);

      const result = await service.connectUserMcps("user_123");

      expect(result.connections).toHaveLength(1);
      expect(result.connections[0]).toBe(mockConnection);
      expect(result.tools).toHaveLength(1);
      expect(result.toolToMcpId.get("tool1")).toBe("mcp_1");
      expect(connectMcpServer).toHaveBeenCalledWith({
        name: "Test OAuth MCP",
        url: "https://mcp.example.com",
        authToken: "access_token_123",
      });

      consoleSpy.mockRestore();
    });

    it("connects to OAuth MCP with custom URL successfully", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockMcp = {
        id: "mcp_2",
        name: "Custom OAuth MCP",
        author_id: "user_123",
        integration_type: "oauth",
        mcp_store_id: null,
        custom_mcp_server_url: "https://custom-mcp.example.com",
      };

      const mockConnection = {
        name: "Custom OAuth MCP",
        tools: [{ name: "customTool", description: "Custom tool" }],
      };

      // User MCPs query
      mockDb.setWhereResult([mockMcp]);

      mockOAuthServiceInstance.getAccessToken.mockResolvedValue("custom_token_456");

      vi.mocked(connectMcpServer).mockResolvedValue(mockConnection as any);
      vi.mocked(getMcpTools).mockReturnValue([
        { name: "customTool", description: "Custom tool", input_schema: { type: "object" } },
      ] as any);

      const result = await service.connectUserMcps("user_123");

      expect(result.connections).toHaveLength(1);
      expect(result.toolToMcpId.get("customTool")).toBe("mcp_2");
      expect(connectMcpServer).toHaveBeenCalledWith({
        name: "Custom OAuth MCP",
        url: "https://custom-mcp.example.com",
        authToken: "custom_token_456",
      });

      consoleSpy.mockRestore();
    });

    it("connects to Composio MCP successfully", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockMcp = {
        id: "mcp_3",
        name: "Composio MCP",
        author_id: "user_123",
        integration_type: "composio",
        mcp_store_id: "store_2",
        custom_mcp_server_url: null,
      };

      const mockConnection = {
        name: "Composio MCP",
        tools: [{ name: "composioTool", description: "Composio tool" }],
      };

      // User MCPs query
      mockDb.setWhereResult([mockMcp]);

      mockComposioServiceInstance.getConnectionUrl.mockResolvedValue(
        "https://composio.example.com/mcp-url-with-auth"
      );

      vi.mocked(connectMcpServer).mockResolvedValue(mockConnection as any);
      vi.mocked(getMcpTools).mockReturnValue([
        { name: "composioTool", description: "Composio tool", input_schema: { type: "object" } },
      ] as any);

      const result = await service.connectUserMcps("user_123");

      expect(result.connections).toHaveLength(1);
      expect(result.toolToMcpId.get("composioTool")).toBe("mcp_3");
      expect(connectMcpServer).toHaveBeenCalledWith({
        name: "Composio MCP",
        url: "https://composio.example.com/mcp-url-with-auth",
        authToken: undefined,
      });

      consoleSpy.mockRestore();
    });

    it("returns null for OAuth MCP without server URL (store MCP, no OAuth details)", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const mockMcp = {
        id: "mcp_4",
        name: "Missing URL MCP",
        author_id: "user_123",
        integration_type: "oauth",
        mcp_store_id: "store_3",
        custom_mcp_server_url: null,
      };

      // User MCPs query
      mockDb.setWhereResult([mockMcp]);
      // OAuth details query returns empty
      mockDb._mockLimit.mockResolvedValueOnce([]);

      vi.mocked(getMcpTools).mockReturnValue([]);

      const result = await service.connectUserMcps("user_123");

      expect(result.connections).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No server URL found for OAuth MCP")
      );

      consoleSpy.mockRestore();
    });

    it("returns null for OAuth MCP without access token", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const mockMcp = {
        id: "mcp_5",
        name: "No Token MCP",
        author_id: "user_123",
        integration_type: "oauth",
        mcp_store_id: null,
        custom_mcp_server_url: "https://mcp.example.com",
      };

      // User MCPs query
      mockDb.setWhereResult([mockMcp]);

      mockOAuthServiceInstance.getAccessToken.mockResolvedValue(null);

      vi.mocked(getMcpTools).mockReturnValue([]);

      const result = await service.connectUserMcps("user_123");

      expect(result.connections).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No access token found for MCP")
      );

      consoleSpy.mockRestore();
    });

    it("returns null for Composio MCP without connection URL", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const mockMcp = {
        id: "mcp_6",
        name: "No Composio URL MCP",
        author_id: "user_123",
        integration_type: "composio",
        mcp_store_id: "store_4",
        custom_mcp_server_url: null,
      };

      // User MCPs query
      mockDb.setWhereResult([mockMcp]);

      mockComposioServiceInstance.getConnectionUrl.mockResolvedValue(null);

      vi.mocked(getMcpTools).mockReturnValue([]);

      const result = await service.connectUserMcps("user_123");

      expect(result.connections).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No Composio connection URL found for MCP")
      );

      consoleSpy.mockRestore();
    });

    it("handles connection errors gracefully (graceful degradation)", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});

      const mockMcp = {
        id: "mcp_7",
        name: "Error MCP",
        author_id: "user_123",
        integration_type: "oauth",
        mcp_store_id: null,
        custom_mcp_server_url: "https://mcp.example.com",
      };

      // User MCPs query
      mockDb.setWhereResult([mockMcp]);

      mockOAuthServiceInstance.getAccessToken.mockResolvedValue("token_123");

      vi.mocked(connectMcpServer).mockRejectedValue(new Error("Connection failed"));
      vi.mocked(getMcpTools).mockReturnValue([]);

      const result = await service.connectUserMcps("user_123");

      expect(result.connections).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to connect to MCP"),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("connects to multiple MCPs and aggregates tools", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});

      const mockMcps = [
        {
          id: "mcp_a",
          name: "MCP A",
          author_id: "user_123",
          integration_type: "oauth",
          mcp_store_id: null,
          custom_mcp_server_url: "https://mcp-a.example.com",
        },
        {
          id: "mcp_b",
          name: "MCP B",
          author_id: "user_123",
          integration_type: "composio",
          mcp_store_id: "store_b",
          custom_mcp_server_url: null,
        },
      ];

      const mockConnectionA = {
        name: "MCP A",
        tools: [{ name: "toolA", description: "Tool A" }],
      };

      const mockConnectionB = {
        name: "MCP B",
        tools: [{ name: "toolB", description: "Tool B" }],
      };

      // User MCPs query
      mockDb.setWhereResult(mockMcps);

      mockOAuthServiceInstance.getAccessToken.mockResolvedValue("token_a");
      mockComposioServiceInstance.getConnectionUrl.mockResolvedValue("https://composio-b.example.com");

      vi.mocked(connectMcpServer)
        .mockResolvedValueOnce(mockConnectionA as any)
        .mockResolvedValueOnce(mockConnectionB as any);

      vi.mocked(getMcpTools).mockReturnValue([
        { name: "toolA", description: "Tool A", input_schema: { type: "object" } },
        { name: "toolB", description: "Tool B", input_schema: { type: "object" } },
      ] as any);

      const result = await service.connectUserMcps("user_123");

      expect(result.connections).toHaveLength(2);
      expect(result.toolToMcpId.get("toolA")).toBe("mcp_a");
      expect(result.toolToMcpId.get("toolB")).toBe("mcp_b");
      expect(result.tools).toHaveLength(2);
    });

    it("handles mixed success and failure for multiple MCPs", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});

      const mockMcps = [
        {
          id: "mcp_success",
          name: "Success MCP",
          author_id: "user_123",
          integration_type: "oauth",
          mcp_store_id: null,
          custom_mcp_server_url: "https://success.example.com",
        },
        {
          id: "mcp_fail",
          name: "Fail MCP",
          author_id: "user_123",
          integration_type: "oauth",
          mcp_store_id: null,
          custom_mcp_server_url: "https://fail.example.com",
        },
      ];

      const mockConnection = {
        name: "Success MCP",
        tools: [{ name: "successTool", description: "Success tool" }],
      };

      // User MCPs query
      mockDb.setWhereResult(mockMcps);

      mockOAuthServiceInstance.getAccessToken
        .mockResolvedValueOnce("token_success")
        .mockResolvedValueOnce("token_fail");

      vi.mocked(connectMcpServer)
        .mockResolvedValueOnce(mockConnection as any)
        .mockRejectedValueOnce(new Error("Connection refused"));

      vi.mocked(getMcpTools).mockReturnValue([
        { name: "successTool", description: "Success tool", input_schema: { type: "object" } },
      ] as any);

      const result = await service.connectUserMcps("user_123");

      // Only successful connection should be in the result
      expect(result.connections).toHaveLength(1);
      expect(result.connections[0]).toBe(mockConnection);
      expect(result.toolToMcpId.get("successTool")).toBe("mcp_success");
    });

    it("handles unknown integration type gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const mockMcp = {
        id: "mcp_unknown",
        name: "Unknown Type MCP",
        author_id: "user_123",
        integration_type: "unknown_type",
        mcp_store_id: null,
        custom_mcp_server_url: null,
      };

      // User MCPs query
      mockDb.setWhereResult([mockMcp]);

      vi.mocked(getMcpTools).mockReturnValue([]);

      const result = await service.connectUserMcps("user_123");

      expect(result.connections).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No server URL found for MCP")
      );

      consoleSpy.mockRestore();
    });

    it("maps multiple tools from a single MCP connection", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});

      const mockMcp = {
        id: "mcp_multi",
        name: "Multi Tool MCP",
        author_id: "user_123",
        integration_type: "oauth",
        mcp_store_id: null,
        custom_mcp_server_url: "https://multi.example.com",
      };

      const mockConnection = {
        name: "Multi Tool MCP",
        tools: [
          { name: "tool1", description: "Tool 1" },
          { name: "tool2", description: "Tool 2" },
          { name: "tool3", description: "Tool 3" },
        ],
      };

      mockDb.setWhereResult([mockMcp]);
      mockOAuthServiceInstance.getAccessToken.mockResolvedValue("token_multi");
      vi.mocked(connectMcpServer).mockResolvedValue(mockConnection as any);
      vi.mocked(getMcpTools).mockReturnValue([
        { name: "tool1", description: "Tool 1", input_schema: { type: "object" } },
        { name: "tool2", description: "Tool 2", input_schema: { type: "object" } },
        { name: "tool3", description: "Tool 3", input_schema: { type: "object" } },
      ] as any);

      const result = await service.connectUserMcps("user_123");

      expect(result.toolToMcpId.get("tool1")).toBe("mcp_multi");
      expect(result.toolToMcpId.get("tool2")).toBe("mcp_multi");
      expect(result.toolToMcpId.get("tool3")).toBe("mcp_multi");
    });
  });

  describe("disconnectAllConnections", () => {
    it("does nothing when there are no connections", async () => {
      await service.disconnectAllConnections([]);

      expect(disconnectAll).not.toHaveBeenCalled();
    });

    it("disconnects all provided connections", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockConnections = [
        { name: "MCP 1", tools: [] },
        { name: "MCP 2", tools: [] },
      ] as any[];

      vi.mocked(disconnectAll).mockResolvedValue(undefined);

      await service.disconnectAllConnections(mockConnections);

      expect(disconnectAll).toHaveBeenCalledWith(mockConnections);
      expect(consoleSpy).toHaveBeenCalledWith(
        "[McpService] Disconnecting 2 MCP connections"
      );

      consoleSpy.mockRestore();
    });

    it("handles disconnect errors", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockConnections = [{ name: "MCP 1", tools: [] }] as any[];

      vi.mocked(disconnectAll).mockRejectedValue(new Error("Disconnect failed"));

      await expect(
        service.disconnectAllConnections(mockConnections)
      ).rejects.toThrow("Disconnect failed");

      consoleSpy.mockRestore();
    });

    it("logs the correct number of connections being disconnected", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockConnections = [
        { name: "MCP 1", tools: [] },
        { name: "MCP 2", tools: [] },
        { name: "MCP 3", tools: [] },
      ] as any[];

      vi.mocked(disconnectAll).mockResolvedValue(undefined);

      await service.disconnectAllConnections(mockConnections);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[McpService] Disconnecting 3 MCP connections"
      );

      consoleSpy.mockRestore();
    });

    it("disconnects single connection", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockConnections = [{ name: "MCP 1", tools: [] }] as any[];

      vi.mocked(disconnectAll).mockResolvedValue(undefined);

      await service.disconnectAllConnections(mockConnections);

      expect(disconnectAll).toHaveBeenCalledWith(mockConnections);
      expect(consoleSpy).toHaveBeenCalledWith(
        "[McpService] Disconnecting 1 MCP connections"
      );

      consoleSpy.mockRestore();
    });
  });

  describe("constructor", () => {
    it("creates a new McpService instance", () => {
      const testDb = createMockDb();
      const testService = new McpService(testDb as any);

      expect(testService).toBeInstanceOf(McpService);
    });

    it("accepts a database instance", () => {
      const testDb = createMockDb();

      // Should not throw
      expect(() => new McpService(testDb as any)).not.toThrow();
    });
  });

  describe("edge cases", () => {
    it("handles empty tool list from MCP connection", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});

      const mockMcp = {
        id: "mcp_empty",
        name: "Empty Tools MCP",
        author_id: "user_123",
        integration_type: "oauth",
        mcp_store_id: null,
        custom_mcp_server_url: "https://empty.example.com",
      };

      const mockConnection = {
        name: "Empty Tools MCP",
        tools: [],
      };

      mockDb.setWhereResult([mockMcp]);
      mockOAuthServiceInstance.getAccessToken.mockResolvedValue("token_empty");
      vi.mocked(connectMcpServer).mockResolvedValue(mockConnection as any);
      vi.mocked(getMcpTools).mockReturnValue([]);

      const result = await service.connectUserMcps("user_123");

      expect(result.connections).toHaveLength(1);
      expect(result.tools).toHaveLength(0);
      expect(result.toolToMcpId.size).toBe(0);
    });

    it("handles database query error for OAuth details", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});

      const mockMcp = {
        id: "mcp_db_error",
        name: "DB Error MCP",
        author_id: "user_123",
        integration_type: "oauth",
        mcp_store_id: "store_error",
        custom_mcp_server_url: null,
      };

      mockDb.setWhereResult([mockMcp]);
      mockDb._mockLimit.mockRejectedValueOnce(new Error("OAuth details query failed"));

      vi.mocked(getMcpTools).mockReturnValue([]);

      const result = await service.connectUserMcps("user_123");

      // Should handle the error gracefully and return empty connections
      expect(result.connections).toHaveLength(0);
    });
  });
});
