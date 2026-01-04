import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AgentLoopConfig } from "@august/harness";
import type { AppState } from "../../../config/state";
import type { McpContext } from "../../../services/ai.service";

// Mock the @august/harness module
const mockAgentLoop = vi.fn();
vi.mock("@august/harness", () => ({
  agentLoop: (config: AgentLoopConfig) => mockAgentLoop(config),
  getMcpTools: vi.fn().mockReturnValue([]),
  DEFAULT_MODEL: "claude-3-sonnet",
}));

// Mock the AssistantTurnProcessor
vi.mock("../../../processors/assistant-turn-processor.js", () => ({
  AssistantTurnProcessor: class MockAssistantTurnProcessor {
    processMessageStart = vi.fn();
    processMessageDelta = vi.fn();
    processMessageStop = vi.fn().mockResolvedValue(undefined);
    processBlockStart = vi.fn();
    processBlockDelta = vi.fn();
    processBlockStop = vi.fn();
    flushToDb = vi.fn().mockResolvedValue(undefined);
  },
}));

// Mock shell-tools and server-tools
vi.mock("@august/shell-tools", () => ({
  toolDefinitions: [
    { name: "read_file", description: "Read a file" },
    { name: "write_file", description: "Write a file" },
  ],
}));

vi.mock("../../../server-tools/index.js", () => ({
  serverToolDefinitions: [{ name: "server_tool", description: "Server tool" }],
}));

// Import after mocks are set up
import { AiService } from "../../../services/ai.service.js";

// Helper to create mock MCP context
function createMockMcpContext(overrides: Partial<McpContext> = {}): McpContext {
  return {
    connections: [],
    tools: [],
    toolToMcpId: new Map<string, string>(),
    ...overrides,
  };
}

// Mock database interface for type safety
interface MockDb {
  query: {
    tasks: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    turns: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    blocks: {
      findFirst: ReturnType<typeof vi.fn>;
    };
  };
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  _mockFindFirst: ReturnType<typeof vi.fn>;
}

// Helper to create mock database
function createMockDb(): MockDb {
  const mockFindFirst = vi.fn();

  return {
    query: {
      tasks: {
        findFirst: mockFindFirst,
      },
      turns: {
        findFirst: mockFindFirst,
      },
      blocks: {
        findFirst: mockFindFirst,
      },
    },
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
    _mockFindFirst: mockFindFirst,
  };
}

// Mock task type for test helper
interface MockTask {
  id: string;
  author_id: string;
  organisation_id: string;
  metadata: { cwd?: string } | null;
  runtime: { tools: { name: string; version?: string }[] } | null;
  taskSkills: { skill: { id: string; name: string; description: string | null } }[];
  turns: MockTurn[];
  name?: string;
  created_at?: Date;
  last_session_id?: string | null;
  status?: string;
  runtime_id?: string;
  updated_at?: Date;
}

// Mock turn type for test helper
interface MockTurn {
  id: string;
  type: string;
  task_id: string;
  blocks: MockBlock[];
  metadata: { container?: { id: string } } | null;
  complete?: boolean;
  created_at?: Date;
  updated_at?: Date;
  locked?: boolean;
}

// Mock block type for test helper
interface MockBlock {
  id: string;
  turn_id: string;
  type: string;
  content: Record<string, unknown>;
  processed: boolean;
  status?: string;
  complete?: boolean;
  metadata?: Record<string, unknown> | null;
  created_at?: Date;
  updated_at?: Date;
  response_turn_id?: string | null;
}

// Helper to create mock task with turns
function createMockTask(overrides: Partial<MockTask> = {}): MockTask {
  return {
    id: "task-123",
    author_id: "user-456",
    organisation_id: "org-789",
    metadata: { cwd: "/test/path" },
    runtime: { tools: [{ name: "read_file" }] },
    taskSkills: [],
    turns: [],
    ...overrides,
  };
}

// Helper to create mock turn
function createMockTurn(overrides: Partial<MockTurn> = {}): MockTurn {
  return {
    id: "turn-123",
    type: "user",
    task_id: "task-123",
    blocks: [],
    metadata: null,
    ...overrides,
  };
}

// Helper to create mock block
function createMockBlock(overrides: Partial<MockBlock> = {}): MockBlock {
  return {
    id: "block-123",
    turn_id: "turn-123",
    type: "text",
    content: { type: "text", text: "Hello" },
    processed: false,
    ...overrides,
  };
}

// Helper to create empty async iterator for agentLoop
function createEmptyAgentLoop() {
  return {
    [Symbol.asyncIterator]: () => ({
      next: () => Promise.resolve({ done: true }),
    }),
  };
}

describe("AiService", () => {
  let mockDb: MockDb;
  let mockState: AppState;

  beforeEach(() => {
    // Reset all mocks first
    vi.clearAllMocks();

    // Reset the singleton instance before each test
    (AiService as unknown as { instance: AiService | null }).instance = null;

    mockDb = createMockDb();
    // Cast mockDb as AppState["db"] for testing purposes
    mockState = { db: mockDb as unknown as AppState["db"] };

    // Set default mock implementation for agent loop
    mockAgentLoop.mockReturnValue(createEmptyAgentLoop());
  });

  afterEach(() => {
    // Clean up singleton instance
    (AiService as unknown as { instance: AiService | null }).instance = null;
  });

  describe("Singleton getInstance pattern", () => {
    it("returns the same instance when called multiple times", () => {
      const instance1 = AiService.getInstance(mockState);
      const instance2 = AiService.getInstance(mockState);

      expect(instance1).toBe(instance2);
    });

    it("creates a new instance on first call", () => {
      const instance = AiService.getInstance(mockState);

      expect(instance).toBeInstanceOf(AiService);
    });

    it("uses the db from the initial state even when called with different state", () => {
      const instance1 = AiService.getInstance(mockState);

      const differentMockDb = createMockDb();
      const differentState: AppState = { db: differentMockDb as unknown as AppState["db"] };
      const instance2 = AiService.getInstance(differentState);

      expect(instance1).toBe(instance2);
      // The instance should still use the original db (first state)
    });
  });

  describe("processBlock", () => {
    describe("validation and error handling", () => {
      it("throws error when task is not found", async () => {
        mockDb._mockFindFirst.mockResolvedValueOnce(null); // task query returns null

        const service = AiService.getInstance(mockState);

        await expect(
          service.processBlock("task-123", "turn-123", "block-123")
        ).rejects.toThrow("Task not found");
      });

      it("throws error when turn is not found", async () => {
        const mockTask = createMockTask();
        mockDb._mockFindFirst
          .mockResolvedValueOnce(mockTask) // task query
          .mockResolvedValueOnce(null); // turn query returns null

        const service = AiService.getInstance(mockState);

        await expect(
          service.processBlock("task-123", "turn-123", "block-123")
        ).rejects.toThrow("Turn not found");
      });

      it("throws error when block is not found", async () => {
        const mockTask = createMockTask();
        const mockTurn = createMockTurn();

        mockDb._mockFindFirst
          .mockResolvedValueOnce(mockTask) // task query
          .mockResolvedValueOnce(mockTurn) // turn query
          .mockResolvedValueOnce(null); // block query returns null

        const service = AiService.getInstance(mockState);

        await expect(
          service.processBlock("task-123", "turn-123", "block-123")
        ).rejects.toThrow("Block not found");
      });

      it("throws error when block has already been processed", async () => {
        const mockTask = createMockTask();
        const mockTurn = createMockTurn();
        const mockBlock = createMockBlock({ processed: true });

        mockDb._mockFindFirst
          .mockResolvedValueOnce(mockTask)
          .mockResolvedValueOnce(mockTurn)
          .mockResolvedValueOnce(mockBlock);

        const service = AiService.getInstance(mockState);

        await expect(
          service.processBlock("task-123", "turn-123", "block-123")
        ).rejects.toThrow("Block has already been processed");
      });
    });

    describe("text block processing", () => {
      it("processes a text block and marks it as processed", async () => {
        const mockTask = createMockTask();
        const mockTurn = createMockTurn();
        const mockBlock = createMockBlock({ type: "text" });

        mockDb._mockFindFirst
          .mockResolvedValueOnce(mockTask) // initial task query
          .mockResolvedValueOnce(mockTurn) // turn query
          .mockResolvedValueOnce(mockBlock) // block query
          .mockResolvedValueOnce(mockTask); // runAgentLoop task query

        const service = AiService.getInstance(mockState);
        await service.processBlock("task-123", "turn-123", "block-123");

        // Verify block was marked as processed
        expect(mockDb.update).toHaveBeenCalled();
      });

      it("starts agent loop after processing text block", async () => {
        const mockTask = createMockTask({
          turns: [
            createMockTurn({
              type: "user",
              blocks: [createMockBlock({ type: "text", content: { type: "text", text: "Hi" } })],
            }),
          ],
        });
        const mockTurn = createMockTurn();
        const mockBlock = createMockBlock({ type: "text" });

        mockDb._mockFindFirst
          .mockResolvedValueOnce(mockTask)
          .mockResolvedValueOnce(mockTurn)
          .mockResolvedValueOnce(mockBlock)
          .mockResolvedValueOnce(mockTask);

        const service = AiService.getInstance(mockState);
        await service.processBlock("task-123", "turn-123", "block-123");

        expect(mockAgentLoop).toHaveBeenCalled();
      });
    });

    describe("tool_result block processing", () => {
      it("throws error when turn type is not user", async () => {
        const mockTask = createMockTask({
          turns: [
            createMockTurn({
              type: "assistant",
              blocks: [
                createMockBlock({
                  type: "tool_use",
                  content: { type: "tool_use", id: "tool-use-1", name: "read_file", input: {} },
                }),
              ],
            }),
          ],
        });
        const mockTurn = createMockTurn({ type: "assistant" }); // Not a user turn
        const mockBlock = createMockBlock({
          type: "tool_result",
          content: { type: "tool_result", tool_use_id: "tool-use-1", content: "result" },
        });

        mockDb._mockFindFirst
          .mockResolvedValueOnce(mockTask)
          .mockResolvedValueOnce(mockTurn)
          .mockResolvedValueOnce(mockBlock);

        const service = AiService.getInstance(mockState);

        await expect(
          service.processBlock("task-123", "turn-123", "block-123")
        ).rejects.toThrow("Only user turns can trigger agent loop");
      });

      it("throws error when no tool use blocks found", async () => {
        const mockTask = createMockTask({
          turns: [
            createMockTurn({
              type: "assistant",
              blocks: [], // No tool_use blocks
            }),
          ],
        });
        const mockTurn = createMockTurn({ type: "user" });
        const mockBlock = createMockBlock({
          type: "tool_result",
          content: { type: "tool_result", tool_use_id: "tool-use-1", content: "result" },
        });

        mockDb._mockFindFirst
          .mockResolvedValueOnce(mockTask)
          .mockResolvedValueOnce(mockTurn)
          .mockResolvedValueOnce(mockBlock);

        const service = AiService.getInstance(mockState);

        await expect(
          service.processBlock("task-123", "turn-123", "block-123")
        ).rejects.toThrow("No tool use blocks found to associate tool result");
      });

      it("throws error when tool_use_id does not match any tool_use block", async () => {
        const mockTask = createMockTask({
          turns: [
            createMockTurn({
              type: "assistant",
              blocks: [
                createMockBlock({
                  type: "tool_use",
                  content: { type: "tool_use", id: "tool-use-1", name: "read_file", input: {} },
                }),
              ],
            }),
          ],
        });
        const mockTurn = createMockTurn({ type: "user" });
        const mockBlock = createMockBlock({
          type: "tool_result",
          content: { type: "tool_result", tool_use_id: "non-existent-id", content: "result" },
        });

        mockDb._mockFindFirst
          .mockResolvedValueOnce(mockTask)
          .mockResolvedValueOnce(mockTurn)
          .mockResolvedValueOnce(mockBlock);

        const service = AiService.getInstance(mockState);

        await expect(
          service.processBlock("task-123", "turn-123", "block-123")
        ).rejects.toThrow("Tool use block not found to associate tool result");
      });

      it("marks tool_result block as processed when matched with tool_use", async () => {
        const toolUseId = "tool-use-1";
        const mockTask = createMockTask({
          turns: [
            createMockTurn({
              id: "assistant-turn",
              type: "assistant",
              blocks: [
                createMockBlock({
                  type: "tool_use",
                  content: { type: "tool_use", id: toolUseId, name: "read_file", input: {} },
                }),
              ],
            }),
            createMockTurn({
              id: "user-turn",
              type: "user",
              blocks: [], // No tool results yet
            }),
          ],
        });
        const mockTurn = createMockTurn({ id: "user-turn", type: "user" });
        const mockBlock = createMockBlock({
          id: "tool-result-block",
          type: "tool_result",
          content: { type: "tool_result", tool_use_id: toolUseId, content: "file content" },
        });

        mockDb._mockFindFirst
          .mockResolvedValueOnce(mockTask)
          .mockResolvedValueOnce(mockTurn)
          .mockResolvedValueOnce(mockBlock)
          .mockResolvedValueOnce(mockTask); // For runAgentLoop

        const service = AiService.getInstance(mockState);
        await service.processBlock("task-123", "user-turn", "tool-result-block");

        expect(mockDb.update).toHaveBeenCalled();
      });

      it("starts agent loop when all tool_use blocks have corresponding tool_result", async () => {
        const toolUseId = "tool-use-1";
        const mockTask = createMockTask({
          turns: [
            createMockTurn({
              id: "assistant-turn",
              type: "assistant",
              blocks: [
                createMockBlock({
                  type: "tool_use",
                  content: { type: "tool_use", id: toolUseId, name: "read_file", input: {} },
                }),
              ],
            }),
            createMockTurn({
              id: "user-turn",
              type: "user",
              blocks: [], // Empty - we append the current block
            }),
          ],
        });
        const mockTurn = createMockTurn({ id: "user-turn", type: "user" });
        const mockBlock = createMockBlock({
          id: "tool-result-block",
          type: "tool_result",
          content: { type: "tool_result", tool_use_id: toolUseId, content: "result" },
        });

        mockDb._mockFindFirst
          .mockResolvedValueOnce(mockTask)
          .mockResolvedValueOnce(mockTurn)
          .mockResolvedValueOnce(mockBlock)
          .mockResolvedValueOnce(mockTask);

        const service = AiService.getInstance(mockState);
        await service.processBlock("task-123", "user-turn", "tool-result-block");

        expect(mockAgentLoop).toHaveBeenCalled();
      });

      it("does not start agent loop when not all tool_use blocks have results", async () => {
        const mockTask = createMockTask({
          turns: [
            createMockTurn({
              id: "assistant-turn",
              type: "assistant",
              blocks: [
                createMockBlock({
                  type: "tool_use",
                  content: { type: "tool_use", id: "tool-use-1", name: "read_file", input: {} },
                }),
                createMockBlock({
                  type: "tool_use",
                  content: { type: "tool_use", id: "tool-use-2", name: "write_file", input: {} },
                }),
              ],
            }),
            createMockTurn({
              id: "user-turn",
              type: "user",
              blocks: [], // No results yet
            }),
          ],
        });
        const mockTurn = createMockTurn({ id: "user-turn", type: "user" });
        // Only provide result for one tool_use
        const mockBlock = createMockBlock({
          id: "tool-result-block",
          type: "tool_result",
          content: { type: "tool_result", tool_use_id: "tool-use-1", content: "result" },
        });

        mockDb._mockFindFirst
          .mockResolvedValueOnce(mockTask)
          .mockResolvedValueOnce(mockTurn)
          .mockResolvedValueOnce(mockBlock);

        const service = AiService.getInstance(mockState);
        await service.processBlock("task-123", "user-turn", "tool-result-block");

        // Agent loop should NOT be called since tool-use-2 has no result
        expect(mockAgentLoop).not.toHaveBeenCalled();
      });
    });

    describe("unknown block types", () => {
      it("does nothing for unhandled block types", async () => {
        const mockTask = createMockTask();
        const mockTurn = createMockTurn();
        const mockBlock = createMockBlock({
          type: "thinking", // Unknown/unhandled type
          content: { type: "thinking", thinking: "..." },
        });

        mockDb._mockFindFirst
          .mockResolvedValueOnce(mockTask)
          .mockResolvedValueOnce(mockTurn)
          .mockResolvedValueOnce(mockBlock);

        const service = AiService.getInstance(mockState);
        const result = await service.processBlock("task-123", "turn-123", "block-123");

        // Should return undefined and not call agentLoop
        expect(result).toBeUndefined();
        expect(mockAgentLoop).not.toHaveBeenCalled();
      });
    });
  });

  describe("runAgentLoop (via processBlock)", () => {
    it("processes agent loop events correctly", async () => {
      const mockTask = createMockTask({
        turns: [
          createMockTurn({
            type: "user",
            blocks: [createMockBlock({ type: "text", content: { type: "text", text: "Hello" } })],
          }),
        ],
      });
      const mockTurn = createMockTurn();
      const mockBlock = createMockBlock({ type: "text" });

      const events = [
        { type: "message_start", message: { content: [], usage: { input_tokens: 10, output_tokens: 5 } } },
        { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hi" } },
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 10 } },
        { type: "message_stop" },
      ];

      let eventIndex = 0;
      mockAgentLoop.mockReturnValue({
        [Symbol.asyncIterator]: () => ({
          next: () => {
            if (eventIndex < events.length) {
              return Promise.resolve({ value: events[eventIndex++], done: false });
            }
            return Promise.resolve({ done: true });
          },
        }),
      });

      mockDb._mockFindFirst
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(mockTurn)
        .mockResolvedValueOnce(mockBlock)
        .mockResolvedValueOnce(mockTask);

      const service = AiService.getInstance(mockState);
      await service.processBlock("task-123", "turn-123", "block-123");

      expect(mockAgentLoop).toHaveBeenCalled();
    });

    it("propagates agent loop errors", async () => {
      const mockTask = createMockTask();
      const mockTurn = createMockTurn();
      const mockBlock = createMockBlock({ type: "text" });

      mockAgentLoop.mockReturnValue({
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.reject(new Error("Agent loop error")),
        }),
      });

      mockDb._mockFindFirst
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(mockTurn)
        .mockResolvedValueOnce(mockBlock)
        .mockResolvedValueOnce(mockTask);

      const service = AiService.getInstance(mockState);

      await expect(
        service.processBlock("task-123", "turn-123", "block-123")
      ).rejects.toThrow("Agent loop error");
    });

    it("works without mcpContext (graceful degradation)", async () => {
      const mockTask = createMockTask({
        turns: [
          createMockTurn({
            type: "user",
            blocks: [createMockBlock({ type: "text", content: { type: "text", text: "Hello" } })],
          }),
        ],
      });
      const mockTurn = createMockTurn();
      const mockBlock = createMockBlock({ type: "text" });

      mockDb._mockFindFirst
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(mockTurn)
        .mockResolvedValueOnce(mockBlock)
        .mockResolvedValueOnce(mockTask);

      const service = AiService.getInstance(mockState);

      // Should not throw when mcpContext is undefined
      await expect(
        service.processBlock("task-123", "turn-123", "block-123", undefined)
      ).resolves.not.toThrow();

      // Should be called with empty mcpTools
      expect(mockAgentLoop).toHaveBeenCalledWith(
        expect.objectContaining({
          mcpTools: [],
        })
      );
    });

    it("extracts container ID from turn metadata", async () => {
      const mockTask = createMockTask({
        turns: [
          createMockTurn({
            type: "user",
            metadata: { container: { id: "container-123" } },
            blocks: [createMockBlock({ type: "text", content: { type: "text", text: "Hello" } })],
          }),
        ],
      });
      const mockTurn = createMockTurn();
      const mockBlock = createMockBlock({ type: "text" });

      mockDb._mockFindFirst
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(mockTurn)
        .mockResolvedValueOnce(mockBlock)
        .mockResolvedValueOnce(mockTask);

      const service = AiService.getInstance(mockState);
      await service.processBlock("task-123", "turn-123", "block-123");

      expect(mockAgentLoop).toHaveBeenCalledWith(
        expect.objectContaining({
          container: "container-123",
        })
      );
    });

    it("filters shell tools based on runtime tools", async () => {
      const mockTask = createMockTask({
        runtime: { tools: [{ name: "read_file" }] }, // Only read_file, not write_file
        turns: [
          createMockTurn({
            type: "user",
            blocks: [createMockBlock({ type: "text", content: { type: "text", text: "Hello" } })],
          }),
        ],
      });
      const mockTurn = createMockTurn();
      const mockBlock = createMockBlock({ type: "text" });

      mockDb._mockFindFirst
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(mockTurn)
        .mockResolvedValueOnce(mockBlock)
        .mockResolvedValueOnce(mockTask);

      const service = AiService.getInstance(mockState);
      await service.processBlock("task-123", "turn-123", "block-123");

      const agentLoopCall = mockAgentLoop.mock.calls[0][0] as AgentLoopConfig;
      // Should include read_file (from filtered shell tools) + server_tool
      expect(agentLoopCall.tools).toHaveLength(2);
      expect(agentLoopCall.tools?.map((t) => t.name)).toContain("read_file");
      expect(agentLoopCall.tools?.map((t) => t.name)).toContain("server_tool");
      expect(agentLoopCall.tools?.map((t) => t.name)).not.toContain("write_file");
    });

    it("includes task skills in agent loop", async () => {
      const mockTask = createMockTask({
        taskSkills: [
          {
            skill: {
              id: "skill-1",
              name: "code_review",
              description: "Review code",
            },
          },
        ],
        turns: [
          createMockTurn({
            type: "user",
            blocks: [createMockBlock({ type: "text", content: { type: "text", text: "Hello" } })],
          }),
        ],
      });
      const mockTurn = createMockTurn();
      const mockBlock = createMockBlock({ type: "text" });

      mockDb._mockFindFirst
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(mockTurn)
        .mockResolvedValueOnce(mockBlock)
        .mockResolvedValueOnce(mockTask);

      const service = AiService.getInstance(mockState);
      await service.processBlock("task-123", "turn-123", "block-123");

      expect(mockAgentLoop).toHaveBeenCalledWith(
        expect.objectContaining({
          skills: [
            {
              id: "skill-1",
              name: "code_review",
              description: "Review code",
            },
          ],
        })
      );
    });

    it("throws error when task not found during runAgentLoop", async () => {
      const mockTask = createMockTask();
      const mockTurn = createMockTurn();
      const mockBlock = createMockBlock({ type: "text" });

      mockDb._mockFindFirst
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(mockTurn)
        .mockResolvedValueOnce(mockBlock)
        .mockResolvedValueOnce(null); // Task not found during runAgentLoop

      const service = AiService.getInstance(mockState);

      await expect(
        service.processBlock("task-123", "turn-123", "block-123")
      ).rejects.toThrow("Task not found");
    });

    it("handles empty runtime tools", async () => {
      const mockTask = createMockTask({
        runtime: null, // No runtime
        turns: [
          createMockTurn({
            type: "user",
            blocks: [createMockBlock({ type: "text", content: { type: "text", text: "Hello" } })],
          }),
        ],
      });
      const mockTurn = createMockTurn();
      const mockBlock = createMockBlock({ type: "text" });

      mockDb._mockFindFirst
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(mockTurn)
        .mockResolvedValueOnce(mockBlock)
        .mockResolvedValueOnce(mockTask);

      const service = AiService.getInstance(mockState);
      await service.processBlock("task-123", "turn-123", "block-123");

      const agentLoopCall = mockAgentLoop.mock.calls[0][0];
      // Should only have server tools (no shell tools filtered)
      expect(agentLoopCall.tools).toHaveLength(1);
      expect(agentLoopCall.tools[0].name).toBe("server_tool");
    });

    it("handles undefined taskSkills", async () => {
      const mockTask = createMockTask({
        taskSkills: undefined,
        turns: [
          createMockTurn({
            type: "user",
            blocks: [createMockBlock({ type: "text", content: { type: "text", text: "Hello" } })],
          }),
        ],
      });
      const mockTurn = createMockTurn();
      const mockBlock = createMockBlock({ type: "text" });

      mockDb._mockFindFirst
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(mockTurn)
        .mockResolvedValueOnce(mockBlock)
        .mockResolvedValueOnce(mockTask);

      const service = AiService.getInstance(mockState);
      await service.processBlock("task-123", "turn-123", "block-123");

      expect(mockAgentLoop).toHaveBeenCalledWith(
        expect.objectContaining({
          skills: [],
        })
      );
    });

    it("passes cwd from task metadata to agent loop", async () => {
      const mockTask = createMockTask({
        metadata: { cwd: "/custom/path" },
        turns: [
          createMockTurn({
            type: "user",
            blocks: [createMockBlock({ type: "text", content: { type: "text", text: "Hello" } })],
          }),
        ],
      });
      const mockTurn = createMockTurn();
      const mockBlock = createMockBlock({ type: "text" });

      mockDb._mockFindFirst
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(mockTurn)
        .mockResolvedValueOnce(mockBlock)
        .mockResolvedValueOnce(mockTask);

      const service = AiService.getInstance(mockState);
      await service.processBlock("task-123", "turn-123", "block-123");

      expect(mockAgentLoop).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: "/custom/path",
        })
      );
    });

    it("passes MCP tools to agent loop when mcpContext is provided", async () => {
      const mockTask = createMockTask({
        turns: [
          createMockTurn({
            type: "user",
            blocks: [createMockBlock({ type: "text", content: { type: "text", text: "Hello" } })],
          }),
        ],
      });
      const mockTurn = createMockTurn();
      const mockBlock = createMockBlock({ type: "text" });

      const mcpTools = [{ name: "mcp_tool", description: "An MCP tool", input_schema: { type: "object" as const, properties: {} } }];
      const mcpContext = createMockMcpContext({
        connections: [],
        tools: mcpTools,
        toolToMcpId: new Map([["mcp_tool", "mcp-123"]]),
      });

      mockDb._mockFindFirst
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(mockTurn)
        .mockResolvedValueOnce(mockBlock)
        .mockResolvedValueOnce(mockTask);

      const service = AiService.getInstance(mockState);
      await service.processBlock("task-123", "turn-123", "block-123", mcpContext);

      expect(mockAgentLoop).toHaveBeenCalledWith(
        expect.objectContaining({
          mcpTools: mcpTools,
        })
      );
    });
  });
});
