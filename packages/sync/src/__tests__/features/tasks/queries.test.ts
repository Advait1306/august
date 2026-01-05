import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MockDataStore,
  createMockContext,
  createMockTransaction,
  setSharedStore,
  type MockContext,
  type MockTransaction,
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

import {
  taskQueries,
  turnQueries,
  blockQueries,
  todoQueries,
} from "../../../features/tasks/queries";

describe("tasks/queries", () => {
  let store: MockDataStore;
  let ctx: MockContext;
  let tx: MockTransaction;

  beforeEach(() => {
    store = new MockDataStore();
    setSharedStore(store);
    ctx = createMockContext("user-1", "org-1");
    tx = createMockTransaction(store);
  });

  describe("taskQueries", () => {
    describe("all", () => {
      it("should return tasks filtered by author_id and organisation_id", async () => {
        // Set up tasks
        store.set(
          "tasks",
          "task-1",
          createTaskFixture({
            id: "task-1",
            author_id: "user-1",
            organisation_id: "org-1",
            created_at: 1000,
          })
        );
        store.set(
          "tasks",
          "task-2",
          createTaskFixture({
            id: "task-2",
            author_id: "user-1",
            organisation_id: "org-1",
            created_at: 2000,
          })
        );
        store.set(
          "tasks",
          "task-3",
          createTaskFixture({
            id: "task-3",
            author_id: "other-user",
            organisation_id: "org-1",
            created_at: 3000,
          })
        );

        // Execute the query
        const query = taskQueries.all.fn({ ctx, args: {} });

        // The query is a builder chain, execute it via tx.run
        const results = await tx.run(query);

        // Should only include user-1's tasks
        expect(results).toHaveLength(2);
        expect(results.every((t: { author_id: string }) => t.author_id === "user-1")).toBe(true);
      });

      it("should order tasks by created_at descending", async () => {
        store.set(
          "tasks",
          "task-1",
          createTaskFixture({
            id: "task-1",
            author_id: "user-1",
            organisation_id: "org-1",
            created_at: 1000,
          })
        );
        store.set(
          "tasks",
          "task-2",
          createTaskFixture({
            id: "task-2",
            author_id: "user-1",
            organisation_id: "org-1",
            created_at: 3000,
          })
        );
        store.set(
          "tasks",
          "task-3",
          createTaskFixture({
            id: "task-3",
            author_id: "user-1",
            organisation_id: "org-1",
            created_at: 2000,
          })
        );

        const query = taskQueries.all.fn({ ctx, args: {} });
        const results = await tx.run(query);

        expect(results[0]!.id).toBe("task-2"); // Most recent
        expect(results[1]!.id).toBe("task-3");
        expect(results[2]!.id).toBe("task-1"); // Oldest
      });

      it("should return empty array when no tasks match", async () => {
        store.set(
          "tasks",
          "task-1",
          createTaskFixture({
            id: "task-1",
            author_id: "other-user",
            organisation_id: "other-org",
          })
        );

        const query = taskQueries.all.fn({ ctx, args: {} });
        const results = await tx.run(query);

        expect(results).toHaveLength(0);
      });
    });
  });

  describe("turnQueries", () => {
    describe("byTask", () => {
      it("should return turns for a specific task", async () => {
        store.set(
          "turns",
          "turn-1",
          createTurnFixture({
            id: "turn-1",
            task_id: "task-1",
            created_at: 1000,
          })
        );
        store.set(
          "turns",
          "turn-2",
          createTurnFixture({
            id: "turn-2",
            task_id: "task-1",
            created_at: 2000,
          })
        );
        store.set(
          "turns",
          "turn-3",
          createTurnFixture({
            id: "turn-3",
            task_id: "task-2", // Different task
            created_at: 3000,
          })
        );

        const query = turnQueries.byTask.fn({
          ctx,
          args: { taskId: "task-1" },
        });
        const results = await tx.run(query);

        expect(results).toHaveLength(2);
        expect(results.every((t: { task_id: string }) => t.task_id === "task-1")).toBe(true);
      });

      it("should order turns by created_at ascending", async () => {
        store.set(
          "turns",
          "turn-1",
          createTurnFixture({
            id: "turn-1",
            task_id: "task-1",
            created_at: 3000,
          })
        );
        store.set(
          "turns",
          "turn-2",
          createTurnFixture({
            id: "turn-2",
            task_id: "task-1",
            created_at: 1000,
          })
        );
        store.set(
          "turns",
          "turn-3",
          createTurnFixture({
            id: "turn-3",
            task_id: "task-1",
            created_at: 2000,
          })
        );

        const query = turnQueries.byTask.fn({
          ctx,
          args: { taskId: "task-1" },
        });
        const results = await tx.run(query);

        expect(results[0]!.id).toBe("turn-2"); // Oldest first
        expect(results[1]!.id).toBe("turn-3");
        expect(results[2]!.id).toBe("turn-1"); // Most recent last
      });
    });
  });

  describe("blockQueries", () => {
    describe("byTurn", () => {
      it("should return blocks for a specific turn", async () => {
        store.set(
          "blocks",
          "block-1",
          createBlockFixture({
            id: "block-1",
            turn_id: "turn-1",
            created_at: 1000,
          })
        );
        store.set(
          "blocks",
          "block-2",
          createBlockFixture({
            id: "block-2",
            turn_id: "turn-1",
            created_at: 2000,
          })
        );
        store.set(
          "blocks",
          "block-3",
          createBlockFixture({
            id: "block-3",
            turn_id: "turn-2", // Different turn
            created_at: 3000,
          })
        );

        const query = blockQueries.byTurn.fn({
          ctx,
          args: { turnId: "turn-1" },
        });
        const results = await tx.run(query);

        expect(results).toHaveLength(2);
        expect(results.every((b: { turn_id: string }) => b.turn_id === "turn-1")).toBe(true);
      });

      it("should order blocks by created_at ascending", async () => {
        store.set(
          "blocks",
          "block-1",
          createBlockFixture({
            id: "block-1",
            turn_id: "turn-1",
            created_at: 3000,
          })
        );
        store.set(
          "blocks",
          "block-2",
          createBlockFixture({
            id: "block-2",
            turn_id: "turn-1",
            created_at: 1000,
          })
        );

        const query = blockQueries.byTurn.fn({
          ctx,
          args: { turnId: "turn-1" },
        });
        const results = await tx.run(query);

        expect(results[0]!.id).toBe("block-2"); // Oldest first
        expect(results[1]!.id).toBe("block-1");
      });
    });

    describe("getPendingShellTools", () => {
      beforeEach(() => {
        // Set up required task and turn for the related queries
        store.set(
          "tasks",
          "task-1",
          createTaskFixture({
            id: "task-1",
            author_id: "user-1",
            organisation_id: "org-1",
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

      it("should return blocks with status client_pending, type tool_use, complete true", async () => {
        store.set(
          "blocks",
          "pending-1",
          createToolUseBlockFixture({
            id: "pending-1",
            turn_id: "turn-1",
            status: "client_pending",
            type: "tool_use",
            complete: true,
          })
        );
        store.set(
          "blocks",
          "not-pending",
          createToolUseBlockFixture({
            id: "not-pending",
            turn_id: "turn-1",
            status: "permission_pending", // Not client_pending
            type: "tool_use",
            complete: true,
          })
        );
        store.set(
          "blocks",
          "wrong-type",
          createBlockFixture({
            id: "wrong-type",
            turn_id: "turn-1",
            status: "client_pending",
            type: "text", // Not tool_use
            complete: true,
          })
        );

        const query = blockQueries.getPendingShellTools.fn({ ctx, args: {} });
        const results = await tx.run(query);

        expect(results).toHaveLength(1);
        expect(results[0]!.id).toBe("pending-1");
      });

      it("should return empty when no pending tools exist", async () => {
        store.set(
          "blocks",
          "completed",
          createToolUseBlockFixture({
            id: "completed",
            status: "completed",
          })
        );

        const query = blockQueries.getPendingShellTools.fn({ ctx, args: {} });
        const results = await tx.run(query);

        expect(results).toHaveLength(0);
      });
    });
  });

  describe("todoQueries", () => {
    describe("byTask", () => {
      it("should return turns for a task", async () => {
        store.set(
          "turns",
          "turn-1",
          createTurnFixture({
            id: "turn-1",
            task_id: "task-1",
            created_at: 1000,
          })
        );
        store.set(
          "turns",
          "turn-2",
          createTurnFixture({
            id: "turn-2",
            task_id: "task-1",
            created_at: 2000,
          })
        );

        const query = todoQueries.byTask.fn({
          ctx,
          args: { taskId: "task-1" },
        });
        const results = await tx.run(query);

        expect(results).toHaveLength(2);
      });

      it("should order by created_at descending", async () => {
        store.set(
          "turns",
          "turn-1",
          createTurnFixture({
            id: "turn-1",
            task_id: "task-1",
            created_at: 1000,
          })
        );
        store.set(
          "turns",
          "turn-2",
          createTurnFixture({
            id: "turn-2",
            task_id: "task-1",
            created_at: 2000,
          })
        );

        const query = todoQueries.byTask.fn({
          ctx,
          args: { taskId: "task-1" },
        });
        const results = await tx.run(query);

        expect(results[0]!.id).toBe("turn-2"); // Most recent first
        expect(results[1]!.id).toBe("turn-1");
      });
    });
  });
});
