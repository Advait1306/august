import { vi } from "vitest";

// Use globalThis to share store reference between test setup and hoisted mocks
declare global {
  var __mockZeroStore: MockDataStore | undefined;
}

/**
 * Sets the shared store for the current test.
 * Call this in beforeEach to set up the store that the mocked builder will use.
 */
export function setSharedStore(store: MockDataStore) {
  globalThis.__mockZeroStore = store;
}

/**
 * Gets the shared store. Used internally by the mock builder.
 */
export function getSharedStore(): MockDataStore {
  if (!globalThis.__mockZeroStore) {
    throw new Error("Shared store not set. Call setSharedStore() in beforeEach.");
  }
  return globalThis.__mockZeroStore;
}

/**
 * Creates a mock Zero schema module for vi.hoisted() blocks.
 * This needs to be inlined in each test file's vi.hoisted() call because
 * vi.mock is hoisted and can't reference external imports.
 *
 * Usage in test files:
 * ```typescript
 * const mockZeroSchema = vi.hoisted(() => {
 *   // Copy the InlineMockQueryBuilder class here
 *   class InlineMockQueryBuilder<T = any> { ... }
 *   return {
 *     get builder() {
 *       const store = globalThis.__mockZeroStore;
 *       if (!store) throw new Error("Store not set");
 *       return new Proxy({}, {
 *         get: (_target: any, tableName: string) => {
 *           return new InlineMockQueryBuilder(store, tableName);
 *         },
 *       });
 *     },
 *   };
 * });
 * vi.mock("../../../zero/schema", () => mockZeroSchema);
 * ```
 */

// InlineMockQueryBuilder source for copy-paste into vi.hoisted blocks:
/*
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

      // Apply related conditions
      for (const { relationName, queryFn } of this.relatedQueries) {
        const rel = RELATIONSHIPS[this.tableName]?.[relationName];
        if (rel && queryFn) {
          results = results.filter((row: any) => {
            const foreignKey = row[rel.sourceField];
            if (!foreignKey) return false;

            // Create a query builder for the related table and apply the query function
            const relatedQuery = new InlineMockQueryBuilder(this.store, rel.destTable);
            relatedQuery.where(rel.destField, foreignKey);
            const configured = queryFn(relatedQuery);
            const relatedResults = configured._execute();

            // Row passes if the related record exists and matches conditions
            return relatedResults.length > 0;
          });
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
*/

// Table names in the schema
export type TableName =
  | "tasks"
  | "turns"
  | "blocks"
  | "skills"
  | "skillDocuments"
  | "taskSkills"
  | "mcps"
  | "mcpStore"
  | "mcpComposioConnections"
  | "mcpOauthConnections"
  | "organisations"
  | "usage"
  | "dodoCustomerPortal"
  | "runtimes"
  | "users";

/**
 * In-memory data store for tests.
 * Provides a simple key-value store for each table.
 */
export class MockDataStore {
  private data: Map<TableName, Map<string, any>> = new Map();

  constructor() {
    this.reset();
  }

  reset() {
    this.data = new Map();
    const tables: TableName[] = [
      "tasks",
      "turns",
      "blocks",
      "skills",
      "skillDocuments",
      "taskSkills",
      "mcps",
      "mcpStore",
      "mcpComposioConnections",
      "mcpOauthConnections",
      "organisations",
      "usage",
      "dodoCustomerPortal",
      "runtimes",
      "users",
    ];
    for (const table of tables) {
      this.data.set(table, new Map());
    }
  }

  get<T = any>(table: TableName, id: string): T | undefined {
    return this.data.get(table)?.get(id);
  }

  getAll<T = any>(table: TableName): T[] {
    return Array.from(this.data.get(table)?.values() || []);
  }

  set(table: TableName, id: string, value: any) {
    this.data.get(table)?.set(id, value);
  }

  delete(table: TableName, id: string) {
    this.data.get(table)?.delete(id);
  }

  query<T = any>(table: TableName, predicate: (row: T) => boolean): T[] {
    return this.getAll<T>(table).filter(predicate);
  }
}

/**
 * Mock query builder that simulates Zero's query builder pattern.
 * Supports chaining .where(), .one(), .orderBy(), .limit(), and .related()
 */
export class MockQueryBuilder<T = any> {
  private store: MockDataStore;
  private tableName: TableName;
  private conditions: Array<(row: any) => boolean> = [];
  private orderByField?: string;
  private orderByDirection: "asc" | "desc" = "asc";
  private limitCount?: number;

  constructor(store: MockDataStore, tableName: TableName) {
    this.store = store;
    this.tableName = tableName;
  }

  where(field: string, value: any): this {
    this.conditions.push((row) => row[field] === value);
    return this;
  }

  related(relationName: string, queryFn?: (q: any) => any): this {
    // For simplicity, related queries are handled when executing
    // This is a stub that returns self for chaining
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
    const results = this.execute();
    return results[0];
  }

  execute(): T[] {
    let results = this.store.getAll<T>(this.tableName);

    // Apply conditions
    for (const condition of this.conditions) {
      results = results.filter(condition);
    }

    // Apply ordering
    if (this.orderByField) {
      const field = this.orderByField;
      results.sort((a: any, b: any) => {
        const aVal = a[field];
        const bVal = b[field];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return this.orderByDirection === "asc" ? cmp : -cmp;
      });
    }

    // Apply limit
    if (this.limitCount !== undefined) {
      results = results.slice(0, this.limitCount);
    }

    return results;
  }
}

/**
 * Creates a mock table mutator with insert, update, upsert, and delete operations.
 */
function createTableMutator(
  store: MockDataStore,
  tableName: TableName,
  primaryKey: string | string[]
) {
  const getPrimaryKeyValue = (data: any): string => {
    if (Array.isArray(primaryKey)) {
      return primaryKey.map((k) => data[k]).join(":");
    }
    return data[primaryKey];
  };

  return {
    insert: vi.fn(async (data: any) => {
      store.set(tableName, getPrimaryKeyValue(data), { ...data });
    }),
    update: vi.fn(async (data: any) => {
      const id = getPrimaryKeyValue(data);
      const existing = store.get(tableName, id);
      if (existing) {
        store.set(tableName, id, { ...existing, ...data });
      }
    }),
    upsert: vi.fn(async (data: any) => {
      const id = getPrimaryKeyValue(data);
      const existing = store.get(tableName, id);
      if (existing) {
        store.set(tableName, id, { ...existing, ...data });
      } else {
        store.set(tableName, id, { ...data });
      }
    }),
    delete: vi.fn(async (data: any) => {
      store.delete(tableName, getPrimaryKeyValue(data));
    }),
  };
}

/**
 * Creates a mock transaction object that simulates Zero's transaction API.
 * - tx.run(query) executes a query or passes through results
 * - tx.mutate.{table}.{operation} performs CRUD operations on MockDataStore
 */
export function createMockTransaction(store: MockDataStore) {
  return {
    // AnyTransaction required properties
    location: "server" as const,
    clientID: "mock-client-id",
    mutationID: 1,
    reason: "authoritative" as const,
    run: vi.fn(async (query: any) => {
      // If query has execute method, call it (for lazy query objects)
      if (query && typeof query.execute === "function") {
        return query.execute();
      }
      // Otherwise, return the result as-is (for direct query results)
      return query;
    }),
    mutate: {
      tasks: createTableMutator(store, "tasks", "id"),
      turns: createTableMutator(store, "turns", "id"),
      blocks: createTableMutator(store, "blocks", "id"),
      skills: createTableMutator(store, "skills", "id"),
      skillDocuments: createTableMutator(store, "skillDocuments", "id"),
      taskSkills: createTableMutator(store, "taskSkills", [
        "task_id",
        "skill_id",
      ]),
      mcps: createTableMutator(store, "mcps", "id"),
      mcpStore: createTableMutator(store, "mcpStore", "id"),
      mcpComposioConnections: createTableMutator(
        store,
        "mcpComposioConnections",
        "id"
      ),
      mcpOauthConnections: createTableMutator(
        store,
        "mcpOauthConnections",
        "id"
      ),
      organisations: createTableMutator(store, "organisations", "id"),
      dodoCustomerPortal: createTableMutator(
        store,
        "dodoCustomerPortal",
        "organisation_id"
      ),
      runtimes: createTableMutator(store, "runtimes", "id"),
      users: createTableMutator(store, "users", "id"),
    },
  };
}

export type MockTransaction = ReturnType<typeof createMockTransaction>;

/**
 * Creates a mock auth context with userId and orgId.
 */
export function createMockContext(
  userId: string = "test-user-id",
  orgId: string = "test-org-id"
) {
  return {
    userId,
    orgId,
  };
}

export type MockContext = ReturnType<typeof createMockContext>;

/**
 * Creates a mock query builder factory that returns MockQueryBuilder instances.
 * Usage: const builder = createMockBuilder(store);
 *        builder.tasks.where("id", "123").one();
 */
export function createMockBuilder(store: MockDataStore) {
  const handler: ProxyHandler<object> = {
    get: (_target: any, tableName: string) => {
      return new MockQueryBuilder(store, tableName as TableName);
    },
  };
  return new Proxy({}, handler) as Record<TableName, MockQueryBuilder>;
}

/**
 * Creates a shared builder proxy that can be used with vi.mock.
 * This builder dynamically looks up the shared store when accessed,
 * allowing tests to set up their store in beforeEach and have queries work.
 *
 * Usage in tests:
 * const sharedBuilder = createSharedBuilder();
 * vi.mock("../../../zero/schema", () => ({ builder: sharedBuilder }));
 *
 * beforeEach(() => {
 *   store = new MockDataStore();
 *   setSharedStore(store);
 * });
 */
export function createSharedBuilder() {
  const handler: ProxyHandler<object> = {
    get: (_target: any, tableName: string) => {
      const store = getSharedStore();
      return new MockQueryBuilder(store, tableName as TableName);
    },
  };
  return new Proxy({}, handler) as Record<TableName, MockQueryBuilder>;
}
