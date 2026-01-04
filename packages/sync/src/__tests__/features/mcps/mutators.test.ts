import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MockDataStore,
  createMockTransaction,
  createMockContext,
  type MockTransaction,
  type MockContext,
} from "../../helpers/mock-zero";
import { createMcpFixture } from "../../helpers/fixtures";

import { mcpMutators } from "../../../features/mcps/mutators";

describe("mcps/mutators", () => {
  let store: MockDataStore;
  let tx: MockTransaction;
  let ctx: MockContext;

  beforeEach(() => {
    store = new MockDataStore();
    tx = createMockTransaction(store);
    ctx = createMockContext("user-1", "org-1");
  });

  describe("mcpMutators", () => {
    describe("delete", () => {
      beforeEach(() => {
        store.set(
          "mcps",
          "mcp-1",
          createMcpFixture({
            id: "mcp-1",
            author_id: "user-1",
          })
        );
      });

      it("should delete MCP by id", async () => {
        await mcpMutators.delete.fn({
          tx,
          ctx,
          args: { mcp_id: "mcp-1" },
        });

        const mcp = store.get("mcps", "mcp-1");
        expect(mcp).toBeUndefined();
      });
    });
  });
});
