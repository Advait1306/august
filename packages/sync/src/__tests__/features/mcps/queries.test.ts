import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MockDataStore,
  createMockContext,
  setSharedStore,
  type MockContext,
} from "../../helpers/mock-zero";
import { createMcpFixture, createMcpStoreFixture } from "../../helpers/fixtures";

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

import { mcpQueries, mcpStoreQueries } from "../../../features/mcps/queries";

describe("mcps/queries", () => {
  let store: MockDataStore;
  let ctx: MockContext;

  beforeEach(() => {
    store = new MockDataStore();
    setSharedStore(store);
    ctx = createMockContext("user-1", "org-1");
  });

  describe("mcpQueries", () => {
    describe("all", () => {
      it("should return MCPs filtered by author_id and organisation_id", () => {
        store.set(
          "mcps",
          "mcp-1",
          createMcpFixture({
            id: "mcp-1",
            author_id: "user-1",
            organisation_id: "org-1",
            created_at: 1000,
          })
        );
        store.set(
          "mcps",
          "mcp-2",
          createMcpFixture({
            id: "mcp-2",
            author_id: "user-1",
            organisation_id: "org-1",
            created_at: 2000,
          })
        );
        store.set(
          "mcps",
          "mcp-3",
          createMcpFixture({
            id: "mcp-3",
            author_id: "other-user",
            organisation_id: "org-1",
            created_at: 3000,
          })
        );

        const query = mcpQueries.all.fn({ ctx, args: {} });
        const results = query.execute();

        expect(results).toHaveLength(2);
        expect(results.every((m: any) => m.author_id === "user-1")).toBe(true);
      });

      it("should order by created_at descending", () => {
        store.set(
          "mcps",
          "mcp-1",
          createMcpFixture({
            id: "mcp-1",
            author_id: "user-1",
            organisation_id: "org-1",
            created_at: 1000,
          })
        );
        store.set(
          "mcps",
          "mcp-2",
          createMcpFixture({
            id: "mcp-2",
            author_id: "user-1",
            organisation_id: "org-1",
            created_at: 3000,
          })
        );

        const query = mcpQueries.all.fn({ ctx, args: {} });
        const results = query.execute();

        expect(results[0].id).toBe("mcp-2"); // Most recent
        expect(results[1].id).toBe("mcp-1");
      });
    });
  });

  describe("mcpStoreQueries", () => {
    describe("active", () => {
      it("should return MCP store items where is_active = 1", () => {
        store.set(
          "mcpStore",
          "store-1",
          createMcpStoreFixture({
            id: "store-1",
            is_active: 1,
            sort_order: 2,
          })
        );
        store.set(
          "mcpStore",
          "store-2",
          createMcpStoreFixture({
            id: "store-2",
            is_active: 1,
            sort_order: 1,
          })
        );
        store.set(
          "mcpStore",
          "store-3",
          createMcpStoreFixture({
            id: "store-3",
            is_active: 0, // Inactive
            sort_order: 3,
          })
        );

        const query = mcpStoreQueries.active.fn({ ctx, args: {} });
        const results = query.execute();

        expect(results).toHaveLength(2);
        expect(results.every((s: any) => s.is_active === 1)).toBe(true);
      });

      it("should order by sort_order ascending", () => {
        store.set(
          "mcpStore",
          "store-1",
          createMcpStoreFixture({
            id: "store-1",
            is_active: 1,
            sort_order: 3,
          })
        );
        store.set(
          "mcpStore",
          "store-2",
          createMcpStoreFixture({
            id: "store-2",
            is_active: 1,
            sort_order: 1,
          })
        );
        store.set(
          "mcpStore",
          "store-3",
          createMcpStoreFixture({
            id: "store-3",
            is_active: 1,
            sort_order: 2,
          })
        );

        const query = mcpStoreQueries.active.fn({ ctx, args: {} });
        const results = query.execute();

        expect(results[0].id).toBe("store-2"); // sort_order: 1
        expect(results[1].id).toBe("store-3"); // sort_order: 2
        expect(results[2].id).toBe("store-1"); // sort_order: 3
      });
    });
  });
});
