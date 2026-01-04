import { describe, it, expect, vi, beforeEach, type MockInstance } from "vitest";
import { BillingService } from "../../../services/billing.service.js";
import type { AppState } from "../../../config/state.js";
import type DodoPayments from "dodopayments";

// Types for mock functions
type MockFn<TArgs extends unknown[] = unknown[], TReturn = unknown> = MockInstance<
  (...args: TArgs) => TReturn
> &
  ((...args: TArgs) => TReturn);

interface MockDb {
  select: MockFn;
  update: MockFn;
}

interface MockCheckoutSessionsCreate {
  create: MockFn<
    [unknown],
    Promise<{ checkout_url: string; session_id: string }>
  >;
}

interface MockDodoClient {
  checkoutSessions: MockCheckoutSessionsCreate;
}

function createMockDb(): MockDb {
  return {
    select: vi.fn(),
    update: vi.fn(),
  };
}

function createMockDodoClient(): MockDodoClient {
  return {
    checkoutSessions: {
      create: vi.fn().mockResolvedValue({
        checkout_url: "https://checkout.dodopayments.com/session_test123",
        session_id: "session_test123",
      }),
    },
  };
}

describe("BillingService", () => {
  let service: BillingService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockDodoClient: ReturnType<typeof createMockDodoClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton
    (BillingService as unknown as { instance: BillingService | null }).instance = null;
    mockDb = createMockDb();
    mockDodoClient = createMockDodoClient();
    service = BillingService.getInstance(
      mockDb as unknown as AppState["db"],
      mockDodoClient as unknown as DodoPayments
    );
  });

  describe("getInstance", () => {
    it("returns the same instance on subsequent calls", () => {
      const instance1 = BillingService.getInstance(
        mockDb as unknown as AppState["db"],
        mockDodoClient as unknown as DodoPayments
      );
      const instance2 = BillingService.getInstance(
        mockDb as unknown as AppState["db"],
        mockDodoClient as unknown as DodoPayments
      );

      expect(instance1).toBe(instance2);
    });

    it("creates new instance after reset", () => {
      const instance1 = BillingService.getInstance(
        mockDb as unknown as AppState["db"],
        mockDodoClient as unknown as DodoPayments
      );

      // Reset singleton
      (BillingService as unknown as { instance: BillingService | null }).instance = null;

      const newMockDb = createMockDb();
      const newMockDodoClient = createMockDodoClient();
      const instance2 = BillingService.getInstance(
        newMockDb as unknown as AppState["db"],
        newMockDodoClient as unknown as DodoPayments
      );

      expect(instance1).not.toBe(instance2);
    });
  });

  describe("createCheckoutSession", () => {
    it("creates checkout session with correct parameters", async () => {
      const result = await service.createCheckoutSession({
        userId: "user_123",
        organisationId: "org_456",
        returnUrl: "https://example.com/return",
        memberCount: 3,
      });

      expect(result).toEqual({
        checkoutUrl: "https://checkout.dodopayments.com/session_test123",
        sessionId: "session_test123",
      });

      expect(mockDodoClient.checkoutSessions.create).toHaveBeenCalledWith({
        product_cart: [
          {
            product_id: expect.any(String),
            quantity: 1,
            addons: [{ addon_id: expect.any(String), quantity: 2 }],
          },
        ],
        customer: {
          name: "",
          email: "org_456@customer.august.tech",
        },
        return_url: "https://example.com/return",
        metadata: {
          organisation_id: "org_456",
        },
      });
    });

    it("creates checkout session without addons when memberCount is 1", async () => {
      await service.createCheckoutSession({
        userId: "user_123",
        organisationId: "org_456",
        returnUrl: "https://example.com/return",
        memberCount: 1,
      });

      expect(mockDodoClient.checkoutSessions.create).toHaveBeenCalledWith({
        product_cart: [
          {
            product_id: expect.any(String),
            quantity: 1,
            addons: undefined,
          },
        ],
        customer: {
          name: "",
          email: "org_456@customer.august.tech",
        },
        return_url: "https://example.com/return",
        metadata: {
          organisation_id: "org_456",
        },
      });
    });

    it("creates checkout session without addons when memberCount is 0", async () => {
      await service.createCheckoutSession({
        userId: "user_123",
        organisationId: "org_456",
        returnUrl: "https://example.com/return",
        memberCount: 0,
      });

      expect(mockDodoClient.checkoutSessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          product_cart: [
            expect.objectContaining({
              addons: undefined,
            }),
          ],
        })
      );
    });

    it("includes customerName when provided", async () => {
      await service.createCheckoutSession({
        userId: "user_123",
        organisationId: "org_456",
        returnUrl: "https://example.com/return",
        memberCount: 1,
        customerName: "Test Customer",
      });

      expect(mockDodoClient.checkoutSessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: {
            name: "Test Customer",
            email: "org_456@customer.august.tech",
          },
        })
      );
    });

    it("calculates addon seats correctly for various member counts", async () => {
      // 5 members = 4 addon seats
      await service.createCheckoutSession({
        userId: "user_123",
        organisationId: "org_456",
        returnUrl: "https://example.com/return",
        memberCount: 5,
      });

      expect(mockDodoClient.checkoutSessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          product_cart: [
            expect.objectContaining({
              addons: [{ addon_id: expect.any(String), quantity: 4 }],
            }),
          ],
        })
      );

      vi.clearAllMocks();

      // 10 members = 9 addon seats
      await service.createCheckoutSession({
        userId: "user_123",
        organisationId: "org_456",
        returnUrl: "https://example.com/return",
        memberCount: 10,
      });

      expect(mockDodoClient.checkoutSessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          product_cart: [
            expect.objectContaining({
              addons: [{ addon_id: expect.any(String), quantity: 9 }],
            }),
          ],
        })
      );
    });

    it("throws error when Dodo API fails", async () => {
      mockDodoClient.checkoutSessions.create.mockRejectedValue(
        new Error("Dodo API error")
      );

      await expect(
        service.createCheckoutSession({
          userId: "user_123",
          organisationId: "org_456",
          returnUrl: "https://example.com/return",
          memberCount: 1,
        })
      ).rejects.toThrow("Dodo API error");
    });

    it("generates correct customer email from organisation ID", async () => {
      await service.createCheckoutSession({
        userId: "user_123",
        organisationId: "org_custom_id",
        returnUrl: "https://example.com/return",
        memberCount: 1,
      });

      expect(mockDodoClient.checkoutSessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: expect.objectContaining({
            email: "org_custom_id@customer.august.tech",
          }),
        })
      );
    });
  });
});
