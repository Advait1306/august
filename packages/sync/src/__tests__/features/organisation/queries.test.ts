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
  createOrganisationFixture,
  createUsageFixture,
  createDodoCustomerPortalFixture,
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
  organisationQueries,
  usageQueries,
  dodoCustomerPortalQueries,
} from "../../../features/organisation/queries";

describe("organisation/queries", () => {
  let store: MockDataStore;
  let ctx: MockContext;
  let tx: MockTransaction;

  beforeEach(() => {
    store = new MockDataStore();
    setSharedStore(store);
    ctx = createMockContext("user-1", "org-1");
    tx = createMockTransaction(store);
  });

  describe("organisationQueries", () => {
    describe("current", () => {
      it("should return organisation by ctx.orgId", async () => {
        store.set(
          "organisations",
          "org-1",
          createOrganisationFixture({
            id: "org-1",
          })
        );
        store.set(
          "organisations",
          "org-2",
          createOrganisationFixture({
            id: "org-2",
          })
        );

        const query = organisationQueries.current.fn({ ctx, args: {} });
        const result = await tx.run(query);

        expect(result?.id).toBe("org-1");
      });

      it("should return one() result", async () => {
        store.set(
          "organisations",
          "org-1",
          createOrganisationFixture({
            id: "org-1",
            subscription_status: "active",
          })
        );

        const query = organisationQueries.current.fn({ ctx, args: {} });
        const result = await tx.run(query);

        expect(result).toBeDefined();
        expect(result?.subscription_status).toBe("active");
      });

      it("should return undefined when organisation not found", async () => {
        const query = organisationQueries.current.fn({ ctx, args: {} });
        const result = await tx.run(query);

        expect(result).toBeUndefined();
      });
    });
  });

  describe("usageQueries", () => {
    describe("recent", () => {
      it("should return usage filtered by organisation_id", async () => {
        store.set(
          "usage",
          "1",
          createUsageFixture({
            id: 1,
            organisation_id: "org-1",
            created_at: 1000,
          })
        );
        store.set(
          "usage",
          "2",
          createUsageFixture({
            id: 2,
            organisation_id: "org-1",
            created_at: 2000,
          })
        );
        store.set(
          "usage",
          "3",
          createUsageFixture({
            id: 3,
            organisation_id: "other-org",
            created_at: 3000,
          })
        );

        const query = usageQueries.recent.fn({ ctx, args: {} });
        const results = await tx.run(query);

        expect(results).toHaveLength(2);
        expect(
          results.every((u: { organisation_id: string }) => u.organisation_id === "org-1")
        ).toBe(true);
      });

      it("should order by created_at descending", async () => {
        store.set(
          "usage",
          "1",
          createUsageFixture({
            id: 1,
            organisation_id: "org-1",
            created_at: 1000,
          })
        );
        store.set(
          "usage",
          "2",
          createUsageFixture({
            id: 2,
            organisation_id: "org-1",
            created_at: 3000,
          })
        );
        store.set(
          "usage",
          "3",
          createUsageFixture({
            id: 3,
            organisation_id: "org-1",
            created_at: 2000,
          })
        );

        const query = usageQueries.recent.fn({ ctx, args: {} });
        const results = await tx.run(query);

        expect(results[0]!.id).toBe(2); // Most recent
        expect(results[1]!.id).toBe(3);
        expect(results[2]!.id).toBe(1); // Oldest
      });

      it("should limit to 50 records", async () => {
        // Add 60 usage records
        for (let i = 1; i <= 60; i++) {
          store.set(
            "usage",
            String(i),
            createUsageFixture({
              id: i,
              organisation_id: "org-1",
              created_at: i * 1000,
            })
          );
        }

        const query = usageQueries.recent.fn({ ctx, args: {} });
        const results = await tx.run(query);

        expect(results).toHaveLength(50);
      });
    });
  });

  describe("dodoCustomerPortalQueries", () => {
    describe("current", () => {
      it("should return portal by organisation_id", async () => {
        store.set(
          "dodoCustomerPortal",
          "org-1",
          createDodoCustomerPortalFixture({
            organisation_id: "org-1",
            link: "https://portal.example.com/session",
          })
        );

        const query = dodoCustomerPortalQueries.current.fn({ ctx, args: {} });
        const result = await tx.run(query);

        expect(result).toBeDefined();
        expect(result?.link).toBe("https://portal.example.com/session");
      });

      it("should return one() result", async () => {
        store.set(
          "dodoCustomerPortal",
          "org-1",
          createDodoCustomerPortalFixture({
            organisation_id: "org-1",
          })
        );

        const query = dodoCustomerPortalQueries.current.fn({ ctx, args: {} });
        const result = await tx.run(query);

        expect(result?.organisation_id).toBe("org-1");
      });

      it("should return undefined when no portal exists", async () => {
        const query = dodoCustomerPortalQueries.current.fn({ ctx, args: {} });
        const result = await tx.run(query);

        expect(result).toBeUndefined();
      });
    });
  });
});
