import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import type { McpConnection } from "@august/harness";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type { AppState } from "../../../config/state.js";

// Mock the @august/harness module
vi.mock("@august/harness", () => ({
  connectMcpServer: vi.fn(),
  getMcpTools: vi.fn(),
  disconnectAll: vi.fn(),
}));

// Import after mocking
import { McpService, type Mcp } from "../../../services/mcp.service.js";
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

// Create mock database helper
function createMockDb(): MockDb {
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  const mockWhere = vi.fn() as MockWhereFunction;
  const mockLimit = vi.fn();

  // Chain the methods
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockImplementation(() => {
    const result: { limit: Mock; then?: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise<unknown> } = { limit: mockLimit };
    result.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      return Promise.resolve(mockWhere._directResult ?? []).then(resolve, reject);
    };
    return result;
  });
  mockLimit.mockResolvedValue([]);

  mockWhere._directResult = [];

  return {
    select: mockSelect,
    _mockFrom: mockFrom,
    _mockWhere: mockWhere,
    _mockLimit: mockLimit,
    setWhereResult: (value: unknown[]) => {
      mockWhere._directResult = value;
    },
  };
}

// Helper to reset the singleton instance between tests
function resetSingleton() {
  // Access private static instance via type assertion
  (McpService as unknown as { instance: McpService | null }).instance = null;
}

describe("McpService", () => {
  let service: McpService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSingleton();
    mockDb = createMockDb();
    service = McpService.getInstance(mockDb as unknown as AppState["db"]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetSingleton();
  });

  describe("getInstance", () => {
    it("creates a singleton instance", () => {
      const instance1 = McpService.getInstance(mockDb as unknown as AppState["db"]);
      const instance2 = McpService.getInstance(mockDb as unknown as AppState["db"]);

      expect(instance1).toBe(instance2);
    });

    it("returns the same instance even with different db parameter", () => {
      const instance1 = McpService.getInstance(mockDb as unknown as AppState["db"]);
      const anotherDb = createMockDb();
      const instance2 = McpService.getInstance(anotherDb as unknown as AppState["db"]);

      // Should still be the same instance (singleton pattern)
      expect(instance1).toBe(instance2);
    });
  });

  describe("getUserMcps", () => {
    it("returns empty array when user has no MCPs", async () => {
      mockDb.setWhereResult([]);

      const result = await service.getUserMcps("user_123");

      expect(result).toEqual([]);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("returns user MCPs from database", async () => {
      const mockMcps = [
        {
          id: "mcp_1",
          name: "Test MCP 1",
          author_id: "user_123",
          integration_type: "oauth",
          mcp_store_id: "store_1",
          custom_mcp_server_url: null,
        },
        {
          id: "mcp_2",
          name: "Test MCP 2",
          author_id: "user_123",
          integration_type: "composio",
          mcp_store_id: "store_2",
          custom_mcp_server_url: null,
        },
      ];

      mockDb.setWhereResult(mockMcps);

      const result = await service.getUserMcps("user_123");

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("mcp_1");
      expect(result[1]?.id).toBe("mcp_2");
    });
  });

  describe("getMcpServerUrl", () => {
    it("returns server URL from OAuth integration details for store MCP", async () => {
      const mockMcp: Mcp = {
        id: "mcp_1",
        name: "Store MCP",
        author_id: "user_123",
        organisation_id: "org_123",
        integration_type: "oauth",
        mcp_store_id: "store_1",
        custom_mcp_server_url: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockOAuthDetails = {
        mcp_server_url: "https://mcp.example.com",
      };

      mockDb._mockLimit.mockResolvedValueOnce([mockOAuthDetails]);

      const result = await service.getMcpServerUrl(mockMcp);

      expect(result).toBe("https://mcp.example.com");
    });

    it("returns custom server URL for custom MCP", async () => {
      const mockMcp: Mcp = {
        id: "mcp_2",
        name: "Custom MCP",
        author_id: "user_123",
        organisation_id: "org_123",
        integration_type: "oauth",
        mcp_store_id: null,
        custom_mcp_server_url: "https://custom-mcp.example.com",
        created_at: new Date(),
        updated_at: new Date(),
      };

      const result = await service.getMcpServerUrl(mockMcp);

      expect(result).toBe("https://custom-mcp.example.com");
    });

    it("returns null when no OAuth details found for store MCP", async () => {
      const mockMcp: Mcp = {
        id: "mcp_3",
        name: "Missing Details MCP",
        author_id: "user_123",
        organisation_id: "org_123",
        integration_type: "oauth",
        mcp_store_id: "store_missing",
        custom_mcp_server_url: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb._mockLimit.mockResolvedValueOnce([]);

      const result = await service.getMcpServerUrl(mockMcp);

      expect(result).toBeNull();
    });

    it("returns null when MCP has neither store ID nor custom URL", async () => {
      const mockMcp: Mcp = {
        id: "mcp_4",
        name: "Empty MCP",
        author_id: "user_123",
        organisation_id: "org_123",
        integration_type: "oauth",
        mcp_store_id: null,
        custom_mcp_server_url: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const result = await service.getMcpServerUrl(mockMcp);

      expect(result).toBeNull();
    });

    it("prioritizes store URL over custom URL when both present", async () => {
      const mockMcp: Mcp = {
        id: "mcp_5",
        name: "Both URLs MCP",
        author_id: "user_123",
        organisation_id: "org_123",
        integration_type: "oauth",
        mcp_store_id: "store_1",
        custom_mcp_server_url: "https://custom.example.com",
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockOAuthDetails = {
        mcp_server_url: "https://store.example.com",
      };

      mockDb._mockLimit.mockResolvedValueOnce([mockOAuthDetails]);

      const result = await service.getMcpServerUrl(mockMcp);

      expect(result).toBe("https://store.example.com");
    });
  });

  describe("connectToMcp", () => {
    it("connects to MCP server successfully", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockConnection = createMockConnection({
        name: "Test MCP",
        tools: [{ name: "tool1", description: "Test tool" }],
      });

      vi.mocked(connectMcpServer).mockResolvedValue(mockConnection);

      const result = await service.connectToMcp({
        name: "Test MCP",
        url: "https://mcp.example.com",
        authToken: "token_123",
      });

      expect(result).toBe(mockConnection);
      expect(connectMcpServer).toHaveBeenCalledWith({
        name: "Test MCP",
        url: "https://mcp.example.com",
        authToken: "token_123",
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Connecting to MCP: Test MCP")
      );

      consoleSpy.mockRestore();
    });

    it("connects without auth token", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});

      const mockConnection = createMockConnection({
        name: "No Auth MCP",
        tools: [],
      });

      vi.mocked(connectMcpServer).mockResolvedValue(mockConnection);

      const result = await service.connectToMcp({
        name: "No Auth MCP",
        url: "https://mcp.example.com",
      });

      expect(result).toBe(mockConnection);
      expect(connectMcpServer).toHaveBeenCalledWith({
        name: "No Auth MCP",
        url: "https://mcp.example.com",
        authToken: undefined,
      });
    });

    it("propagates connection errors", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});

      vi.mocked(connectMcpServer).mockRejectedValue(new Error("Connection failed"));

      await expect(
        service.connectToMcp({
          name: "Failing MCP",
          url: "https://mcp.example.com",
        })
      ).rejects.toThrow("Connection failed");
    });

    it("logs tool count on successful connection", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockConnection = createMockConnection({
        name: "Multi Tool MCP",
        tools: [
          { name: "tool1", description: "Tool 1" },
          { name: "tool2", description: "Tool 2" },
          { name: "tool3", description: "Tool 3" },
        ],
      });

      vi.mocked(connectMcpServer).mockResolvedValue(mockConnection);

      await service.connectToMcp({
        name: "Multi Tool MCP",
        url: "https://mcp.example.com",
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("tools: 3")
      );

      consoleSpy.mockRestore();
    });
  });

  describe("getToolsFromConnections", () => {
    it("returns tools from connections using getMcpTools", () => {
      const mockTools: Tool[] = [
        { name: "tool1", description: "Tool 1", input_schema: { type: "object" } },
        { name: "tool2", description: "Tool 2", input_schema: { type: "object" } },
      ];

      vi.mocked(getMcpTools).mockReturnValue(mockTools);

      const connections = [
        createMockConnection({ name: "MCP 1", tools: [] }),
        createMockConnection({ name: "MCP 2", tools: [] }),
      ];

      const result = service.getToolsFromConnections(connections);

      expect(getMcpTools).toHaveBeenCalledWith(connections);
      expect(result).toBe(mockTools);
    });

    it("returns empty array for empty connections", () => {
      vi.mocked(getMcpTools).mockReturnValue([]);

      const result = service.getToolsFromConnections([]);

      expect(result).toEqual([]);
    });
  });

  describe("buildToolToMcpIdMap", () => {
    it("builds mapping from tool names to MCP IDs", () => {
      const connections = [
        createMockConnection({
          name: "MCP A",
          tools: [
            { name: "toolA1", description: "Tool A1" },
            { name: "toolA2", description: "Tool A2" },
          ],
        }),
        createMockConnection({
          name: "MCP B",
          tools: [
            { name: "toolB1", description: "Tool B1" },
          ],
        }),
      ];

      const mcpIds = ["mcp_a", "mcp_b"];

      const result = service.buildToolToMcpIdMap(connections, mcpIds);

      expect(result.get("toolA1")).toBe("mcp_a");
      expect(result.get("toolA2")).toBe("mcp_a");
      expect(result.get("toolB1")).toBe("mcp_b");
      expect(result.size).toBe(3);
    });

    it("handles empty connections and mcpIds", () => {
      const result = service.buildToolToMcpIdMap([], []);

      expect(result.size).toBe(0);
    });

    it("handles mismatched array lengths gracefully", () => {
      const connections = [
        createMockConnection({
          name: "MCP A",
          tools: [{ name: "toolA", description: "Tool A" }],
        }),
        createMockConnection({
          name: "MCP B",
          tools: [{ name: "toolB", description: "Tool B" }],
        }),
      ];

      // Only one MCP ID provided
      const mcpIds = ["mcp_a"];

      const result = service.buildToolToMcpIdMap(connections, mcpIds);

      expect(result.get("toolA")).toBe("mcp_a");
      // toolB should not be mapped since no corresponding mcpId
      expect(result.get("toolB")).toBeUndefined();
    });

    it("handles connections with empty tool lists", () => {
      const connections = [
        createMockConnection({ name: "Empty MCP", tools: [] }),
      ];

      const mcpIds = ["mcp_empty"];

      const result = service.buildToolToMcpIdMap(connections, mcpIds);

      expect(result.size).toBe(0);
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
      vi.spyOn(console, "log").mockImplementation(() => {});

      const mockConnections: McpConnection[] = [
        createMockConnection({ name: "MCP 1", tools: [] }),
      ];

      vi.mocked(disconnectAll).mockRejectedValue(new Error("Disconnect failed"));

      await expect(
        service.disconnectAllConnections(mockConnections)
      ).rejects.toThrow("Disconnect failed");
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

  describe("integration scenarios", () => {
    it("supports typical workflow: get MCPs, get URL, connect", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});

      // Step 1: Get user's MCPs
      const mockMcps = [
        {
          id: "mcp_1",
          name: "Workflow MCP",
          author_id: "user_123",
          organisation_id: "org_123",
          integration_type: "oauth",
          mcp_store_id: null,
          custom_mcp_server_url: "https://workflow.example.com",
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      mockDb.setWhereResult(mockMcps);

      const userMcps = await service.getUserMcps("user_123");
      expect(userMcps).toHaveLength(1);

      // Step 2: Get server URL for the MCP
      const serverUrl = await service.getMcpServerUrl(userMcps[0] as Mcp);
      expect(serverUrl).toBe("https://workflow.example.com");

      // Step 3: Connect to the MCP (auth token would come from OAuth service)
      const mockConnection = createMockConnection({
        name: "Workflow MCP",
        tools: [{ name: "workflowTool", description: "Workflow tool" }],
      });
      vi.mocked(connectMcpServer).mockResolvedValue(mockConnection);

      const connection = await service.connectToMcp({
        name: userMcps[0]!.name,
        url: serverUrl!,
        authToken: "external_token",
      });

      expect(connection.tools).toHaveLength(1);

      // Step 4: Build tool mapping
      const toolMap = service.buildToolToMcpIdMap([connection], [userMcps[0]!.id]);
      expect(toolMap.get("workflowTool")).toBe("mcp_1");

      // Step 5: Get aggregated tools
      vi.mocked(getMcpTools).mockReturnValue(connection.tools);
      const tools = service.getToolsFromConnections([connection]);
      expect(tools).toHaveLength(1);

      // Step 6: Disconnect
      vi.mocked(disconnectAll).mockResolvedValue(undefined);
      await service.disconnectAllConnections([connection]);
      expect(disconnectAll).toHaveBeenCalled();
    });
  });
});
