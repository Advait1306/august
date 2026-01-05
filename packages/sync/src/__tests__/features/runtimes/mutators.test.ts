import { describe, it, expect, beforeEach } from "vitest";
import {
  MockDataStore,
  createMockTransaction,
  createMockContext,
  type MockTransaction,
  type MockContext,
} from "../../helpers/mock-zero";
import { createRuntimeFixture } from "../../helpers/fixtures";

import { runtimeMutators } from "../../../features/runtimes/mutators";

describe("runtimes/mutators", () => {
  let store: MockDataStore;
  let tx: MockTransaction;
  let ctx: MockContext;

  beforeEach(() => {
    store = new MockDataStore();
    tx = createMockTransaction(store);
    ctx = createMockContext("user-1", "org-1");
  });

  describe("runtimeMutators", () => {
    describe("register", () => {
      it("should upsert runtime with id and user_id", async () => {
        await runtimeMutators.register.fn({
          tx,
          ctx,
          args: {
            runtime_id: "runtime-1",
            tools: [{ name: "bash", version: "1.0.0" }],
          },
        });

        const runtime = store.get("runtimes", "runtime-1");
        expect(runtime).toBeDefined();
        expect(runtime?.id).toBe("runtime-1");
        expect(runtime?.user_id).toBe("user-1");
      });

      it("should store tools array", async () => {
        const tools = [
          { name: "bash", version: "1.0.0" },
          { name: "read", version: "1.0.0" },
          { name: "write", version: "1.0.0" },
        ];

        await runtimeMutators.register.fn({
          tx,
          ctx,
          args: {
            runtime_id: "runtime-1",
            tools,
          },
        });

        const runtime = store.get("runtimes", "runtime-1");
        expect(runtime?.tools).toEqual(tools);
      });

      it("should set created_at and updated_at timestamps", async () => {
        const before = Date.now();

        await runtimeMutators.register.fn({
          tx,
          ctx,
          args: {
            runtime_id: "runtime-1",
            tools: [],
          },
        });

        const after = Date.now();
        const runtime = store.get("runtimes", "runtime-1");

        expect(runtime?.created_at).toBeGreaterThanOrEqual(before);
        expect(runtime?.created_at).toBeLessThanOrEqual(after);
        expect(runtime?.updated_at).toBeGreaterThanOrEqual(before);
        expect(runtime?.updated_at).toBeLessThanOrEqual(after);
      });

      it("should update existing runtime on re-register", async () => {
        // First registration
        await runtimeMutators.register.fn({
          tx,
          ctx,
          args: {
            runtime_id: "runtime-1",
            tools: [{ name: "bash", version: "1.0.0" }],
          },
        });

        // Second registration with updated tools
        await runtimeMutators.register.fn({
          tx,
          ctx,
          args: {
            runtime_id: "runtime-1",
            tools: [
              { name: "bash", version: "1.0.0" },
              { name: "read", version: "2.0.0" },
            ],
          },
        });

        const runtime = store.get("runtimes", "runtime-1");
        expect(runtime?.tools).toHaveLength(2);
        expect(runtime?.tools).toContainEqual({ name: "read", version: "2.0.0" });
      });

      it("should handle empty tools array", async () => {
        await runtimeMutators.register.fn({
          tx,
          ctx,
          args: {
            runtime_id: "runtime-1",
            tools: [],
          },
        });

        const runtime = store.get("runtimes", "runtime-1");
        expect(runtime?.tools).toEqual([]);
      });
    });
  });
});
