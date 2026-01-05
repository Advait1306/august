import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MockDataStore,
  createMockTransaction,
  createMockContext,
  setSharedStore,
  type MockTransaction,
  type MockContext,
} from "../../helpers/mock-zero";
import {
  createTaskFixture,
  createTurnFixture,
  createBlockFixture,
  createToolUseBlockFixture,
} from "../../helpers/fixtures";

// Use vi.hoisted to create mock before vi.mock is hoisted
const mockZeroSchema = vi.hoisted(() => {
  // Relationship definitions for .related() support
  const RELATIONSHIPS: Record<string, Record<string, { sourceField: string; destTable: string; destField: string }>> = {
    skillDocuments: {
      skill: { sourceField: "skill_id", destTable: "skills", destField: "id" },
    },
    turns: {
      task: { sourceField: "task_id", destTable: "tasks", destField: "id" },
    },
    blocks: {
      turn: { sourceField: "turn_id", destTable: "turns", destField: "id" },
    },
  };

  class InlineMockQueryBuilder<T = any> {
    private store: any;
    private tableName: string;
    private conditions: Array<(row: any) => boolean> = [];
    private relatedQueries: Array<{ relationName: string; queryFn?: (q: any) => any }> = [];
    private orderByField?: string;
    private orderByDirection: "asc" | "desc" = "asc";
    private limitCount?: number;

    constructor(store: any, tableName: string) {
      this.store = store;
      this.tableName = tableName;
    }

    where(field: string, value: any): this {
      this.conditions.push((row) => row[field] === value);
      return this;
    }

    related(relationName: string, queryFn?: (q: any) => any): this {
      this.relatedQueries.push({ relationName, queryFn });
      return this;
    }

    orderBy(field: string, direction: "asc" | "desc" = "asc"): this {
      this.orderByField = field;
      this.orderByDirection = direction;
      return this;
    }

    limit(count: number): this {
      this.limitCount = count;
      return this;
    }

    one(): T | undefined {
      const results = this._execute();
      return results[0];
    }

    execute(): T[] {
      return this._execute();
    }

    private _execute(): T[] {
      let results = this.store.getAll(this.tableName);

      // Apply direct conditions
      for (const condition of this.conditions) {
        results = results.filter(condition);
      }

      // Apply related conditions and populate related data
      for (const { relationName, queryFn } of this.relatedQueries) {
        const rel = RELATIONSHIPS[this.tableName]?.[relationName];
        if (rel) {
          results = results
            .map((row: any) => {
              const foreignKey = row[rel.sourceField];
              if (!foreignKey) return { ...row, [relationName]: undefined };

              // Create a query builder for the related table and apply the query function
              const relatedQuery = new InlineMockQueryBuilder(this.store, rel.destTable);
              relatedQuery.where(rel.destField, foreignKey);
              const configured = queryFn ? queryFn(relatedQuery) : relatedQuery;
              const relatedResults = configured._execute();

              // Populate the related data on the result (first match for one-to-one)
              return { ...row, [relationName]: relatedResults[0] };
            })
            .filter((row: any) => row[relationName] !== undefined);
        }
      }

      if (this.orderByField) {
        const field = this.orderByField;
        results.sort((a: any, b: any) => {
          const cmp = a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0;
          return this.orderByDirection === "asc" ? cmp : -cmp;
        });
      }
      if (this.limitCount !== undefined) {
        results = results.slice(0, this.limitCount);
      }
      return results;
    }
  }

  return {
    get builder() {
      const store = globalThis.__mockZeroStore;
      if (!store) throw new Error("Store not set");
      return new Proxy({}, {
        get: (_target: any, tableName: string) => {
          return new InlineMockQueryBuilder(store, tableName);
        },
      });
    },
  };
});

// Mock the Zero schema builder
vi.mock("../../../zero/schema", () => mockZeroSchema);

// Import after mocking
import { taskMutators, messageMutators, toolMutators } from "../../../features/tasks/mutators";

describe("tasks/mutators", () => {
  let store: MockDataStore;
  let tx: MockTransaction;
  let ctx: MockContext;

  beforeEach(() => {
    store = new MockDataStore();
    setSharedStore(store);
    tx = createMockTransaction(store);
    ctx = createMockContext("user-1", "org-1");
  });

  describe("taskMutators", () => {
    describe("create", () => {
      it("should create a new task with status 'starting'", async () => {
        await taskMutators.create.fn({
          tx,
          ctx,
          args: {
            message: "Hello, world!",
            task_id: "task-1",
            turn_id: "turn-1",
            block_id: "block-1",
            runtime_id: "runtime-1",
            session_id: "session-1",
          },
        });

        const task = store.get("tasks", "task-1");
        expect(task).toBeDefined();
        expect(task?.status).toBe("starting");
        expect(task?.author_id).toBe("user-1");
        expect(task?.organisation_id).toBe("org-1");
        expect(task?.runtime_id).toBe("runtime-1");
      });

      it("should truncate task name to 40 characters with ellipsis", async () => {
        const longMessage = "A".repeat(50);

        await taskMutators.create.fn({
          tx,
          ctx,
          args: {
            message: longMessage,
            task_id: "task-1",
            turn_id: "turn-1",
            block_id: "block-1",
            runtime_id: "runtime-1",
            session_id: "session-1",
          },
        });

        const task = store.get("tasks", "task-1");
        expect(task?.name.length).toBe(43); // 40 + "..."
        expect(task?.name).toBe("A".repeat(40) + "...");
      });

      it("should create initial user turn with locked=true", async () => {
        await taskMutators.create.fn({
          tx,
          ctx,
          args: {
            message: "Test message",
            task_id: "task-1",
            turn_id: "turn-1",
            block_id: "block-1",
            runtime_id: "runtime-1",
            session_id: "session-1",
          },
        });

        const turn = store.get("turns", "turn-1");
        expect(turn).toBeDefined();
        expect(turn?.type).toBe("user");
        expect(turn?.locked).toBe(true);
        expect(turn?.complete).toBe(true);
        expect(turn?.task_id).toBe("task-1");
      });

      it("should create text block with the message", async () => {
        await taskMutators.create.fn({
          tx,
          ctx,
          args: {
            message: "Test message",
            task_id: "task-1",
            turn_id: "turn-1",
            block_id: "block-1",
            runtime_id: "runtime-1",
            session_id: "session-1",
          },
        });

        const block = store.get("blocks", "block-1");
        expect(block).toBeDefined();
        expect(block?.type).toBe("text");
        expect(block?.content).toEqual({ type: "text", text: "Test message" });
        expect(block?.complete).toBe(true);
      });

      it("should associate skill_ids via taskSkills table", async () => {
        await taskMutators.create.fn({
          tx,
          ctx,
          args: {
            message: "Test message",
            task_id: "task-1",
            turn_id: "turn-1",
            block_id: "block-1",
            runtime_id: "runtime-1",
            session_id: "session-1",
            skill_ids: ["skill-1", "skill-2"],
          },
        });

        const taskSkill1 = store.get("taskSkills", "task-1:skill-1");
        const taskSkill2 = store.get("taskSkills", "task-1:skill-2");
        expect(taskSkill1).toBeDefined();
        expect(taskSkill2).toBeDefined();
      });

      it("should not create taskSkills when skill_ids is empty", async () => {
        await taskMutators.create.fn({
          tx,
          ctx,
          args: {
            message: "Test message",
            task_id: "task-1",
            turn_id: "turn-1",
            block_id: "block-1",
            runtime_id: "runtime-1",
            session_id: "session-1",
            skill_ids: [],
          },
        });

        const allTaskSkills = store.getAll("taskSkills");
        expect(allTaskSkills).toHaveLength(0);
      });

      it("should store metadata if provided", async () => {
        await taskMutators.create.fn({
          tx,
          ctx,
          args: {
            message: "Test message",
            task_id: "task-1",
            turn_id: "turn-1",
            block_id: "block-1",
            runtime_id: "runtime-1",
            session_id: "session-1",
            metadata: { cwd: "/home/user/project" },
          },
        });

        const task = store.get("tasks", "task-1");
        expect(task?.metadata).toEqual({ cwd: "/home/user/project" });
      });
    });

    describe("abort", () => {
      it("should update task status to 'stopping' when status is 'executing'", async () => {
        store.set(
          "tasks",
          "task-1",
          createTaskFixture({
            id: "task-1",
            author_id: "user-1",
            status: "executing",
          })
        );

        await taskMutators.abort.fn({
          tx,
          ctx,
          args: { task_id: "task-1" },
        });

        const task = store.get("tasks", "task-1");
        expect(task?.status).toBe("stopping");
      });

      it("should throw error when task not found", async () => {
        await expect(
          taskMutators.abort.fn({
            tx,
            ctx,
            args: { task_id: "nonexistent" },
          })
        ).rejects.toThrow("Task not found with user");
      });

      it("should throw error when task doesn't belong to user", async () => {
        store.set(
          "tasks",
          "task-1",
          createTaskFixture({
            id: "task-1",
            author_id: "other-user",
            status: "executing",
          })
        );

        await expect(
          taskMutators.abort.fn({
            tx,
            ctx,
            args: { task_id: "task-1" },
          })
        ).rejects.toThrow("Task not found with user");
      });

      it("should throw error when task status is not 'executing'", async () => {
        store.set(
          "tasks",
          "task-1",
          createTaskFixture({
            id: "task-1",
            author_id: "user-1",
            status: "available",
          })
        );

        await expect(
          taskMutators.abort.fn({
            tx,
            ctx,
            args: { task_id: "task-1" },
          })
        ).rejects.toThrow("Can't stop a non-executing task");
      });

      it("should throw error when task status is 'starting'", async () => {
        store.set(
          "tasks",
          "task-1",
          createTaskFixture({
            id: "task-1",
            author_id: "user-1",
            status: "starting",
          })
        );

        await expect(
          taskMutators.abort.fn({
            tx,
            ctx,
            args: { task_id: "task-1" },
          })
        ).rejects.toThrow("Can't stop a non-executing task");
      });
    });
  });

  describe("messageMutators", () => {
    describe("create", () => {
      beforeEach(() => {
        // Set up a task in 'available' state
        store.set(
          "tasks",
          "task-1",
          createTaskFixture({
            id: "task-1",
            author_id: "user-1",
            status: "available",
          })
        );
      });

      it("should update task status to 'starting'", async () => {
        await messageMutators.create.fn({
          tx,
          ctx,
          args: {
            message: "Follow up message",
            task_id: "task-1",
            turn_id: "turn-2",
            block_id: "block-2",
            session_id: "session-2",
          },
        });

        const task = store.get("tasks", "task-1");
        expect(task?.status).toBe("starting");
      });

      it("should update last_session_id", async () => {
        await messageMutators.create.fn({
          tx,
          ctx,
          args: {
            message: "Follow up message",
            task_id: "task-1",
            turn_id: "turn-2",
            block_id: "block-2",
            session_id: "new-session",
          },
        });

        const task = store.get("tasks", "task-1");
        expect(task?.last_session_id).toBe("new-session");
      });

      it("should throw error when task not found", async () => {
        await expect(
          messageMutators.create.fn({
            tx,
            ctx,
            args: {
              message: "Message",
              task_id: "nonexistent",
              turn_id: "turn-2",
              block_id: "block-2",
              session_id: "session-2",
            },
          })
        ).rejects.toThrow("Task not found with user");
      });

      it("should throw error when task doesn't belong to user", async () => {
        store.set(
          "tasks",
          "task-2",
          createTaskFixture({
            id: "task-2",
            author_id: "other-user",
            status: "available",
          })
        );

        await expect(
          messageMutators.create.fn({
            tx,
            ctx,
            args: {
              message: "Message",
              task_id: "task-2",
              turn_id: "turn-2",
              block_id: "block-2",
              session_id: "session-2",
            },
          })
        ).rejects.toThrow("Task not found with user");
      });

      it("should throw error when task status is not 'available'", async () => {
        store.set(
          "tasks",
          "task-1",
          createTaskFixture({
            id: "task-1",
            author_id: "user-1",
            status: "executing",
          })
        );

        await expect(
          messageMutators.create.fn({
            tx,
            ctx,
            args: {
              message: "Message",
              task_id: "task-1",
              turn_id: "turn-2",
              block_id: "block-2",
              session_id: "session-2",
            },
          })
        ).rejects.toThrow("Task is not in available state");
      });

      it("should create new user turn", async () => {
        await messageMutators.create.fn({
          tx,
          ctx,
          args: {
            message: "Follow up",
            task_id: "task-1",
            turn_id: "turn-2",
            block_id: "block-2",
            session_id: "session-2",
          },
        });

        const turn = store.get("turns", "turn-2");
        expect(turn).toBeDefined();
        expect(turn?.type).toBe("user");
        expect(turn?.task_id).toBe("task-1");
        expect(turn?.locked).toBe(true);
      });

      it("should create text block with the message", async () => {
        await messageMutators.create.fn({
          tx,
          ctx,
          args: {
            message: "Follow up message",
            task_id: "task-1",
            turn_id: "turn-2",
            block_id: "block-2",
            session_id: "session-2",
          },
        });

        const block = store.get("blocks", "block-2");
        expect(block).toBeDefined();
        expect(block?.type).toBe("text");
        expect(block?.content).toEqual({
          type: "text",
          text: "Follow up message",
        });
      });
    });
  });

  describe("toolMutators", () => {
    describe("submitResult", () => {
      beforeEach(() => {
        // Set up turn and tool block
        store.set(
          "turns",
          "turn-1",
          createTurnFixture({
            id: "turn-1",
            type: "user",
            locked: false,
            task_id: "task-1",
          })
        );
        store.set(
          "blocks",
          "tool-1",
          createToolUseBlockFixture({
            id: "tool-1",
            turn_id: "turn-1",
          })
        );
      });

      it("should create tool_result block with content", async () => {
        await toolMutators.submitResult.fn({
          tx,
          ctx,
          args: {
            tool_block_id: "tool-1",
            turn_id: "turn-1",
            result: "file1.txt\nfile2.txt",
            block_id: "result-1",
            is_error: false,
          },
        });

        const result = store.get("blocks", "result-1");
        expect(result).toBeDefined();
        expect(result?.type).toBe("tool_result");
        expect(result?.content.content).toBe("file1.txt\nfile2.txt");
        expect(result?.content.is_error).toBe(false);
      });

      it("should update tool block status to 'completed'", async () => {
        await toolMutators.submitResult.fn({
          tx,
          ctx,
          args: {
            tool_block_id: "tool-1",
            turn_id: "turn-1",
            result: "output",
            block_id: "result-1",
            is_error: false,
          },
        });

        const tool = store.get("blocks", "tool-1");
        expect(tool?.status).toBe("completed");
      });

      it("should throw error when tool block not found", async () => {
        await expect(
          toolMutators.submitResult.fn({
            tx,
            ctx,
            args: {
              tool_block_id: "nonexistent",
              turn_id: "turn-1",
              result: "output",
              block_id: "result-1",
              is_error: false,
            },
          })
        ).rejects.toThrow("Tool block not found");
      });

      it("should throw error when tool block type is not 'tool_use'", async () => {
        store.set(
          "blocks",
          "text-block",
          createBlockFixture({
            id: "text-block",
            type: "text",
            turn_id: "turn-1",
          })
        );

        await expect(
          toolMutators.submitResult.fn({
            tx,
            ctx,
            args: {
              tool_block_id: "text-block",
              turn_id: "turn-1",
              result: "output",
              block_id: "result-1",
              is_error: false,
            },
          })
        ).rejects.toThrow("Tool block not found");
      });

      it("should throw error when turn not found", async () => {
        await expect(
          toolMutators.submitResult.fn({
            tx,
            ctx,
            args: {
              tool_block_id: "tool-1",
              turn_id: "nonexistent",
              result: "output",
              block_id: "result-1",
              is_error: false,
            },
          })
        ).rejects.toThrow("Turn not found");
      });

      it("should throw error when turn type is not 'user'", async () => {
        store.set(
          "turns",
          "turn-1",
          createTurnFixture({
            id: "turn-1",
            type: "assistant",
            locked: false,
          })
        );

        await expect(
          toolMutators.submitResult.fn({
            tx,
            ctx,
            args: {
              tool_block_id: "tool-1",
              turn_id: "turn-1",
              result: "output",
              block_id: "result-1",
              is_error: false,
            },
          })
        ).rejects.toThrow("Turn is not a user turn");
      });

      it("should throw error when turn is locked", async () => {
        store.set(
          "turns",
          "turn-1",
          createTurnFixture({
            id: "turn-1",
            type: "user",
            locked: true,
          })
        );

        await expect(
          toolMutators.submitResult.fn({
            tx,
            ctx,
            args: {
              tool_block_id: "tool-1",
              turn_id: "turn-1",
              result: "output",
              block_id: "result-1",
              is_error: false,
            },
          })
        ).rejects.toThrow("Turn is locked");
      });

      it("should handle is_error flag correctly", async () => {
        await toolMutators.submitResult.fn({
          tx,
          ctx,
          args: {
            tool_block_id: "tool-1",
            turn_id: "turn-1",
            result: "Command failed",
            block_id: "result-1",
            is_error: true,
          },
        });

        const result = store.get("blocks", "result-1");
        expect(result?.content.is_error).toBe(true);
      });
    });

    describe("approve", () => {
      it("should update tool_use block status to 'client_pending'", async () => {
        store.set(
          "blocks",
          "tool-1",
          createToolUseBlockFixture({
            id: "tool-1",
            type: "tool_use",
            status: "permission_pending",
          })
        );

        await toolMutators.approve.fn({
          tx,
          ctx,
          args: { block_id: "tool-1" },
        });

        const block = store.get("blocks", "tool-1");
        expect(block?.status).toBe("client_pending");
      });

      it("should update server_tool_use block status to 'server_pending'", async () => {
        store.set("blocks", "server-tool-1", {
          id: "server-tool-1",
          turn_id: "turn-1",
          type: "server_tool_use",
          status: "permission_pending",
          content: {
            type: "server_tool_use",
            id: "st-123",
            name: "web_search",
            input: { query: "test" },
          },
          complete: true,
          created_at: Date.now(),
          updated_at: Date.now(),
          processed: false,
          metadata: null,
          response_turn_id: null,
        });

        await toolMutators.approve.fn({
          tx,
          ctx,
          args: { block_id: "server-tool-1" },
        });

        const block = store.get("blocks", "server-tool-1");
        expect(block?.status).toBe("server_pending");
      });

      it("should throw error when block not found", async () => {
        await expect(
          toolMutators.approve.fn({
            tx,
            ctx,
            args: { block_id: "nonexistent" },
          })
        ).rejects.toThrow("Block not found");
      });

      it("should throw error when block type doesn't support approval", async () => {
        store.set(
          "blocks",
          "text-1",
          createBlockFixture({
            id: "text-1",
            type: "text",
          })
        );

        await expect(
          toolMutators.approve.fn({
            tx,
            ctx,
            args: { block_id: "text-1" },
          })
        ).rejects.toThrow("Block doesn't support permission approval");
      });
    });

    describe("deny", () => {
      beforeEach(() => {
        store.set(
          "blocks",
          "tool-1",
          createToolUseBlockFixture({
            id: "tool-1",
            status: "permission_pending",
          })
        );
        store.set(
          "turns",
          "turn-1",
          createTurnFixture({
            id: "turn-1",
            task_id: "task-1",
          })
        );
      });

      it("should update tool block status to 'completed'", async () => {
        await toolMutators.deny.fn({
          tx,
          ctx,
          args: {
            tool_block_id: "tool-1",
            turn_id: "turn-1",
            reason: "User denied",
            result_block_id: "result-1",
          },
        });

        const block = store.get("blocks", "tool-1");
        expect(block?.status).toBe("completed");
      });

      it("should create tool_result block with is_error=true", async () => {
        await toolMutators.deny.fn({
          tx,
          ctx,
          args: {
            tool_block_id: "tool-1",
            turn_id: "turn-1",
            reason: "User denied the request",
            result_block_id: "result-1",
          },
        });

        const result = store.get("blocks", "result-1");
        expect(result).toBeDefined();
        expect(result?.type).toBe("tool_result");
        expect(result?.content.is_error).toBe(true);
        expect(result?.content.content).toBe("User denied the request");
      });

      it("should throw error when block not found", async () => {
        await expect(
          toolMutators.deny.fn({
            tx,
            ctx,
            args: {
              tool_block_id: "nonexistent",
              turn_id: "turn-1",
              reason: "Denied",
              result_block_id: "result-1",
            },
          })
        ).rejects.toThrow("Block not found");
      });

      it("should throw error when block type is not tool_use or server_tool_use", async () => {
        store.set(
          "blocks",
          "text-1",
          createBlockFixture({
            id: "text-1",
            type: "text",
          })
        );

        await expect(
          toolMutators.deny.fn({
            tx,
            ctx,
            args: {
              tool_block_id: "text-1",
              turn_id: "turn-1",
              reason: "Denied",
              result_block_id: "result-1",
            },
          })
        ).rejects.toThrow("Block doesn't support permission denial");
      });
    });
  });
});
