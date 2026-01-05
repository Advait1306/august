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
  createMockAsyncTasks,
  createMockOAuthService,
} from "../../helpers/mock-dependencies";
import {
  createMcpFixture,
  createComposioMcpFixture,
  createMcpComposioConnectionFixture,
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

import { createMcpServerMutators } from "../../../features/mcps/server-mutators";
import type { AsyncTask, OAuthService } from "../../../features/types";

describe("mcps/server-mutators", () => {
  let store: MockDataStore;
  let tx: MockTransaction;
  let ctx: MockContext;
  let asyncTasks: AsyncTask;
  let oauthService: ReturnType<typeof createMockOAuthService>;
  let serverMutators: ReturnType<typeof createMcpServerMutators>;

  beforeEach(() => {
    store = new MockDataStore();
    setSharedStore(store);
    tx = createMockTransaction(store);
    ctx = createMockContext("user-1", "org-1");
    asyncTasks = createMockAsyncTasks();
    oauthService = createMockOAuthService();

    // Create server mutators with dependencies
    serverMutators = createMcpServerMutators(asyncTasks, oauthService);
  });

  describe("mcps.delete", () => {
    it("should validate MCP belongs to user", async () => {
      store.set(
        "mcps",
        "mcp-1",
        createMcpFixture({
          id: "mcp-1",
          author_id: "other-user", // Different user
        })
      );

      await expect(
        serverMutators.mcps.delete.fn({
          tx,
          ctx,
          args: { mcp_id: "mcp-1" },
        })
      ).rejects.toThrow("MCP not found or access denied");
    });

    it("should throw error when MCP not found", async () => {
      await expect(
        serverMutators.mcps.delete.fn({
          tx,
          ctx,
          args: { mcp_id: "nonexistent" },
        })
      ).rejects.toThrow("MCP not found or access denied");
    });

    describe("oauth integration", () => {
      beforeEach(() => {
        store.set(
          "mcps",
          "mcp-oauth",
          createMcpFixture({
            id: "mcp-oauth",
            author_id: "user-1",
            integration_type: "oauth",
          })
        );
      });

      it("should call oauthService.revokeToken for oauth type", async () => {
        await serverMutators.mcps.delete.fn({
          tx,
          ctx,
          args: { mcp_id: "mcp-oauth" },
        });

        expect(oauthService.revokeToken).toHaveBeenCalledWith({
          mcpId: "mcp-oauth",
        });
      });

      it("should handle revokeToken errors gracefully", async () => {
        oauthService.revokeToken = vi.fn().mockRejectedValue(new Error("Token revocation failed"));

        // Should not throw, just log the error
        await serverMutators.mcps.delete.fn({
          tx,
          ctx,
          args: { mcp_id: "mcp-oauth" },
        });

        // MCP should still be deleted
        const mcp = store.get("mcps", "mcp-oauth");
        expect(mcp).toBeUndefined();
      });

      it("should delete MCP after token revocation", async () => {
        await serverMutators.mcps.delete.fn({
          tx,
          ctx,
          args: { mcp_id: "mcp-oauth" },
        });

        const mcp = store.get("mcps", "mcp-oauth");
        expect(mcp).toBeUndefined();
      });
    });

    describe("composio integration", () => {
      beforeEach(() => {
        store.set(
          "mcps",
          "mcp-composio",
          createComposioMcpFixture({
            id: "mcp-composio",
            author_id: "user-1",
          })
        );
        store.set(
          "mcpComposioConnections",
          "conn-1",
          createMcpComposioConnectionFixture({
            id: "conn-1",
            mcp_id: "mcp-composio",
          })
        );
      });

      it("should find composio connection by mcp_id", async () => {
        await serverMutators.mcps.delete.fn({
          tx,
          ctx,
          args: { mcp_id: "mcp-composio" },
        });

        // Connection should be deleted
        const conn = store.get("mcpComposioConnections", "conn-1");
        expect(conn).toBeUndefined();
      });

      it("should throw error when composio connection not found", async () => {
        // Remove the connection
        store.delete("mcpComposioConnections", "conn-1");

        await expect(
          serverMutators.mcps.delete.fn({
            tx,
            ctx,
            args: { mcp_id: "mcp-composio" },
          })
        ).rejects.toThrow("Composio connection not found");
      });

      it("should delete composio connection", async () => {
        await serverMutators.mcps.delete.fn({
          tx,
          ctx,
          args: { mcp_id: "mcp-composio" },
        });

        const conn = store.get("mcpComposioConnections", "conn-1");
        expect(conn).toBeUndefined();
      });

      it("should delete MCP after connection cleanup", async () => {
        await serverMutators.mcps.delete.fn({
          tx,
          ctx,
          args: { mcp_id: "mcp-composio" },
        });

        const mcp = store.get("mcps", "mcp-composio");
        expect(mcp).toBeUndefined();
      });
    });
  });
});
