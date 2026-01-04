import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MockDataStore,
  createMockTransaction,
  createMockContext,
  type MockTransaction,
  type MockContext,
} from "../../helpers/mock-zero";

import { createRuntimeServerMutators } from "../../../features/runtimes/server-mutators";

describe("runtimes/server-mutators", () => {
  let store: MockDataStore;
  let tx: MockTransaction;
  let ctx: MockContext;
  let serverMutators: ReturnType<typeof createRuntimeServerMutators>;

  beforeEach(() => {
    store = new MockDataStore();
    tx = createMockTransaction(store);
    ctx = createMockContext("user-1", "org-1");

    serverMutators = createRuntimeServerMutators();
  });

  describe("runtimes.register", () => {
    it("should call base runtimeMutators.register", async () => {
      await serverMutators.runtimes.register.fn({
        tx,
        ctx,
        args: {
          runtime_id: "runtime-1",
          tools: [{ name: "bash", version: "1.0.0" }],
        },
      });

      const runtime = store.get("runtimes", "runtime-1");
      expect(runtime).toBeDefined();
      expect(runtime?.user_id).toBe("user-1");
    });

    it("should pass through all arguments correctly", async () => {
      const tools = [
        { name: "bash", version: "1.0.0" },
        { name: "read", version: "2.0.0" },
        { name: "write", version: "1.5.0" },
      ];

      await serverMutators.runtimes.register.fn({
        tx,
        ctx,
        args: {
          runtime_id: "runtime-123",
          tools,
        },
      });

      const runtime = store.get("runtimes", "runtime-123");
      expect(runtime?.id).toBe("runtime-123");
      expect(runtime?.tools).toEqual(tools);
    });

    it("should create runtime with correct user_id from context", async () => {
      const customCtx = createMockContext("custom-user", "custom-org");

      await serverMutators.runtimes.register.fn({
        tx,
        ctx: customCtx,
        args: {
          runtime_id: "runtime-1",
          tools: [],
        },
      });

      const runtime = store.get("runtimes", "runtime-1");
      expect(runtime?.user_id).toBe("custom-user");
    });
  });
});
