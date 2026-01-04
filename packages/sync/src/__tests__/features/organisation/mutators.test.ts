import { describe, it, expect, beforeEach } from "vitest";
import {
  MockDataStore,
  createMockTransaction,
  createMockContext,
  type MockTransaction,
  type MockContext,
} from "../../helpers/mock-zero";

import { dodoCustomerPortalMutators } from "../../../features/organisation/mutators";

describe("organisation/mutators", () => {
  let store: MockDataStore;
  let tx: MockTransaction;
  let ctx: MockContext;

  beforeEach(() => {
    store = new MockDataStore();
    tx = createMockTransaction(store);
    ctx = createMockContext("user-1", "org-1");
  });

  describe("dodoCustomerPortalMutators", () => {
    describe("createLink", () => {
      it("should be a no-op on client side", async () => {
        // The client-side mutator is just a stub
        await dodoCustomerPortalMutators.createLink.fn({
          tx,
          ctx,
          args: {},
        });

        // Nothing should happen - no errors, no data changes
        const portal = store.get("dodoCustomerPortal", "org-1");
        expect(portal).toBeUndefined();
      });
    });
  });
});
