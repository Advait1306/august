import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import {
  DodoWebhookService,
  type WebhookEvent,
  type WebhookHeaders,
} from "../../../services/dodo-webhook.service.js";
import type { AppState } from "../../../config/state.js";
import type { SubscriptionService } from "../../../services/subscription.service.js";

// Use vi.hoisted to create the mock function before vi.mock is hoisted
const { mockVerifyFn } = vi.hoisted(() => ({
  mockVerifyFn: vi.fn(),
}));

// Mock standardwebhooks with a class
vi.mock("standardwebhooks", () => {
  return {
    Webhook: class MockWebhook {
      constructor(_secret: string) {
        // Store secret if needed
      }
      verify(...args: unknown[]) {
        return mockVerifyFn(...args);
      }
    },
  };
});

// Types for mock functions
type MockFn<TArgs extends unknown[] = unknown[], TReturn = unknown> = MockInstance<
  (...args: TArgs) => TReturn
> &
  ((...args: TArgs) => TReturn);

interface MockDb {
  select: MockFn<
    [],
    {
      from: MockFn<
        [],
        {
          where: MockFn<
            [],
            {
              limit: MockFn<[], Promise<{ id: string; subscription_id: string | null }[]>>;
            }
          >;
        }
      >;
    }
  >;
}

interface MockSubscriptionService {
  updateSubscriptionStatus: MockFn<[string, string, string?], Promise<void>>;
}

function createMockDb(): MockDb {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  };
}

function createMockSubscriptionService(): MockSubscriptionService {
  return {
    updateSubscriptionStatus: vi.fn().mockResolvedValue(undefined),
  };
}

describe("DodoWebhookService", () => {
  let service: DodoWebhookService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockSubscriptionService: ReturnType<typeof createMockSubscriptionService>;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton
    (DodoWebhookService as unknown as { instance: DodoWebhookService | null }).instance = null;
    mockDb = createMockDb();
    mockSubscriptionService = createMockSubscriptionService();
    service = DodoWebhookService.getInstance(mockDb as unknown as AppState["db"]);

    // Set up environment
    process.env = { ...originalEnv, DODO_WEBHOOK_SECRET: "whsec_test_secret" };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("getInstance", () => {
    it("returns the same instance on subsequent calls", () => {
      const instance1 = DodoWebhookService.getInstance(mockDb as unknown as AppState["db"]);
      const instance2 = DodoWebhookService.getInstance(mockDb as unknown as AppState["db"]);

      expect(instance1).toBe(instance2);
    });

    it("creates new instance after reset", () => {
      const instance1 = DodoWebhookService.getInstance(mockDb as unknown as AppState["db"]);

      // Reset singleton
      (DodoWebhookService as unknown as { instance: DodoWebhookService | null }).instance = null;

      const newMockDb = createMockDb();
      const instance2 = DodoWebhookService.getInstance(
        newMockDb as unknown as AppState["db"]
      );

      expect(instance1).not.toBe(instance2);
    });
  });

  describe("verifyAndParseWebhook", () => {
    const validHeaders: WebhookHeaders = {
      webhookId: "wh_test123",
      webhookTimestamp: "1234567890",
      webhookSignature: "v1,test_signature",
    };

    const validPayload = JSON.stringify({
      type: "subscription.active",
      data: {
        subscription_id: "sub_123",
        metadata: { organisation_id: "org_123" },
      },
    });

    it("throws error when DODO_WEBHOOK_SECRET is not configured", async () => {
      delete process.env.DODO_WEBHOOK_SECRET;

      await expect(
        service.verifyAndParseWebhook(validPayload, validHeaders)
      ).rejects.toThrow("DODO_WEBHOOK_SECRET not configured");
    });

    it("verifies webhook with correct headers format", async () => {
      mockVerifyFn.mockReturnValue({
        type: "subscription.active",
        data: { subscription_id: "sub_123" },
      });

      await service.verifyAndParseWebhook(validPayload, validHeaders);

      // Verify the mock verify function was called with correct payload and formatted headers
      expect(mockVerifyFn).toHaveBeenCalledWith(validPayload, {
        "webhook-id": "wh_test123",
        "webhook-signature": "v1,test_signature",
        "webhook-timestamp": "1234567890",
      });
    });

    it("returns parsed webhook event on successful verification", async () => {
      const expectedEvent = {
        type: "subscription.active",
        data: {
          subscription_id: "sub_123",
          metadata: { organisation_id: "org_123" },
        },
      };

      mockVerifyFn.mockReturnValue(expectedEvent);

      const result = await service.verifyAndParseWebhook(validPayload, validHeaders);

      expect(result).toEqual(expectedEvent);
    });

    it("throws error when signature verification fails", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockVerifyFn.mockImplementation(() => {
        throw new Error("Signature mismatch");
      });

      await expect(
        service.verifyAndParseWebhook(validPayload, validHeaders)
      ).rejects.toThrow("Invalid signature");

      expect(consoleSpy).toHaveBeenCalledWith(
        "Webhook signature verification failed:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("resolveOrganisationId", () => {
    it("returns organisation_id from metadata when present", async () => {
      const result = await service.resolveOrganisationId("sub_123", {
        organisation_id: "org_from_metadata",
      });

      expect(result).toBe("org_from_metadata");
      // Should not query database
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("looks up organisation by subscription_id when metadata is missing", async () => {
      mockDb.select().from().where().limit.mockResolvedValue([
        { id: "org_from_db", subscription_id: "sub_123" },
      ]);

      const result = await service.resolveOrganisationId("sub_123", undefined);

      expect(result).toBe("org_from_db");
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("looks up organisation when metadata has no organisation_id", async () => {
      mockDb.select().from().where().limit.mockResolvedValue([
        { id: "org_from_db", subscription_id: "sub_123" },
      ]);

      const result = await service.resolveOrganisationId("sub_123", {});

      expect(result).toBe("org_from_db");
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("returns null when organisation cannot be found", async () => {
      mockDb.select().from().where().limit.mockResolvedValue([]);

      const result = await service.resolveOrganisationId("sub_unknown", undefined);

      expect(result).toBeNull();
    });

    it("handles metadata being a non-object value", async () => {
      mockDb.select().from().where().limit.mockResolvedValue([
        { id: "org_from_db", subscription_id: "sub_123" },
      ]);

      // Pass null as metadata (edge case)
      const result = await service.resolveOrganisationId(
        "sub_123",
        null as unknown as { organisation_id?: string }
      );

      expect(result).toBe("org_from_db");
    });
  });

  describe("handleWebhookEvent", () => {
    const baseEvent: WebhookEvent = {
      type: "subscription.active",
      data: {
        subscription_id: "sub_123",
        metadata: { organisation_id: "org_123" },
      },
    };

    beforeEach(() => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("ignores non-subscription events", async () => {
      const event: WebhookEvent = {
        type: "payment.completed",
        data: {},
      };

      await service.handleWebhookEvent(
        event,
        mockSubscriptionService as unknown as SubscriptionService
      );

      expect(mockSubscriptionService.updateSubscriptionStatus).not.toHaveBeenCalled();
    });

    it("throws error when subscription_id is missing", async () => {
      const event: WebhookEvent = {
        type: "subscription.active",
        data: {
          metadata: { organisation_id: "org_123" },
        },
      };

      await expect(
        service.handleWebhookEvent(
          event,
          mockSubscriptionService as unknown as SubscriptionService
        )
      ).rejects.toThrow("Missing subscription_id in webhook payload");
    });

    it("throws error when organisation cannot be resolved", async () => {
      const event: WebhookEvent = {
        type: "subscription.active",
        data: {
          subscription_id: "sub_unknown",
        },
      };
      mockDb.select().from().where().limit.mockResolvedValue([]);

      await expect(
        service.handleWebhookEvent(
          event,
          mockSubscriptionService as unknown as SubscriptionService
        )
      ).rejects.toThrow("Could not determine org ID from metadata or subscription lookup");
    });

    describe("subscription.active event", () => {
      it("updates subscription status to active with subscription_id", async () => {
        await service.handleWebhookEvent(
          baseEvent,
          mockSubscriptionService as unknown as SubscriptionService
        );

        expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith(
          "org_123",
          "active",
          "sub_123"
        );
      });
    });

    describe("subscription.on_hold event", () => {
      it("updates subscription status to on_hold", async () => {
        const event: WebhookEvent = {
          ...baseEvent,
          type: "subscription.on_hold",
        };

        await service.handleWebhookEvent(
          event,
          mockSubscriptionService as unknown as SubscriptionService
        );

        expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith(
          "org_123",
          "on_hold"
        );
      });
    });

    describe("subscription.failed event", () => {
      it("updates subscription status to failed", async () => {
        const event: WebhookEvent = {
          ...baseEvent,
          type: "subscription.failed",
        };

        await service.handleWebhookEvent(
          event,
          mockSubscriptionService as unknown as SubscriptionService
        );

        expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith(
          "org_123",
          "failed"
        );
      });
    });

    describe("subscription.cancelled event", () => {
      it("updates subscription status to cancelled", async () => {
        const event: WebhookEvent = {
          ...baseEvent,
          type: "subscription.cancelled",
        };

        await service.handleWebhookEvent(
          event,
          mockSubscriptionService as unknown as SubscriptionService
        );

        expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith(
          "org_123",
          "cancelled"
        );
      });
    });

    describe("subscription.renewed event", () => {
      it("updates subscription status to active", async () => {
        const event: WebhookEvent = {
          ...baseEvent,
          type: "subscription.renewed",
        };

        await service.handleWebhookEvent(
          event,
          mockSubscriptionService as unknown as SubscriptionService
        );

        expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith(
          "org_123",
          "active"
        );
      });
    });

    describe("subscription.expired event", () => {
      it("updates subscription status to expired", async () => {
        const event: WebhookEvent = {
          ...baseEvent,
          type: "subscription.expired",
        };

        await service.handleWebhookEvent(
          event,
          mockSubscriptionService as unknown as SubscriptionService
        );

        expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith(
          "org_123",
          "expired"
        );
      });
    });

    describe("error handling", () => {
      it("throws wrapped error when subscription update fails", async () => {
        mockSubscriptionService.updateSubscriptionStatus.mockRejectedValue(
          new Error("DB error")
        );

        await expect(
          service.handleWebhookEvent(
            baseEvent,
            mockSubscriptionService as unknown as SubscriptionService
          )
        ).rejects.toThrow("Failed to process subscription event: subscription.active");
      });

      it("logs error when subscription update fails", async () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        mockSubscriptionService.updateSubscriptionStatus.mockRejectedValue(
          new Error("DB error")
        );

        await expect(
          service.handleWebhookEvent(
            baseEvent,
            mockSubscriptionService as unknown as SubscriptionService
          )
        ).rejects.toThrow();

        expect(consoleSpy).toHaveBeenCalledWith(
          "Error processing subscription event subscription.active:",
          expect.any(Error)
        );

        consoleSpy.mockRestore();
      });
    });

    describe("organisation resolution from database", () => {
      it("resolves org from database when not in metadata", async () => {
        const event: WebhookEvent = {
          type: "subscription.active",
          data: {
            subscription_id: "sub_db_lookup",
          },
        };

        mockDb.select().from().where().limit.mockResolvedValue([
          { id: "org_from_db", subscription_id: "sub_db_lookup" },
        ]);

        await service.handleWebhookEvent(
          event,
          mockSubscriptionService as unknown as SubscriptionService
        );

        expect(mockSubscriptionService.updateSubscriptionStatus).toHaveBeenCalledWith(
          "org_from_db",
          "active",
          "sub_db_lookup"
        );
      });
    });
  });
});
