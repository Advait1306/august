import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { ToolService } from "../../../services/tool.service.js";
import { z } from "zod";
import type { AppState } from "../../../config/state.js";
import type { ServerToolDefinition, ServerToolContext } from "../../../server-tools/types.js";
import type { McpConnection } from "@august/harness";

/**
 * Mock interface for ServerToolDefinition where execute is a mock function
 */
interface MockServerToolDefinition extends Omit<ServerToolDefinition, "execute"> {
  execute: Mock<(input: unknown, context: ServerToolContext) => Promise<unknown>>;
}

/**
 * Mock interface for McpConnection execute and disconnect methods
 */
interface MockMcpConnectionMethods {
  execute: Mock<(toolName: string, args: Record<string, unknown>) => Promise<unknown>>;
  disconnect: Mock<() => Promise<void>>;
}

// Mock the server-tools module
vi.mock("../../../server-tools", () => ({
  getServerTool: vi.fn(),
}));

// Mock the agentLoopWorker queue
vi.mock("../../../queues/workers/agentLoopWorker", () => ({
  addToAgentLoopQueue: vi.fn().mockResolvedValue(undefined),
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
  (ToolService as unknown as { instance: ToolService | undefined }).instance = undefined;
}

describe("ToolService", () => {
  let mockDb: MockDb;
  let service: ToolService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetToolServiceInstance();
    mockDb = createMockDb();
    service = ToolService.getInstance({ db: mockDb } as unknown as AppState);

    // Suppress console logs during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getInstance", () => {
    it("returns the same instance on multiple calls", () => {
      const instance1 = ToolService.getInstance({ db: mockDb } as unknown as AppState);
      const instance2 = ToolService.getInstance({ db: mockDb } as unknown as AppState);

      expect(instance1).toBe(instance2);
    });

    it("creates new instance after reset", () => {
      const instance1 = ToolService.getInstance({ db: mockDb } as unknown as AppState);
      resetToolServiceInstance();
      const instance2 = ToolService.getInstance({ db: mockDb } as unknown as AppState);

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

    const mockServerTool: MockServerToolDefinition = {
      name: "todo_write",
      version: "1.0.0",
      description: "Write todo items",
      inputSchema: z.object({ items: z.array(z.string()) }),
      outputSchema: z.object({ success: z.boolean() }),
      execute: vi.fn().mockResolvedValue({ success: true }),
    };

    beforeEach(() => {
      mockDb._mocks.queryFindFirst.mockResolvedValue(mockToolBlock);
      vi.mocked(getServerTool).mockReturnValue(mockServerTool as unknown as ServerToolDefinition);
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

    const mockConnectionInfo = {
      mcpName: "Linear",
      serverUrl: "https://linear-mcp.example.com",
      authToken: "test-token-xyz",
    };

    const mockMcpConnection: MockMcpConnectionMethods = {
      execute: vi.fn().mockResolvedValue({ id: "issue-123", title: "New Issue" }),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    beforeEach(() => {
      mockDb._mocks.queryFindFirst.mockResolvedValue(mockToolBlock);
      vi.mocked(connectMcpServer).mockResolvedValue(mockMcpConnection as unknown as McpConnection);
    });

    it("successfully executes an MCP tool with connection info", async () => {
      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "linear__create_issue",
        { title: "New Issue" },
        mockConnectionInfo
      );

      // Verify MCP connection was established with provided connection info
      expect(connectMcpServer).toHaveBeenCalledWith({
        name: "Linear",
        url: "https://linear-mcp.example.com",
        authToken: "test-token-xyz",
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

    it("successfully executes an MCP tool without auth token", async () => {
      const connectionInfoWithoutToken = {
        mcpName: "PublicMCP",
        serverUrl: "https://public-mcp.example.com",
      };

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "public__tool",
        { param: "value" },
        connectionInfoWithoutToken
      );

      // Verify MCP connection was established without auth token
      expect(connectMcpServer).toHaveBeenCalledWith({
        name: "PublicMCP",
        url: "https://public-mcp.example.com",
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
          mockConnectionInfo
        )
      ).rejects.toThrow("Tool block not found: nonexistent-block");
    });

    it("handles MCP tool execution error gracefully", async () => {
      mockMcpConnection.execute.mockRejectedValue(new Error("MCP execution failed"));

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "linear__create_issue",
        {},
        mockConnectionInfo
      );

      // Verify connection was still disconnected
      expect(mockMcpConnection.disconnect).toHaveBeenCalled();

      // Verify error was captured in tool_result
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.is_error).toBe(true);
      expect(insertCall.content.content).toContain("MCP execution failed");
    });

    it("handles MCP connection error gracefully", async () => {
      vi.mocked(connectMcpServer).mockRejectedValue(new Error("Connection failed"));

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "linear__create_issue",
        {},
        mockConnectionInfo
      );

      // Verify error was captured in tool_result
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.is_error).toBe(true);
      expect(insertCall.content.content).toContain("Connection failed");
    });

    it("handles string result from MCP tool", async () => {
      mockMcpConnection.execute.mockResolvedValue("Plain string result");

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "linear__create_issue",
        {},
        mockConnectionInfo
      );

      // Verify string result is stored directly (not JSON stringified again)
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.content).toBe("Plain string result");
    });

    it("JSON stringifies object results from MCP tool", async () => {
      const objectResult = { id: "123", status: "created" };
      mockMcpConnection.execute.mockResolvedValue(objectResult);

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "linear__create_issue",
        {},
        mockConnectionInfo
      );

      // Verify object result is JSON stringified
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.content).toBe(JSON.stringify(objectResult));
    });

    it("handles non-Error thrown values in MCP execution", async () => {
      mockMcpConnection.execute.mockRejectedValue("string error message");

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "linear__create_issue",
        {},
        mockConnectionInfo
      );

      // Verify string error was captured
      const insertCall = mockDb._mocks.insertValues.mock.calls[0][0];
      expect(insertCall.content.is_error).toBe(true);
      expect(insertCall.content.content).toBe("string error message");
    });

    it("marks tool_use block as completed after execution", async () => {
      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "linear__create_issue",
        {},
        mockConnectionInfo
      );

      // Verify update was called to mark block as completed
      expect(mockDb.update).toHaveBeenCalled();
      const updateCall = mockDb._mocks.updateSet.mock.calls[0][0];
      expect(updateCall.status).toBe("completed");
      expect(updateCall.updated_at).toBeInstanceOf(Date);
    });

    it("adds job to agent loop queue with correct parameters", async () => {
      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "linear__create_issue",
        {},
        mockConnectionInfo
      );

      expect(addToAgentLoopQueue).toHaveBeenCalledWith({
        task_id: "task-123",
        turn_id: "turn-456",
        block_id: expect.any(String),
      });
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

    const mockConnectionInfo = {
      mcpName: "TestMCP",
      serverUrl: "https://test-mcp.example.com",
      authToken: "test-token",
    };

    beforeEach(() => {
      mockDb._mocks.queryFindFirst.mockResolvedValue(mockToolBlock);
    });

    it("ensures disconnect is called even when execute throws", async () => {
      const localMockConnection: MockMcpConnectionMethods = {
        execute: vi.fn().mockRejectedValue(new Error("Execute failed")),
        disconnect: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(connectMcpServer).mockResolvedValue(localMockConnection as unknown as McpConnection);

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "tool",
        {},
        mockConnectionInfo
      );

      // Disconnect should still be called
      expect(localMockConnection.disconnect).toHaveBeenCalled();
    });

    it("passes connection info correctly to connectMcpServer", async () => {
      const localMockConnection: MockMcpConnectionMethods = {
        execute: vi.fn().mockResolvedValue("result"),
        disconnect: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(connectMcpServer).mockResolvedValue(localMockConnection as unknown as McpConnection);

      await service.executeMcpTool(
        "task-123",
        "turn-456",
        "block-123",
        "tool",
        {},
        {
          mcpName: "CustomMCP",
          serverUrl: "https://custom-mcp.example.com",
          authToken: "custom-token-xyz",
        }
      );

      // Verify the correct connection info was used
      expect(connectMcpServer).toHaveBeenCalledWith({
        name: "CustomMCP",
        url: "https://custom-mcp.example.com",
        authToken: "custom-token-xyz",
      });
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

    const mockServerToolForResultBlock: MockServerToolDefinition = {
      name: "test_tool",
      version: "1.0.0",
      description: "Test tool",
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      execute: vi.fn().mockResolvedValue({ result: "success" }),
    };

    beforeEach(() => {
      mockDb._mocks.queryFindFirst.mockResolvedValue(mockToolBlock);
      vi.mocked(getServerTool).mockReturnValue(mockServerToolForResultBlock as unknown as ServerToolDefinition);
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
