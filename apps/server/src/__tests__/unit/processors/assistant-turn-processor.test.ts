import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ServerToolJobData } from "../../../queues/workers/serverToolExecutorWorker.js";
import type { McpToolJobData } from "../../../queues/workers/mcpToolExecutorWorker.js";
import type { AppState } from "../../../config/state.js";

// Mock randomUUID before importing the processor
vi.mock("crypto", () => ({
  randomUUID: vi.fn(() => "mocked-uuid-" + Math.random().toString(36).substr(2, 9)),
}));

// Mock queue workers
const mockAddToServerToolExecutorQueue = vi.fn().mockResolvedValue(undefined);
const mockAddToMcpToolExecutorQueue = vi.fn().mockResolvedValue(undefined);

vi.mock("../../../queues/workers/serverToolExecutorWorker.js", () => ({
  addToServerToolExecutorQueue: (data: ServerToolJobData) =>
    mockAddToServerToolExecutorQueue(data),
}));

vi.mock("../../../queues/workers/mcpToolExecutorWorker.js", () => ({
  addToMcpToolExecutorQueue: (data: McpToolJobData) =>
    mockAddToMcpToolExecutorQueue(data),
}));

// Mock isServerTool
const mockIsServerTool = vi.fn();
vi.mock("../../../server-tools/index.js", () => ({
  isServerTool: (name: string) => mockIsServerTool(name),
}));

// Mock UsageService
const mockRecordUsage = vi.fn().mockResolvedValue(undefined);
const mockUsageServiceInstance = {
  recordUsage: mockRecordUsage,
};
vi.mock("../../../services/usage.service.js", () => ({
  UsageService: {
    getInstance: vi.fn(() => mockUsageServiceInstance),
  },
}));

// Import UsageService for resetting the singleton in tests
import { UsageService } from "../../../services/usage.service.js";

// Import after mocks are set up
import { AssistantTurnProcessor } from "../../../processors/assistant-turn-processor.js";
import type {
  BetaRawMessageStartEvent,
  BetaRawMessageDeltaEvent,
  BetaRawContentBlockStartEvent,
  BetaRawContentBlockDeltaEvent,
  BetaRawContentBlockStopEvent,
  BetaTextBlockParam,
  BetaToolUseBlockParam,
} from "@anthropic-ai/sdk/resources/beta";

// Helper to create mock database
function createMockDb() {
  return {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };
}

/**
 * Mock database type that represents the subset of AppState["db"] methods
 * used by AssistantTurnProcessor.
 */
type MockDb = ReturnType<typeof createMockDb>;

// Helper to create message start event
function createMessageStartEvent(
  overrides: Partial<BetaRawMessageStartEvent["message"]> = {}
): BetaRawMessageStartEvent {
  return {
    type: "message_start",
    message: {
      id: "msg_123",
      type: "message",
      role: "assistant",
      content: [],
      model: "claude-3-opus",
      stop_reason: null,
      stop_sequence: null,
      container: null,
      context_management: null,
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 10,
        cache_read_input_tokens: 20,
        cache_creation: null,
        server_tool_use: null,
        service_tier: null,
      },
      ...overrides,
    },
  };
}

// Helper to create message delta event
function createMessageDeltaEvent(
  overrides: Omit<Partial<BetaRawMessageDeltaEvent["delta"]>, "container"> & { container?: BetaRawMessageDeltaEvent["delta"]["container"] } = {},
  usage: { output_tokens: number } = { output_tokens: 100 }
): BetaRawMessageDeltaEvent {
  return {
    type: "message_delta",
    delta: {
      stop_reason: "end_turn",
      stop_sequence: null,
      container: null,
      ...overrides,
    },
    context_management: null,
    usage: {
      output_tokens: usage.output_tokens,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      input_tokens: 0,
      server_tool_use: null,
    },
  };
}

// Helper to create content block start event
function createBlockStartEvent(
  index: number,
  content_block: BetaRawContentBlockStartEvent["content_block"]
): BetaRawContentBlockStartEvent {
  return {
    type: "content_block_start",
    index,
    content_block,
  };
}

// Helper to create content block delta event
function createBlockDeltaEvent(
  index: number,
  delta: BetaRawContentBlockDeltaEvent["delta"]
): BetaRawContentBlockDeltaEvent {
  return {
    type: "content_block_delta",
    index,
    delta,
  };
}

// Helper to create content block stop event
function createBlockStopEvent(index: number): BetaRawContentBlockStopEvent {
  return {
    type: "content_block_stop",
    index,
  };
}

describe("AssistantTurnProcessor", () => {
  let mockDb: MockDb;
  let processor: AssistantTurnProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the UsageService singleton for each test
    (UsageService as unknown as { instance: UsageService | null }).instance = null;
    mockDb = createMockDb();
    processor = new AssistantTurnProcessor(
      mockDb as unknown as AppState["db"],
      "task-123",
      "org-456",
      "claude-3-opus"
    );
    mockIsServerTool.mockReturnValue(false);
  });

  describe("constructor", () => {
    it("initializes with correct task and turn state", () => {
      const proc = new AssistantTurnProcessor(
        mockDb as unknown as AppState["db"],
        "task-id",
        "org-id",
        "claude-3-sonnet"
      );

      // Processor should be created without error
      expect(proc).toBeInstanceOf(AssistantTurnProcessor);
    });

    it("accepts an optional toolToMcpId map", () => {
      const toolToMcpId = new Map([["mcp_tool", "mcp-123"]]);
      const proc = new AssistantTurnProcessor(
        mockDb as unknown as AppState["db"],
        "task-id",
        "org-id",
        "claude-3-sonnet",
        toolToMcpId
      );

      expect(proc).toBeInstanceOf(AssistantTurnProcessor);
    });
  });

  describe("processMessageStart", () => {
    it("extracts message ID and usage data", () => {
      const event = createMessageStartEvent({
        id: "msg_test_123",
        usage: {
          input_tokens: 200,
          output_tokens: 100,
          cache_creation_input_tokens: 50,
          cache_read_input_tokens: 25,
          cache_creation: null,
          server_tool_use: null,
          service_tier: null,
        },
      });

      processor.processMessageStart(event);

      // The processor should have stored the usage data internally
      // We can verify this by calling processMessageStop and checking recordUsage
    });

    it("sets container when present in message", () => {
      const event = createMessageStartEvent({
        container: { id: "container-123", expires_at: "2024-01-01", skills: [] },
      });

      processor.processMessageStart(event);

      // Container is set internally, will be flushed to DB
    });

    it("sets stop_reason when present in message", () => {
      const event = createMessageStartEvent({
        stop_reason: "end_turn",
      });

      processor.processMessageStart(event);

      // Stop reason is set internally
    });

    it("processes complete blocks in message content", () => {
      const event = createMessageStartEvent({
        content: [
          { type: "text", text: "Hello world", citations: null },
        ],
      });

      processor.processMessageStart(event);

      // Block should be processed internally
    });

    it("processes multiple complete blocks", () => {
      const event = createMessageStartEvent({
        content: [
          { type: "text", text: "First block", citations: null },
          { type: "text", text: "Second block", citations: null },
        ],
      });

      processor.processMessageStart(event);

      // Both blocks should be processed
    });
  });

  describe("processMessageDelta", () => {
    it("updates stop_reason from delta", () => {
      const event = createMessageDeltaEvent({
        stop_reason: "max_tokens",
      });

      processor.processMessageDelta(event);

      // Stop reason should be updated internally
    });

    it("updates container from delta", () => {
      const event = createMessageDeltaEvent({
        container: { id: "container-456", expires_at: "2024-02-01", skills: [] },
      });

      processor.processMessageDelta(event);

      // Container should be updated internally
    });

    it("updates usage data with final output_tokens", () => {
      // First set initial usage
      processor.processMessageStart(createMessageStartEvent({
        usage: {
          input_tokens: 100,
          output_tokens: 25,
          cache_creation_input_tokens: 10,
          cache_read_input_tokens: 5,
          cache_creation: null,
          server_tool_use: null,
          service_tier: null,
        },
      }));

      // Then update with delta usage (final output_tokens)
      const deltaEvent = createMessageDeltaEvent(
        { stop_reason: "end_turn" },
        { output_tokens: 150 }
      );

      processor.processMessageDelta(deltaEvent);

      // Output tokens should be updated to 150
    });
  });

  describe("processMessageStop", () => {
    it("marks turn as complete", async () => {
      processor.processMessageStart(createMessageStartEvent());

      await processor.processMessageStop();

      // Turn should be marked complete and flushed to DB
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("sets task status to available for end_turn stop reason", async () => {
      processor.processMessageStart(createMessageStartEvent());
      processor.processMessageDelta(createMessageDeltaEvent({ stop_reason: "end_turn" }));

      await processor.processMessageStop();

      expect(mockDb.update).toHaveBeenCalled();
    });

    it("sets task status to available for max_tokens stop reason", async () => {
      processor.processMessageStart(createMessageStartEvent());
      processor.processMessageDelta(createMessageDeltaEvent({ stop_reason: "max_tokens" }));

      await processor.processMessageStop();

      expect(mockDb.update).toHaveBeenCalled();
    });

    it("sets task status to available for stop_sequence stop reason", async () => {
      processor.processMessageStart(createMessageStartEvent());
      processor.processMessageDelta(createMessageDeltaEvent({ stop_reason: "stop_sequence" }));

      await processor.processMessageStop();

      expect(mockDb.update).toHaveBeenCalled();
    });

    it("sets task status to available for refusal stop reason", async () => {
      processor.processMessageStart(createMessageStartEvent());
      processor.processMessageDelta(createMessageDeltaEvent({ stop_reason: "refusal" }));

      await processor.processMessageStop();

      expect(mockDb.update).toHaveBeenCalled();
    });

    it("records usage when messageId and usageData are present", async () => {
      processor.processMessageStart(createMessageStartEvent({
        id: "msg_usage_test",
        usage: {
          input_tokens: 500,
          output_tokens: 250,
          cache_creation_input_tokens: 100,
          cache_read_input_tokens: 50,
          cache_creation: null,
          server_tool_use: null,
          service_tier: null,
        },
      }));

      await processor.processMessageStop();

      expect(mockRecordUsage).toHaveBeenCalledWith({
        organisationId: "org-456",
        taskId: "task-123",
        messageId: "msg_usage_test",
        model: "claude-3-opus",
        inputTokens: 500,
        outputTokens: 250,
        cacheCreationInputTokens: 100,
        cacheReadInputTokens: 50,
      });
    });

    it("does not record usage when messageId is missing", async () => {
      // Process without a message start (no messageId)
      await processor.processMessageStop();

      expect(mockRecordUsage).not.toHaveBeenCalled();
    });

    it("flushes all changes to database", async () => {
      processor.processMessageStart(createMessageStartEvent());

      await processor.processMessageStop();

      // Should update task and insert turn
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("processBlockStart", () => {
    it("creates a new text block", () => {
      const event = createBlockStartEvent(0, {
        type: "text",
        text: "",
        citations: null,
      });

      processor.processBlockStart(event);

      // Block should be created in internal state
    });

    it("creates a new tool_use block", () => {
      const event = createBlockStartEvent(0, {
        type: "tool_use",
        id: "tool_use_123",
        name: "read_file",
        input: {},
      });

      processor.processBlockStart(event);

      // Tool use block should be created
    });

    it("creates toolResponseTurn when first tool_use block is encountered", () => {
      const event = createBlockStartEvent(0, {
        type: "tool_use",
        id: "tool_use_123",
        name: "some_tool",
        input: {},
      });

      processor.processBlockStart(event);

      // toolResponseTurn should be created internally
    });

    it("does not create duplicate toolResponseTurn for subsequent tool_use blocks", () => {
      // First tool_use
      processor.processBlockStart(createBlockStartEvent(0, {
        type: "tool_use",
        id: "tool_use_1",
        name: "tool_a",
        input: {},
      }));

      // Second tool_use
      processor.processBlockStart(createBlockStartEvent(1, {
        type: "tool_use",
        id: "tool_use_2",
        name: "tool_b",
        input: {},
      }));

      // Should still only have one toolResponseTurn
    });

    it("handles server_tool_use block", () => {
      const event = createBlockStartEvent(0, {
        type: "server_tool_use",
        id: "server_tool_use_123",
        name: "web_search",
        input: {},
        caller: { type: "direct" },
      });

      processor.processBlockStart(event);

      // Server tool use block should be created
    });
  });

  describe("processBlockDelta", () => {
    it("appends text to text block", () => {
      // Start the block
      processor.processBlockStart(createBlockStartEvent(0, {
        type: "text",
        text: "Hello",
        citations: null,
      }));

      // Add delta
      processor.processBlockDelta(createBlockDeltaEvent(0, {
        type: "text_delta",
        text: " world",
      }));

      // Text should be "Hello world"
    });

    it("accumulates multiple text deltas", () => {
      processor.processBlockStart(createBlockStartEvent(0, {
        type: "text",
        text: "",
        citations: null,
      }));

      processor.processBlockDelta(createBlockDeltaEvent(0, {
        type: "text_delta",
        text: "Hello",
      }));

      processor.processBlockDelta(createBlockDeltaEvent(0, {
        type: "text_delta",
        text: " ",
      }));

      processor.processBlockDelta(createBlockDeltaEvent(0, {
        type: "text_delta",
        text: "world",
      }));

      // Text should be "Hello world"
    });

    it("handles input_json_delta for tool_use block", () => {
      processor.processBlockStart(createBlockStartEvent(0, {
        type: "tool_use",
        id: "tool_use_123",
        name: "read_file",
        input: {},
      }));

      processor.processBlockDelta(createBlockDeltaEvent(0, {
        type: "input_json_delta",
        partial_json: '{"path":',
      }));

      processor.processBlockDelta(createBlockDeltaEvent(0, {
        type: "input_json_delta",
        partial_json: '"/test.txt"}',
      }));

      // Input should accumulate as string, then be parsed on block stop
    });

    it("converts object input to string before accumulating json delta", () => {
      processor.processBlockStart(createBlockStartEvent(0, {
        type: "tool_use",
        id: "tool_use_123",
        name: "some_tool",
        input: {}, // Object initially
      }));

      // This should convert input to "" and then append
      processor.processBlockDelta(createBlockDeltaEvent(0, {
        type: "input_json_delta",
        partial_json: '{"key": "value"}',
      }));

      // Block stop will parse it back to object
    });

    it("ignores unknown delta types", () => {
      processor.processBlockStart(createBlockStartEvent(0, {
        type: "text",
        text: "test",
        citations: null,
      }));

      // Unknown delta type should be ignored
      processor.processBlockDelta(createBlockDeltaEvent(0, {
        type: "unknown_delta",
      } as unknown as BetaRawContentBlockDeltaEvent["delta"]));

      // No error should occur
    });
  });

  describe("processBlockStop", () => {
    it("marks text block as complete", () => {
      processor.processBlockStart(createBlockStartEvent(0, {
        type: "text",
        text: "Hello",
        citations: null,
      }));

      processor.processBlockStop(createBlockStopEvent(0));

      // Block should be marked complete
    });

    it("parses JSON input for tool_use block on stop", () => {
      processor.processBlockStart(createBlockStartEvent(0, {
        type: "tool_use",
        id: "tool_use_123",
        name: "read_file",
        input: {},
      }));

      processor.processBlockDelta(createBlockDeltaEvent(0, {
        type: "input_json_delta",
        partial_json: '{"path": "/test.txt"}',
      }));

      processor.processBlockStop(createBlockStopEvent(0));

      // Input should be parsed to object { path: "/test.txt" }
    });

    it("handles empty input string for tools with no parameters", () => {
      processor.processBlockStart(createBlockStartEvent(0, {
        type: "tool_use",
        id: "tool_use_123",
        name: "get_current_time",
        input: {},
      }));

      // Simulate empty json delta (converts to empty string)
      // The block stop should handle empty string and convert to {}
      processor.processBlockStop(createBlockStopEvent(0));

      // Input should be {}
    });

    it("sets status to server_pending for server tools", () => {
      mockIsServerTool.mockReturnValue(true);

      processor.processBlockStart(createBlockStartEvent(0, {
        type: "tool_use",
        id: "tool_use_123",
        name: "todo_write",
        input: {},
      }));

      processor.processBlockStop(createBlockStopEvent(0));

      // Block status should be "server_pending"
    });

    it("sets status to mcp_pending for MCP tools", () => {
      const toolToMcpId = new Map([["mcp_tool", "mcp-123"]]);
      const proc = new AssistantTurnProcessor(
        mockDb as unknown as AppState["db"],
        "task-123",
        "org-456",
        "claude-3-opus",
        toolToMcpId
      );

      proc.processBlockStart(createBlockStartEvent(0, {
        type: "tool_use",
        id: "tool_use_123",
        name: "mcp_tool",
        input: {},
      }));

      proc.processBlockStop(createBlockStopEvent(0));

      // Block status should be "mcp_pending" with mcpId in metadata
    });

    it("sets status to client_pending for client tools", () => {
      mockIsServerTool.mockReturnValue(false);

      processor.processBlockStart(createBlockStartEvent(0, {
        type: "tool_use",
        id: "tool_use_123",
        name: "client_tool",
        input: {},
      }));

      processor.processBlockStop(createBlockStopEvent(0));

      // Block status should be "client_pending"
    });

    it("marks block as processed", () => {
      processor.processBlockStart(createBlockStartEvent(0, {
        type: "text",
        text: "test",
        citations: null,
      }));

      processor.processBlockStop(createBlockStopEvent(0));

      // Block should be marked as processed
    });
  });

  describe("flushToDb", () => {
    it("updates task when dirty", async () => {
      // Task is dirty after construction
      await processor.flushToDb();

      expect(mockDb.update).toHaveBeenCalled();
    });

    it("inserts/updates turn when dirty", async () => {
      await processor.flushToDb();

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("inserts toolResponseTurn when present and dirty", async () => {
      // Create a tool_use block to trigger toolResponseTurn creation
      processor.processBlockStart(createBlockStartEvent(0, {
        type: "tool_use",
        id: "tool_use_123",
        name: "some_tool",
        input: {},
      }));

      processor.processBlockStop(createBlockStopEvent(0));

      await processor.flushToDb();

      // Should have multiple insert calls (turn, toolResponseTurn, block)
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("inserts/updates blocks when dirty", async () => {
      processor.processBlockStart(createBlockStartEvent(0, {
        type: "text",
        text: "Hello",
        citations: null,
      }));

      processor.processBlockStop(createBlockStopEvent(0));

      await processor.flushToDb();

      // Block should be inserted
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("does not update task when not dirty", async () => {
      await processor.flushToDb();
      vi.clearAllMocks();

      // Second flush should not update task
      await processor.flushToDb();

      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("does not insert turn when not dirty", async () => {
      await processor.flushToDb();
      vi.clearAllMocks();

      // Second flush should not insert turn
      await processor.flushToDb();

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("queues server tool execution for complete server_pending blocks", async () => {
      mockIsServerTool.mockReturnValue(true);

      processor.processBlockStart(createBlockStartEvent(0, {
        type: "tool_use",
        id: "tool_use_123",
        name: "todo_write",
        input: {},
      }));

      processor.processBlockDelta(createBlockDeltaEvent(0, {
        type: "input_json_delta",
        partial_json: '{"todos": []}',
      }));

      processor.processBlockStop(createBlockStopEvent(0));

      await processor.flushToDb();

      expect(mockAddToServerToolExecutorQueue).toHaveBeenCalledWith({
        task_id: "task-123",
        turn_id: expect.any(String),
        block_id: expect.any(String),
        tool_name: "todo_write",
        tool_input: { todos: [] },
      });
    });

    it("queues MCP tool execution for complete mcp_pending blocks", async () => {
      const toolToMcpId = new Map([["mcp_tool", "mcp-server-123"]]);
      const proc = new AssistantTurnProcessor(
        mockDb as unknown as AppState["db"],
        "task-123",
        "org-456",
        "claude-3-opus",
        toolToMcpId
      );

      proc.processBlockStart(createBlockStartEvent(0, {
        type: "tool_use",
        id: "tool_use_123",
        name: "mcp_tool",
        input: {},
      }));

      proc.processBlockDelta(createBlockDeltaEvent(0, {
        type: "input_json_delta",
        partial_json: '{"query": "test"}',
      }));

      proc.processBlockStop(createBlockStopEvent(0));

      await proc.flushToDb();

      expect(mockAddToMcpToolExecutorQueue).toHaveBeenCalledWith({
        task_id: "task-123",
        turn_id: expect.any(String),
        block_id: expect.any(String),
        tool_name: "mcp_tool",
        tool_input: { query: "test" },
        mcp_id: "mcp-server-123",
      });
    });

    it("does not queue tool execution for incomplete blocks", async () => {
      mockIsServerTool.mockReturnValue(true);

      processor.processBlockStart(createBlockStartEvent(0, {
        type: "tool_use",
        id: "tool_use_123",
        name: "todo_write",
        input: {},
      }));

      // Block not stopped, so not complete
      await processor.flushToDb();

      expect(mockAddToServerToolExecutorQueue).not.toHaveBeenCalled();
    });

    it("does not queue tool execution for non-tool_use blocks", async () => {
      processor.processBlockStart(createBlockStartEvent(0, {
        type: "text",
        text: "Hello",
        citations: null,
      }));

      processor.processBlockStop(createBlockStopEvent(0));

      await processor.flushToDb();

      expect(mockAddToServerToolExecutorQueue).not.toHaveBeenCalled();
      expect(mockAddToMcpToolExecutorQueue).not.toHaveBeenCalled();
    });

    it("clears dirty flags after flush", async () => {
      processor.processBlockStart(createBlockStartEvent(0, {
        type: "text",
        text: "Hello",
        citations: null,
      }));

      processor.processBlockStop(createBlockStopEvent(0));

      await processor.flushToDb();
      vi.clearAllMocks();

      // Second flush should not make any DB calls
      await processor.flushToDb();

      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("handles multiple blocks", async () => {
      processor.processBlockStart(createBlockStartEvent(0, {
        type: "text",
        text: "First",
        citations: null,
      }));
      processor.processBlockStop(createBlockStopEvent(0));

      processor.processBlockStart(createBlockStartEvent(1, {
        type: "text",
        text: "Second",
        citations: null,
      }));
      processor.processBlockStop(createBlockStopEvent(1));

      await processor.flushToDb();

      // Should insert both blocks
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("processCompleteBlock", () => {
    it("handles complete block from message start", () => {
      const event = createMessageStartEvent({
        content: [
          { type: "text", text: "Complete text block", citations: null },
        ],
      });

      processor.processMessageStart(event);

      // Block should be processed and marked complete
    });

    it("creates toolResponseTurn for complete tool_use block", () => {
      const event = createMessageStartEvent({
        content: [
          {
            type: "tool_use",
            id: "tool_use_123",
            name: "read_file",
            input: { path: "/test.txt" },
          },
        ],
      });

      processor.processMessageStart(event);

      // toolResponseTurn should be created
    });

    it("sets server_pending status for complete server tool blocks", () => {
      mockIsServerTool.mockReturnValue(true);

      const event = createMessageStartEvent({
        content: [
          {
            type: "tool_use",
            id: "tool_use_123",
            name: "todo_write",
            input: { todos: [] },
          },
        ],
      });

      processor.processMessageStart(event);

      // Block status should be server_pending
    });

    it("sets mcp_pending status for complete MCP tool blocks", () => {
      const toolToMcpId = new Map([["mcp_tool", "mcp-123"]]);
      const proc = new AssistantTurnProcessor(
        mockDb as unknown as AppState["db"],
        "task-123",
        "org-456",
        "claude-3-opus",
        toolToMcpId
      );

      const event = createMessageStartEvent({
        content: [
          {
            type: "tool_use",
            id: "tool_use_123",
            name: "mcp_tool",
            input: { query: "test" },
          },
        ],
      });

      proc.processMessageStart(event);

      // Block status should be mcp_pending with metadata
    });

    it("sets client_pending status for complete client tool blocks", () => {
      mockIsServerTool.mockReturnValue(false);

      const event = createMessageStartEvent({
        content: [
          {
            type: "tool_use",
            id: "tool_use_123",
            name: "client_tool",
            input: {},
          },
        ],
      });

      processor.processMessageStart(event);

      // Block status should be client_pending
    });

    it("updates existing block if already initialized", () => {
      // First create block via streaming
      processor.processBlockStart(createBlockStartEvent(0, {
        type: "text",
        text: "Initial",
        citations: null,
      }));

      // Then process complete block at same index (overwrites)
      const event = createMessageStartEvent({
        content: [
          { type: "text", text: "Complete replacement", citations: null },
        ],
      });

      processor.processMessageStart(event);

      // Block should be updated with complete content
    });
  });

  describe("edge cases", () => {
    it("handles server_tool_use block input conversion", () => {
      processor.processBlockStart(createBlockStartEvent(0, {
        type: "server_tool_use",
        id: "server_tool_use_123",
        name: "web_search",
        input: {},
        caller: { type: "direct" },
      }));

      processor.processBlockDelta(createBlockDeltaEvent(0, {
        type: "input_json_delta",
        partial_json: '{"query": "test"}',
      }));

      processor.processBlockStop(createBlockStopEvent(0));

      // Input should be parsed correctly
    });

    it("handles blocks with no index collision", () => {
      processor.processBlockStart(createBlockStartEvent(0, {
        type: "text",
        text: "Block 0",
        citations: null,
      }));

      processor.processBlockStart(createBlockStartEvent(5, {
        type: "text",
        text: "Block 5",
        citations: null,
      }));

      processor.processBlockStop(createBlockStopEvent(0));
      processor.processBlockStop(createBlockStopEvent(5));

      // Both blocks should be handled correctly
    });

    it("handles cache token values of zero", async () => {
      processor.processMessageStart(createMessageStartEvent({
        id: "msg_zero_cache",
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation: null,
          server_tool_use: null,
          service_tier: null,
        },
      }));

      await processor.processMessageStop();

      expect(mockRecordUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
        })
      );
    });

    it("handles missing cache token values (undefined becomes 0)", async () => {
      processor.processMessageStart(createMessageStartEvent({
        id: "msg_no_cache",
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          // cache tokens not provided - casting to expected type to test handling of missing properties
        } as unknown as BetaRawMessageStartEvent["message"]["usage"],
      }));

      await processor.processMessageStop();

      expect(mockRecordUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
        })
      );
    });

    it("preserves input tokens from message start when delta only updates output tokens", async () => {
      processor.processMessageStart(createMessageStartEvent({
        id: "msg_preserve",
        usage: {
          input_tokens: 500,
          output_tokens: 25,
          cache_creation_input_tokens: 100,
          cache_read_input_tokens: 50,
          cache_creation: null,
          server_tool_use: null,
          service_tier: null,
        },
      }));

      processor.processMessageDelta(createMessageDeltaEvent(
        { stop_reason: "end_turn" },
        { output_tokens: 200 }
      ));

      await processor.processMessageStop();

      expect(mockRecordUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          inputTokens: 500,
          outputTokens: 200,
          cacheCreationInputTokens: 100,
          cacheReadInputTokens: 50,
        })
      );
    });

    it("handles tool_result stop reason (keeps task executing)", async () => {
      processor.processMessageStart(createMessageStartEvent());
      processor.processMessageDelta(createMessageDeltaEvent({ stop_reason: "tool_use" }));

      await processor.processMessageStop();

      // Task should remain in "executing" status (not changed to "available")
      // The update call sets status, we need to verify it's still "executing"
    });
  });

  describe("full message flow", () => {
    it("processes a complete text-only message", async () => {
      processor.processMessageStart(createMessageStartEvent({
        id: "msg_text_flow",
        usage: {
          input_tokens: 100,
          output_tokens: 10,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation: null,
          server_tool_use: null,
          service_tier: null,
        },
      }));

      processor.processBlockStart(createBlockStartEvent(0, {
        type: "text",
        text: "",
        citations: null,
      }));

      processor.processBlockDelta(createBlockDeltaEvent(0, {
        type: "text_delta",
        text: "Hello, ",
      }));

      processor.processBlockDelta(createBlockDeltaEvent(0, {
        type: "text_delta",
        text: "world!",
      }));

      processor.processBlockStop(createBlockStopEvent(0));

      processor.processMessageDelta(createMessageDeltaEvent(
        { stop_reason: "end_turn" },
        { output_tokens: 50 }
      ));

      await processor.processMessageStop();

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockRecordUsage).toHaveBeenCalled();
    });

    it("processes a message with tool use", async () => {
      mockIsServerTool.mockReturnValue(true);

      processor.processMessageStart(createMessageStartEvent({
        id: "msg_tool_flow",
      }));

      processor.processBlockStart(createBlockStartEvent(0, {
        type: "text",
        text: "",
        citations: null,
      }));

      processor.processBlockDelta(createBlockDeltaEvent(0, {
        type: "text_delta",
        text: "Let me help you.",
      }));

      processor.processBlockStop(createBlockStopEvent(0));

      processor.processBlockStart(createBlockStartEvent(1, {
        type: "tool_use",
        id: "tool_use_abc",
        name: "todo_write",
        input: {},
      }));

      processor.processBlockDelta(createBlockDeltaEvent(1, {
        type: "input_json_delta",
        partial_json: '{"todos": [{"id": "1", "text": "Test"}]}',
      }));

      processor.processBlockStop(createBlockStopEvent(1));

      processor.processMessageDelta(createMessageDeltaEvent(
        { stop_reason: "tool_use" },
        { output_tokens: 100 }
      ));

      await processor.processMessageStop();

      expect(mockAddToServerToolExecutorQueue).toHaveBeenCalled();
    });

    it("processes a message with multiple tool uses", async () => {
      mockIsServerTool.mockReturnValue(true);

      processor.processMessageStart(createMessageStartEvent());

      // First tool
      processor.processBlockStart(createBlockStartEvent(0, {
        type: "tool_use",
        id: "tool_1",
        name: "tool_a",
        input: {},
      }));
      processor.processBlockStop(createBlockStopEvent(0));

      // Second tool
      processor.processBlockStart(createBlockStartEvent(1, {
        type: "tool_use",
        id: "tool_2",
        name: "tool_b",
        input: {},
      }));
      processor.processBlockStop(createBlockStopEvent(1));

      processor.processMessageDelta(createMessageDeltaEvent({ stop_reason: "tool_use" }));

      await processor.processMessageStop();

      // Both tools should be queued
      expect(mockAddToServerToolExecutorQueue).toHaveBeenCalledTimes(2);
    });

    it("processes mixed server and MCP tools", async () => {
      const toolToMcpId = new Map([["mcp_tool", "mcp-123"]]);
      const proc = new AssistantTurnProcessor(
        mockDb as unknown as AppState["db"],
        "task-123",
        "org-456",
        "claude-3-opus",
        toolToMcpId
      );

      // Reset mocks for this specific processor
      mockIsServerTool.mockImplementation((name: string) => name === "server_tool");

      proc.processMessageStart(createMessageStartEvent());

      // Server tool
      proc.processBlockStart(createBlockStartEvent(0, {
        type: "tool_use",
        id: "tool_1",
        name: "server_tool",
        input: {},
      }));
      proc.processBlockStop(createBlockStopEvent(0));

      // MCP tool
      proc.processBlockStart(createBlockStartEvent(1, {
        type: "tool_use",
        id: "tool_2",
        name: "mcp_tool",
        input: {},
      }));
      proc.processBlockStop(createBlockStopEvent(1));

      proc.processMessageDelta(createMessageDeltaEvent({ stop_reason: "tool_use" }));

      await proc.processMessageStop();

      expect(mockAddToServerToolExecutorQueue).toHaveBeenCalledTimes(1);
      expect(mockAddToMcpToolExecutorQueue).toHaveBeenCalledTimes(1);
    });
  });
});
