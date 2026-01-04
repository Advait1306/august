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
  createMockDodoClient,
  createMockDodoClientWithCustomer,
} from "../../helpers/mock-dependencies";
import {
  createDodoCustomerPortalFixture,
  createExpiredDodoCustomerPortalFixture,
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

import { createOrganisationServerMutators } from "../../../features/organisation/server-mutators";

describe("organisation/server-mutators", () => {
  let store: MockDataStore;
  let tx: MockTransaction;
  let ctx: MockContext;
  let dodoClient: ReturnType<typeof createMockDodoClient>;
  let serverMutators: ReturnType<typeof createOrganisationServerMutators>;

  beforeEach(() => {
    store = new MockDataStore();
    setSharedStore(store);
    tx = createMockTransaction(store);
    ctx = createMockContext("user-1", "org-1");
    dodoClient = createMockDodoClient();

    // Create server mutators with dependencies
    serverMutators = createOrganisationServerMutators(dodoClient as any);
  });

  describe("dodoCustomerPortal.createLink", () => {
    describe("caching behavior", () => {
      it("should return early when cached link is less than 24 hours old", async () => {
        // Create a fresh cached link (less than 24 hours old)
        store.set(
          "dodoCustomerPortal",
          "org-1",
          createDodoCustomerPortalFixture({
            organisation_id: "org-1",
            link: "https://cached.portal.link",
            created_at: Date.now() - 1000 * 60 * 60, // 1 hour ago
          })
        );

        await serverMutators.dodoCustomerPortal.createLink.fn({
          tx,
          ctx,
          args: {},
        });

        // Should not call Dodo API
        expect(dodoClient.customers.list).not.toHaveBeenCalled();
      });

      it("should refresh link when cached link is more than 24 hours old", async () => {
        // Create an expired cached link
        store.set(
          "dodoCustomerPortal",
          "org-1",
          createExpiredDodoCustomerPortalFixture({
            organisation_id: "org-1",
            link: "https://old.portal.link",
          })
        );

        // Set up customer lookup to return a customer
        dodoClient = createMockDodoClientWithCustomer("cust_123");
        serverMutators = createOrganisationServerMutators(dodoClient as any);

        await serverMutators.dodoCustomerPortal.createLink.fn({
          tx,
          ctx,
          args: {},
        });

        // Should call Dodo API
        expect(dodoClient.customers.list).toHaveBeenCalledWith({
          email: "org-1@customer.august.tech",
        });
      });

      it("should create new link when no cache exists", async () => {
        dodoClient = createMockDodoClientWithCustomer("cust_123");
        serverMutators = createOrganisationServerMutators(dodoClient as any);

        await serverMutators.dodoCustomerPortal.createLink.fn({
          tx,
          ctx,
          args: {},
        });

        expect(dodoClient.customers.list).toHaveBeenCalled();
      });
    });

    describe("customer lookup", () => {
      it("should construct customer email from organisation_id", async () => {
        dodoClient = createMockDodoClientWithCustomer("cust_123");
        serverMutators = createOrganisationServerMutators(dodoClient as any);

        await serverMutators.dodoCustomerPortal.createLink.fn({
          tx,
          ctx,
          args: {},
        });

        expect(dodoClient.customers.list).toHaveBeenCalledWith({
          email: "org-1@customer.august.tech",
        });
      });

      it("should call dodoClient.customers.list with email", async () => {
        dodoClient = createMockDodoClientWithCustomer("cust_123");
        serverMutators = createOrganisationServerMutators(dodoClient as any);

        await serverMutators.dodoCustomerPortal.createLink.fn({
          tx,
          ctx,
          args: {},
        });

        expect(dodoClient.customers.list).toHaveBeenCalled();
      });

      it("should return early when no customer found", async () => {
        // Default mock returns empty items array
        await serverMutators.dodoCustomerPortal.createLink.fn({
          tx,
          ctx,
          args: {},
        });

        // Should not create portal session
        expect(
          dodoClient.customers.customerPortal.create
        ).not.toHaveBeenCalled();
      });
    });

    describe("portal session creation", () => {
      beforeEach(() => {
        dodoClient = createMockDodoClientWithCustomer("cust_123");
        serverMutators = createOrganisationServerMutators(dodoClient as any);
      });

      it("should call dodoClient.customers.customerPortal.create with customer_id", async () => {
        await serverMutators.dodoCustomerPortal.createLink.fn({
          tx,
          ctx,
          args: {},
        });

        expect(dodoClient.customers.customerPortal.create).toHaveBeenCalledWith(
          "cust_123"
        );
      });

      it("should update existing cache entry", async () => {
        // Set up existing cache
        store.set(
          "dodoCustomerPortal",
          "org-1",
          createExpiredDodoCustomerPortalFixture({
            organisation_id: "org-1",
            link: "https://old.link",
          })
        );

        await serverMutators.dodoCustomerPortal.createLink.fn({
          tx,
          ctx,
          args: {},
        });

        const cached = store.get("dodoCustomerPortal", "org-1");
        expect(cached?.link).toBe("https://portal.example.com/session");
      });

      it("should insert new cache entry when none exists", async () => {
        await serverMutators.dodoCustomerPortal.createLink.fn({
          tx,
          ctx,
          args: {},
        });

        const cached = store.get("dodoCustomerPortal", "org-1");
        expect(cached).toBeDefined();
        expect(cached?.link).toBe("https://portal.example.com/session");
      });

      it("should set created_at to current timestamp", async () => {
        const before = Date.now();

        await serverMutators.dodoCustomerPortal.createLink.fn({
          tx,
          ctx,
          args: {},
        });

        const after = Date.now();
        const cached = store.get("dodoCustomerPortal", "org-1");

        expect(cached?.created_at).toBeGreaterThanOrEqual(before);
        expect(cached?.created_at).toBeLessThanOrEqual(after);
      });
    });

    describe("TTL calculation", () => {
      it("should use 24 hours (86400000ms) as TTL", async () => {
        // Link created exactly 24 hours ago should trigger refresh
        const exactlyTwentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

        store.set(
          "dodoCustomerPortal",
          "org-1",
          createDodoCustomerPortalFixture({
            organisation_id: "org-1",
            created_at: exactlyTwentyFourHoursAgo,
          })
        );

        dodoClient = createMockDodoClientWithCustomer("cust_123");
        serverMutators = createOrganisationServerMutators(dodoClient as any);

        await serverMutators.dodoCustomerPortal.createLink.fn({
          tx,
          ctx,
          args: {},
        });

        // Should refresh since age >= TTL
        expect(dodoClient.customers.list).toHaveBeenCalled();
      });

      it("should compare current time against created_at", async () => {
        // Link created 23 hours ago should NOT trigger refresh
        const twentyThreeHoursAgo = Date.now() - 23 * 60 * 60 * 1000;

        store.set(
          "dodoCustomerPortal",
          "org-1",
          createDodoCustomerPortalFixture({
            organisation_id: "org-1",
            created_at: twentyThreeHoursAgo,
          })
        );

        await serverMutators.dodoCustomerPortal.createLink.fn({
          tx,
          ctx,
          args: {},
        });

        // Should NOT refresh since age < TTL
        expect(dodoClient.customers.list).not.toHaveBeenCalled();
      });
    });
  });
});
