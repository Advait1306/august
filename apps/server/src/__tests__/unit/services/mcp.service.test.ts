import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import type { McpConnection } from "@august/harness";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type { AppState } from "../../../config/state.js";

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

// Extended mock type with internal properties for testing
interface MockWhereFunction extends Mock {
  _directResult: unknown[];
}

// Interface for the mock database object
interface MockDb {
  select: Mock;
  _mockFrom: Mock;
  _mockWhere: MockWhereFunction;
  _mockLimit: Mock;
  setWhereResult: (value: unknown[]) => void;
}

// Partial type for mock McpConnection used in tests
// We only need the properties that are actually used in the tests
interface MockMcpConnection {
  name: string;
  tools: Array<{ name: string; description: string }>;
}

// Helper function to create a full McpConnection mock from partial data
function createMockConnection(partial: MockMcpConnection): McpConnection {
  // Convert simplified tool format to full Tool format
  const fullTools: Tool[] = partial.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: { type: "object" as const },
  }));

  return {
    name: partial.name,
    tools: fullTools,
    client: {} as McpConnection["client"],
    mcpTools: [],
    toolNameMap: new Map<string, string>(),
    execute: vi.fn(),
    disconnect: vi.fn(),
  };
}

// Type for mock Tool that matches Anthropic SDK Tool interface
interface MockTool {
  name: string;
  description: string;
  input_schema: { type: string; properties?: Record<string, unknown> };
}

// Create mock database helper
// The service uses different query patterns:
// - .select().from(mcps).where(eq(mcps.author_id, userId)) - returns array directly from where()
// - .select().from(mcpOauthIntegrationDetails).where(...).limit(1) - returns array from limit()
function createMockDb(): MockDb {
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  const mockWhere = vi.fn() as MockWhereFunction;
  const mockLimit = vi.fn();

  // Chain the methods
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  // where() can either resolve directly (no limit) or chain to limit
  // We'll track call count to determine behavior
  mockWhere.mockImplementation(() => {
    const result: { limit: Mock; then?: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise<unknown> } = { limit: mockLimit };
    // Also make where() thenable so it can be awaited directly
    result.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      return Promise.resolve(mockWhere._directResult ?? []).then(resolve, reject);
    };
    return result;
  });
  mockLimit.mockResolvedValue([]);

  // Store a reference to set the direct result
  mockWhere._directResult = [];

  return {
    select: mockSelect,
    _mockFrom: mockFrom,
    _mockWhere: mockWhere,
    _mockLimit: mockLimit,
    // Helper to set what .where() returns when awaited directly
    setWhereResult: (value: unknown[]) => {
      mockWhere._directResult = value;
    },
  };
}

describe("McpService", () => {
  let service: McpService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new McpService(mockDb as unknown as AppState["db"]);
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

      const fullMockConnection = createMockConnection(mockConnection);
      vi.mocked(connectMcpServer).mockResolvedValue(fullMockConnection);
      vi.mocked(getMcpTools).mockReturnValue([
        { name: "tool1", description: "Test tool", input_schema: { type: "object" } },
      ] as Tool[]);

      const result = await service.connectUserMcps("user_123");

      expect(result.connections).toHaveLength(1);
      expect(result.connections[0]).toBe(fullMockConnection);
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

      const fullMockConnection = createMockConnection(mockConnection);
      vi.mocked(connectMcpServer).mockResolvedValue(fullMockConnection);
      vi.mocked(getMcpTools).mockReturnValue([
        { name: "customTool", description: "Custom tool", input_schema: { type: "object" } },
      ] as Tool[]);

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

      const fullMockConnection = createMockConnection(mockConnection);
      vi.mocked(connectMcpServer).mockResolvedValue(fullMockConnection);
      vi.mocked(getMcpTools).mockReturnValue([
        { name: "composioTool", description: "Composio tool", input_schema: { type: "object" } },
      ] as Tool[]);

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

      const fullMockConnectionA = createMockConnection(mockConnectionA);
      const fullMockConnectionB = createMockConnection(mockConnectionB);
      vi.mocked(connectMcpServer)
        .mockResolvedValueOnce(fullMockConnectionA)
        .mockResolvedValueOnce(fullMockConnectionB);

      vi.mocked(getMcpTools).mockReturnValue([
        { name: "toolA", description: "Tool A", input_schema: { type: "object" } },
        { name: "toolB", description: "Tool B", input_schema: { type: "object" } },
      ] as Tool[]);

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

      const fullMockConnection = createMockConnection(mockConnection);
      vi.mocked(connectMcpServer)
        .mockResolvedValueOnce(fullMockConnection)
        .mockRejectedValueOnce(new Error("Connection refused"));

      vi.mocked(getMcpTools).mockReturnValue([
        { name: "successTool", description: "Success tool", input_schema: { type: "object" } },
      ] as Tool[]);

      const result = await service.connectUserMcps("user_123");

      // Only successful connection should be in the result
      expect(result.connections).toHaveLength(1);
      expect(result.connections[0]).toBe(fullMockConnection);
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
      const fullMockConnection = createMockConnection(mockConnection);
      vi.mocked(connectMcpServer).mockResolvedValue(fullMockConnection);
      vi.mocked(getMcpTools).mockReturnValue([
        { name: "tool1", description: "Tool 1", input_schema: { type: "object" } },
        { name: "tool2", description: "Tool 2", input_schema: { type: "object" } },
        { name: "tool3", description: "Tool 3", input_schema: { type: "object" } },
      ] as Tool[]);

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

      const mockConnections: McpConnection[] = [
        createMockConnection({ name: "MCP 1", tools: [] }),
        createMockConnection({ name: "MCP 2", tools: [] }),
      ];

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

      const mockConnections: McpConnection[] = [
        createMockConnection({ name: "MCP 1", tools: [] }),
      ];

      vi.mocked(disconnectAll).mockRejectedValue(new Error("Disconnect failed"));

      await expect(
        service.disconnectAllConnections(mockConnections)
      ).rejects.toThrow("Disconnect failed");

      consoleSpy.mockRestore();
    });

    it("logs the correct number of connections being disconnected", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockConnections: McpConnection[] = [
        createMockConnection({ name: "MCP 1", tools: [] }),
        createMockConnection({ name: "MCP 2", tools: [] }),
        createMockConnection({ name: "MCP 3", tools: [] }),
      ];

      vi.mocked(disconnectAll).mockResolvedValue(undefined);

      await service.disconnectAllConnections(mockConnections);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[McpService] Disconnecting 3 MCP connections"
      );

      consoleSpy.mockRestore();
    });

    it("disconnects single connection", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockConnections: McpConnection[] = [
        createMockConnection({ name: "MCP 1", tools: [] }),
      ];

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
      const testService = new McpService(testDb as unknown as AppState["db"]);

      expect(testService).toBeInstanceOf(McpService);
    });

    it("accepts a database instance", () => {
      const testDb = createMockDb();

      // Should not throw
      expect(() => new McpService(testDb as unknown as AppState["db"])).not.toThrow();
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
      const fullMockConnection = createMockConnection(mockConnection);
      vi.mocked(connectMcpServer).mockResolvedValue(fullMockConnection);
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
