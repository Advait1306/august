import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToolService } from "../../../services/tool.service.js";
import { z } from "zod";

// Create mock instances that will be returned by constructors
const mockOAuthServiceInstance = {
  getAccessToken: vi.fn(),
};

const mockComposioServiceInstance = {
  getConnectionUrl: vi.fn(),
};

// Mock the server-tools module
vi.mock("../../../server-tools", () => ({
  getServerTool: vi.fn(),
}));

// Mock the agentLoopWorker queue
vi.mock("../../../queues/workers/agentLoopWorker", () => ({
  addToAgentLoopQueue: vi.fn().mockResolvedValue(undefined),
}));

// Mock the OAuthService as a class
vi.mock("../../../services/oauth.service", () => ({
  OAuthService: class MockOAuthService {
    constructor() {
      return mockOAuthServiceInstance;
    }
  },
}));

// Mock the ComposioService as a class
vi.mock("../../../services/composio.service", () => ({
  ComposioService: class MockComposioService {
    constructor() {
      return mockComposioServiceInstance;
    }
  },
}));

// Mock the MCP client connection from @august/harness
vi.mock("@august/harness", () => ({
  connectMcpServer: vi.fn(),
}));

import { getServerTool } from "../../../server-tools";
import { addToAgentLoopQueue } from "../../../queues/workers/agentLoopWorker";
import { connectMcpServer } from "@august/harness";

// Helper to create a mock database
function createMockDb() {
  const insertValues = vi.fn();
  const selectFrom = vi.fn();
  const selectWhere = vi.fn();
  const selectLimit = vi.fn();
  const updateSet = vi.fn();
  const updateWhere = vi.fn();
  const queryFindFirst = vi.fn();

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
    query: {
      blocks: {
        findFirst: queryFindFirst.mockResolvedValue(null),
      },
    },
    _mocks: {
      insertValues,
      selectFrom,
      selectWhere,
      selectLimit,
      updateSet,
      updateWhere,
      queryFindFirst,
    },
  };
}

type MockDb = ReturnType<typeof createMockDb>;

// Helper to reset singleton instance between tests
function resetToolServiceInstance() {
  // Access the private static instance and reset it
  (ToolService as any).instance = undefined;
}

describe("ToolService", () => {
  let mockDb: MockDb;
  let service: ToolService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetToolServiceInstance();
    mockDb = createMockDb();
    service = ToolService.getInstance({ db: mockDb } as any);

    // Reset mock service instances
    mockOAuthServiceInstance.getAccessToken.mockReset();
    mockComposioServiceInstance.getConnectionUrl.mockReset();

    // Default mock implementations
    mockOAuthServiceInstance.getAccessToken.mockResolvedValue("access-token-xyz");
    mockComposioServiceInstance.getConnectionUrl.mockResolvedValue("https://composio-url.example.com");

    // Suppress console logs during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getInstance", () => {
    it("returns the same instance on multiple calls", () => {
      const instance1 = ToolService.getInstance({ db: mockDb } as any);
      const instance2 = ToolService.getInstance({ db: mockDb } as any);

      expect(instance1).toBe(instance2);
    });

    it("creates new instance after reset", () => {
      const instance1 = ToolService.getInstance({ db: mockDb } as any);
      resetToolServiceInstance();
      const instance2 = ToolService.getInstance({ db: mockDb } as any);

      // They should be different instances but both valid
      expect(instance1).toBeDefined();
      expect(instance2).toBeDefined();
    });
  });

  describe("executeServerTool", () => {
    const mockToolBlock = {
      id: "block-123",
      turn_id: "turn-456",
      type: "tool_use",
      content: {
        type: "tool_use",
        id: "toolu_01abc123",
        name: "todo_write",
        input: { items: [] },
      },
    };

    const mockServerTool = {
      name: "todo_write",
      version: "1.0.0",
      description: "Write todo items",
      inputSchema: z.object({ items: z.array(z.string()) }),
      outputSchema: z.object({ success: z.boolean() }),
      execute: vi.fn().mockResolvedValue({ success: true }),
    };

    beforeEach(() => {
      mockDb._mocks.queryFindFirst.mockResolvedValue(mockToolBlock);
      vi.mocked(getServerTool).mockReturnValue(mockServerTool as any);
    });

    it("successfully executes a server tool and creates tool_result block", async () => {
      await service.executeServerTool(
        "task-123",
        "turn-456",
        "block-123",
        "todo_write",
        { items: ["item1", "item2"] }
      );

      // Verify tool was fetched
      expect(getServerTool).toHaveBeenCalledWith("todo_write");

      // Verify tool was executed with parsed input
      expect(mockServerTool.execute).toHaveBeenCalledWith(
        { items: ["item1", "item2"] },
        {
          taskId: "task-123",
          turnId: "turn-456",
          blockId: "block-123",
          db: mockDb,
        }
      );

      // Verify tool_result block was created
      expect(mockDb.insert).toHaveBeenCalled();
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.type).toBe("tool_result");
      expect(insertCall.content.type).toBe("tool_result");
      expect(insertCall.content.tool_use_id).toBe("toolu_01abc123");
      expect(insertCall.content.is_error).toBe(false);
      expect(JSON.parse(insertCall.content.content)).toEqual({ success: true });

      // Verify tool_use block was marked as completed
      expect(mockDb.update).toHaveBeenCalled();
      const updateCall = mockDb._mocks.updateSet.mock.calls[0][0];
      expect(updateCall.status).toBe("completed");

      // Verify agent loop queue was called
      expect(addToAgentLoopQueue).toHaveBeenCalledWith({
        task_id: "task-123",
        turn_id: "turn-456",
        block_id: expect.any(String),
      });
    });

    it("throws error when tool block is not found", async () => {
      mockDb._mocks.queryFindFirst.mockResolvedValue(null);

      await expect(
        service.executeServerTool(
          "task-123",
          "turn-456",
          "nonexistent-block",
          "todo_write",
          { items: [] }
        )
      ).rejects.toThrow("Tool block not found: nonexistent-block");
    });

    it("handles unknown server tool error gracefully", async () => {
      vi.mocked(getServerTool).mockReturnValue(undefined);

      await service.executeServerTool(
        "task-123",
        "turn-456",
        "block-123",
        "unknown_tool",
        {}
      );

      // Verify error was captured in tool_result
      expect(mockDb.insert).toHaveBeenCalled();
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.is_error).toBe(true);
      expect(insertCall.content.content).toContain("Unknown server tool");
    });

    it("handles input validation error gracefully", async () => {
      // Input that doesn't match schema
      await service.executeServerTool(
        "task-123",
        "turn-456",
        "block-123",
        "todo_write",
        { invalid_field: "value" }
      );

      // Verify error was captured in tool_result
      expect(mockDb.insert).toHaveBeenCalled();
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.is_error).toBe(true);
    });

    it("handles tool execution error gracefully", async () => {
      mockServerTool.execute.mockRejectedValue(new Error("Execution failed"));

      await service.executeServerTool(
        "task-123",
        "turn-456",
        "block-123",
        "todo_write",
        { items: [] }
      );

      // Verify error was captured in tool_result
      expect(mockDb.insert).toHaveBeenCalled();
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.is_error).toBe(true);
      expect(insertCall.content.content).toContain("Execution failed");
    });

    it("handles output validation error gracefully", async () => {
      // Return invalid output that doesn't match outputSchema
      mockServerTool.execute.mockResolvedValue({ invalid: "output" });

      await service.executeServerTool(
        "task-123",
        "turn-456",
        "block-123",
        "todo_write",
        { items: [] }
      );

      // Verify error was captured in tool_result
      expect(mockDb.insert).toHaveBeenCalled();
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.is_error).toBe(true);
    });

    it("handles non-Error thrown values", async () => {
      mockServerTool.execute.mockRejectedValue("string error");

      await service.executeServerTool(
        "task-123",
        "turn-456",
        "block-123",
        "todo_write",
        { items: [] }
      );

      // Verify string error was captured
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.is_error).toBe(true);
      expect(insertCall.content.content).toContain("string error");
    });
  });

  describe("executeMcpTool", () => {
    const mockToolBlock = {
      id: "block-123",
      turn_id: "turn-456",
      type: "tool_use",
      content: {
        type: "tool_use",
        id: "toolu_01mcp123",
        name: "linear__create_issue",
        input: { title: "New Issue" },
      },
    };

    const mockMcpRecord = {
      id: "mcp-123",
      name: "Linear",
      integration_type: "oauth",
      mcp_store_id: "store-123",
      custom_mcp_server_url: null,
    };

    const mockOAuthDetails = {
      mcp_store_id: "store-123",
      mcp_server_url: "https://linear-mcp.example.com",
    };

    const mockMcpConnection = {
      execute: vi.fn().mockResolvedValue({ id: "issue-123", title: "New Issue" }),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    beforeEach(() => {
      mockDb._mocks.queryFindFirst.mockResolvedValue(mockToolBlock);
      mockDb._mocks.selectLimit.mockResolvedValue([mockMcpRecord]);
      vi.mocked(connectMcpServer).mockResolvedValue(mockMcpConnection as any);
    });

    it("successfully executes an OAuth MCP tool", async () => {
      // First query returns MCP record, second returns OAuth details
      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockMcpRecord])
        .mockResolvedValueOnce([mockOAuthDetails]);

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "linear__create_issue",
        { title: "New Issue" },
        "mcp-123"
      );

      // Verify MCP connection was established
      expect(connectMcpServer).toHaveBeenCalledWith({
        name: "Linear",
        url: "https://linear-mcp.example.com",
        authToken: "access-token-xyz",
      });

      // Verify tool was executed
      expect(mockMcpConnection.execute).toHaveBeenCalledWith(
        "linear__create_issue",
        { title: "New Issue" }
      );

      // Verify connection was disconnected
      expect(mockMcpConnection.disconnect).toHaveBeenCalled();

      // Verify tool_result block was created
      expect(mockDb.insert).toHaveBeenCalled();
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.type).toBe("tool_result");
      expect(insertCall.content.is_error).toBe(false);

      // Verify agent loop queue was called
      expect(addToAgentLoopQueue).toHaveBeenCalled();
    });

    it("successfully executes a Composio MCP tool", async () => {
      const composioMcp = {
        ...mockMcpRecord,
        integration_type: "composio",
      };

      mockDb._mocks.selectLimit.mockResolvedValue([composioMcp]);

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "gmail__send_email",
        { to: "test@example.com" },
        "mcp-123"
      );

      // Verify MCP connection was established without auth token for Composio
      expect(connectMcpServer).toHaveBeenCalledWith({
        name: "Linear",
        url: "https://composio-url.example.com",
        authToken: undefined,
      });

      // Verify tool was executed and disconnected
      expect(mockMcpConnection.execute).toHaveBeenCalled();
      expect(mockMcpConnection.disconnect).toHaveBeenCalled();
    });

    it("throws error when tool block is not found", async () => {
      mockDb._mocks.queryFindFirst.mockResolvedValue(null);

      await expect(
        service.executeMcpTool(
          "task-123",
          "turn-456",
          "nonexistent-block",
          "tool",
          {},
          "mcp-123"
        )
      ).rejects.toThrow("Tool block not found: nonexistent-block");
    });

    it("handles MCP not found error gracefully", async () => {
      mockDb._mocks.selectLimit.mockResolvedValue([]);

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "linear__create_issue",
        {},
        "nonexistent-mcp"
      );

      // Verify error was captured in tool_result
      expect(mockDb.insert).toHaveBeenCalled();
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.is_error).toBe(true);
      expect(insertCall.content.content).toContain("MCP not found");
    });

    it("handles OAuth server URL not found error", async () => {
      const mcpWithNoServerUrl = {
        ...mockMcpRecord,
        mcp_store_id: null,
        custom_mcp_server_url: null,
      };

      mockDb._mocks.selectLimit.mockResolvedValue([mcpWithNoServerUrl]);

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "linear__create_issue",
        {},
        "mcp-123"
      );

      // Verify error was captured
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.is_error).toBe(true);
      expect(insertCall.content.content).toContain("No server URL found");
    });

    it("uses custom_mcp_server_url when mcp_store_id is not present", async () => {
      const customMcp = {
        ...mockMcpRecord,
        mcp_store_id: null,
        custom_mcp_server_url: "https://custom-mcp.example.com",
      };

      mockDb._mocks.selectLimit.mockResolvedValue([customMcp]);

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "custom__tool",
        {},
        "mcp-123"
      );

      expect(connectMcpServer).toHaveBeenCalledWith({
        name: "Linear",
        url: "https://custom-mcp.example.com",
        authToken: "access-token-xyz",
      });
    });

    it("handles missing access token error", async () => {
      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockMcpRecord])
        .mockResolvedValueOnce([mockOAuthDetails]);

      // Return null access token
      mockOAuthServiceInstance.getAccessToken.mockResolvedValue(null);

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "linear__create_issue",
        {},
        "mcp-123"
      );

      // Verify error was captured
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.is_error).toBe(true);
      expect(insertCall.content.content).toContain("No access token found");
    });

    it("handles Composio connection URL not found error", async () => {
      const composioMcp = {
        ...mockMcpRecord,
        integration_type: "composio",
      };

      mockDb._mocks.selectLimit.mockResolvedValue([composioMcp]);

      // Return null connection URL
      mockComposioServiceInstance.getConnectionUrl.mockResolvedValue(null);

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "gmail__send_email",
        {},
        "mcp-123"
      );

      // Verify error was captured
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.is_error).toBe(true);
      expect(insertCall.content.content).toContain("No Composio connection URL found");
    });

    it("handles MCP tool execution error gracefully", async () => {
      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockMcpRecord])
        .mockResolvedValueOnce([mockOAuthDetails]);

      mockMcpConnection.execute.mockRejectedValue(new Error("MCP execution failed"));

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "linear__create_issue",
        {},
        "mcp-123"
      );

      // Verify connection was still disconnected
      expect(mockMcpConnection.disconnect).toHaveBeenCalled();

      // Verify error was captured in tool_result
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.is_error).toBe(true);
      expect(insertCall.content.content).toContain("MCP execution failed");
    });

    it("handles MCP connection error gracefully", async () => {
      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockMcpRecord])
        .mockResolvedValueOnce([mockOAuthDetails]);

      vi.mocked(connectMcpServer).mockRejectedValue(new Error("Connection failed"));

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "linear__create_issue",
        {},
        "mcp-123"
      );

      // Verify error was captured in tool_result
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.is_error).toBe(true);
      expect(insertCall.content.content).toContain("Connection failed");
    });

    it("handles string result from MCP tool", async () => {
      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockMcpRecord])
        .mockResolvedValueOnce([mockOAuthDetails]);

      mockMcpConnection.execute.mockResolvedValue("Plain string result");

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "linear__create_issue",
        {},
        "mcp-123"
      );

      // Verify string result is stored directly (not JSON stringified again)
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.content).toBe("Plain string result");
    });

    it("JSON stringifies object results from MCP tool", async () => {
      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockMcpRecord])
        .mockResolvedValueOnce([mockOAuthDetails]);

      const objectResult = { id: "123", status: "created" };
      mockMcpConnection.execute.mockResolvedValue(objectResult);

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "linear__create_issue",
        {},
        "mcp-123"
      );

      // Verify object result is JSON stringified
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.content).toBe(JSON.stringify(objectResult));
    });

    it("handles non-Error thrown values in MCP execution", async () => {
      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockMcpRecord])
        .mockResolvedValueOnce([mockOAuthDetails]);

      mockMcpConnection.execute.mockRejectedValue("string error message");

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "linear__create_issue",
        {},
        "mcp-123"
      );

      // Verify string error was captured
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.is_error).toBe(true);
      expect(insertCall.content.content).toBe("string error message");
    });

    it("marks tool_use block as completed after execution", async () => {
      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockMcpRecord])
        .mockResolvedValueOnce([mockOAuthDetails]);

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "linear__create_issue",
        {},
        "mcp-123"
      );

      // Verify update was called to mark block as completed
      expect(mockDb.update).toHaveBeenCalled();
      const updateCall = mockDb._mocks.updateSet.mock.calls[0][0];
      expect(updateCall.status).toBe("completed");
      expect(updateCall.updated_at).toBeInstanceOf(Date);
    });

    it("adds job to agent loop queue with correct parameters", async () => {
      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockMcpRecord])
        .mockResolvedValueOnce([mockOAuthDetails]);

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "linear__create_issue",
        {},
        "mcp-123"
      );

      expect(addToAgentLoopQueue).toHaveBeenCalledWith({
        task_id: "task-123",
        turn_id: "turn-456",
        block_id: expect.any(String),
      });
    });

    it("handles MCP with undefined integration type", async () => {
      const mcpWithNoType = {
        ...mockMcpRecord,
        integration_type: undefined,
      };

      mockDb._mocks.selectLimit.mockResolvedValue([mcpWithNoType]);

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "tool",
        {},
        "mcp-123"
      );

      // Verify error was captured because no server URL could be determined
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.is_error).toBe(true);
      expect(insertCall.content.content).toContain("No server URL found");
    });
  });

  describe("executeToolOnMcp (private method via executeMcpTool)", () => {
    const mockToolBlock = {
      id: "block-123",
      turn_id: "turn-456",
      type: "tool_use",
      content: {
        type: "tool_use",
        id: "toolu_01mcp123",
        name: "tool",
        input: {},
      },
    };

    beforeEach(() => {
      mockDb._mocks.queryFindFirst.mockResolvedValue(mockToolBlock);
    });

    it("ensures disconnect is called even when execute throws", async () => {
      const mockMcp = {
        id: "mcp-123",
        name: "TestMCP",
        integration_type: "oauth",
        mcp_store_id: "store-123",
        custom_mcp_server_url: null,
      };

      const mockOAuthDetails = {
        mcp_store_id: "store-123",
        mcp_server_url: "https://test-mcp.example.com",
      };

      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockMcp])
        .mockResolvedValueOnce([mockOAuthDetails]);

      const localMockConnection = {
        execute: vi.fn().mockRejectedValue(new Error("Execute failed")),
        disconnect: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(connectMcpServer).mockResolvedValue(localMockConnection as any);
      mockOAuthServiceInstance.getAccessToken.mockResolvedValue("token");

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "tool",
        {},
        "mcp-123"
      );

      // Disconnect should still be called
      expect(localMockConnection.disconnect).toHaveBeenCalled();
    });

    it("fetches OAuth details from mcp_store_id", async () => {
      const mockMcp = {
        id: "mcp-123",
        name: "TestMCP",
        integration_type: "oauth",
        mcp_store_id: "store-id-abc",
        custom_mcp_server_url: null,
      };

      const mockOAuthDetails = {
        mcp_store_id: "store-id-abc",
        mcp_server_url: "https://oauth-mcp.example.com",
      };

      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockMcp])
        .mockResolvedValueOnce([mockOAuthDetails]);

      const localMockConnection = {
        execute: vi.fn().mockResolvedValue("result"),
        disconnect: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(connectMcpServer).mockResolvedValue(localMockConnection as any);
      mockOAuthServiceInstance.getAccessToken.mockResolvedValue("token-xyz");

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "tool",
        {},
        "mcp-123"
      );

      // Verify the correct URL was used
      expect(connectMcpServer).toHaveBeenCalledWith({
        name: "TestMCP",
        url: "https://oauth-mcp.example.com",
        authToken: "token-xyz",
      });
    });

    it("handles missing OAuth details for store MCP", async () => {
      const mockMcp = {
        id: "mcp-123",
        name: "TestMCP",
        integration_type: "oauth",
        mcp_store_id: "store-id-abc",
        custom_mcp_server_url: null,
      };

      mockDb._mocks.selectLimit
        .mockResolvedValueOnce([mockMcp])
        .mockResolvedValueOnce([]); // No OAuth details found

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "tool",
        {},
        "mcp-123"
      );

      // Verify error was captured
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.is_error).toBe(true);
      expect(insertCall.content.content).toContain("No server URL found");
    });
  });

  describe("tool result block creation", () => {
    const mockToolBlock = {
      id: "block-123",
      turn_id: "turn-456",
      type: "tool_use",
      content: {
        type: "tool_use",
        id: "toolu_unique_id",
        name: "test_tool",
        input: {},
      },
    };

    const mockServerTool = {
      name: "test_tool",
      version: "1.0.0",
      description: "Test tool",
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      execute: vi.fn().mockResolvedValue({ result: "success" }),
    };

    beforeEach(() => {
      mockDb._mocks.queryFindFirst.mockResolvedValue(mockToolBlock);
      vi.mocked(getServerTool).mockReturnValue(mockServerTool as any);
    });

    it("creates tool_result block with correct structure", async () => {
      await service.executeServerTool(
        "task-123",
        "turn-456",
        "block-123",
        "test_tool",
        {}
      );

      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];

      // Verify block structure
      expect(insertCall.id).toBeDefined();
      expect(insertCall.turn_id).toBe("turn-456");
      expect(insertCall.type).toBe("tool_result");
      expect(insertCall.status).toBe("none");
      expect(insertCall.complete).toBe(true);
      expect(insertCall.processed).toBe(false);
      expect(insertCall.created_at).toBeInstanceOf(Date);
      expect(insertCall.updated_at).toBeInstanceOf(Date);
    });

    it("preserves tool_use_id in tool_result content", async () => {
      await service.executeServerTool(
        "task-123",
        "turn-456",
        "block-123",
        "test_tool",
        {}
      );

      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.tool_use_id).toBe("toolu_unique_id");
    });

    it("generates unique block IDs for each execution", async () => {
      await service.executeServerTool("task-1", "turn-1", "block-123", "test_tool", {});
      await service.executeServerTool("task-2", "turn-2", "block-123", "test_tool", {});

      const firstBlockId = mockDb._mocks.insertValues.mock.calls[0][0].id;
      const secondBlockId = mockDb._mocks.insertValues.mock.calls[1][0].id;

      expect(firstBlockId).not.toBe(secondBlockId);
    });
  });
});
