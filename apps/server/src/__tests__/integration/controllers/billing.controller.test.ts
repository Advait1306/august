import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  afterAll,
} from "vitest";
import request from "supertest";
import express, { Express } from "express";
import { createBillingController } from "../../../controllers/billing.controller";

// Create a mock verify function that can be controlled per test
const mockWebhookVerify = vi.fn();

// Mock standardwebhooks Webhook as a proper class
vi.mock("standardwebhooks", () => {
  return {
    Webhook: class MockWebhook {
      verify = mockWebhookVerify;
    },
  };
});

// Mock @clerk/express
vi.mock("@clerk/express", () => ({
  getAuth: vi.fn(),
}));

import { getAuth } from "@clerk/express";

describe("Billing Controller Integration Tests", () => {
  let app: Express;
  let mockClerkClient: {
    users: {
      getUser: ReturnType<typeof vi.fn>;
    };
  };
  let mockDb: any;
  let mockDodoClient: {
    checkoutSessions: {
      create: ReturnType<typeof vi.fn>;
    };
  };
  let mockSubscriptionService: {
    updateSubscriptionStatus: ReturnType<typeof vi.fn>;
    getOrgMemberCount: ReturnType<typeof vi.fn>;
    calculateAddonSeats: ReturnType<typeof vi.fn>;
  };

  beforeAll(() => {
    process.env.DODO_WEBHOOK_SECRET = "whsec_test_dodo";
    process.env.WEB_URL = "http://localhost:3000";
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock Clerk client
    mockClerkClient = {
      users: {
        getUser: vi.fn().mockResolvedValue({
          id: "user_123",
          fullName: "Test User",
          emailAddresses: [{ emailAddress: "test@example.com" }],
        }),
      },
    };

    // Create mock DB
    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    // Create mock Dodo client
    mockDodoClient = {
      checkoutSessions: {
        create: vi.fn().mockResolvedValue({
          checkout_url: "https://checkout.dodopayments.com/session_123",
          session_id: "session_123",
        }),
      },
    };

    // Create mock subscription service
    mockSubscriptionService = {
      updateSubscriptionStatus: vi.fn().mockResolvedValue(undefined),
      getOrgMemberCount: vi.fn().mockResolvedValue(3),
      calculateAddonSeats: vi.fn().mockReturnValue(2),
    };

    // Create Express app with controller
    app = express();

    // Use conditional body parsing based on the route
    // Webhooks need raw body, checkout needs JSON
    app.use((req, res, next) => {
      if (req.path === "/api/webhooks/dodo") {
        express.raw({ type: "application/json" })(req, res, next);
      } else {
        express.json()(req, res, next);
      }
    });

    app.use(
      "/",
      createBillingController(
        mockClerkClient as any,
        mockDb,
        mockDodoClient as any,
        mockSubscriptionService as any
      )
    );
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/webhooks/dodo - Webhook Handler", () => {
    const validHeaders = {
      "webhook-id": "wh_test123",
      "webhook-timestamp": "1234567890",
      "webhook-signature": "v1,test_signature",
    };

    describe("subscription.active event", () => {
      it("should update subscription status to active", async () => {
        const payload = {
          type: "subscription.active",
          data: {
            subscription_id: "sub_123",
            metadata: { organisation_id: "org_123" },
          },
        };
        mockWebhookVerify.mockReturnValue(payload);

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true });
        expect(
          mockSubscriptionService.updateSubscriptionStatus
        ).toHaveBeenCalledWith("org_123", "active", "sub_123");
      });
    });

    describe("subscription.on_hold event", () => {
      it("should update subscription status to on_hold", async () => {
        const payload = {
          type: "subscription.on_hold",
          data: {
            subscription_id: "sub_456",
            metadata: { organisation_id: "org_456" },
          },
        };
        mockWebhookVerify.mockReturnValue(payload);

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
        expect(
          mockSubscriptionService.updateSubscriptionStatus
        ).toHaveBeenCalledWith("org_456", "on_hold");
      });
    });

    describe("subscription.failed event", () => {
      it("should update subscription status to failed", async () => {
        const payload = {
          type: "subscription.failed",
          data: {
            subscription_id: "sub_789",
            metadata: { organisation_id: "org_789" },
          },
        };
        mockWebhookVerify.mockReturnValue(payload);

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
        expect(
          mockSubscriptionService.updateSubscriptionStatus
        ).toHaveBeenCalledWith("org_789", "failed");
      });
    });

    describe("subscription.cancelled event", () => {
      it("should update subscription status to cancelled", async () => {
        const payload = {
          type: "subscription.cancelled",
          data: {
            subscription_id: "sub_cancel",
            metadata: { organisation_id: "org_cancel" },
          },
        };
        mockWebhookVerify.mockReturnValue(payload);

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
        expect(
          mockSubscriptionService.updateSubscriptionStatus
        ).toHaveBeenCalledWith("org_cancel", "cancelled");
      });
    });

    describe("subscription.renewed event", () => {
      it("should update subscription status to active on renewal", async () => {
        const payload = {
          type: "subscription.renewed",
          data: {
            subscription_id: "sub_renew",
            metadata: { organisation_id: "org_renew" },
          },
        };
        mockWebhookVerify.mockReturnValue(payload);

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
        expect(
          mockSubscriptionService.updateSubscriptionStatus
        ).toHaveBeenCalledWith("org_renew", "active");
      });
    });

    describe("subscription.expired event", () => {
      it("should update subscription status to expired", async () => {
        const payload = {
          type: "subscription.expired",
          data: {
            subscription_id: "sub_expire",
            metadata: { organisation_id: "org_expire" },
          },
        };
        mockWebhookVerify.mockReturnValue(payload);

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
        expect(
          mockSubscriptionService.updateSubscriptionStatus
        ).toHaveBeenCalledWith("org_expire", "expired");
      });
    });

    describe("org lookup by subscription_id", () => {
      it("should find org by subscription_id when metadata is missing", async () => {
        const payload = {
          type: "subscription.active",
          data: {
            subscription_id: "sub_lookup",
          },
        };
        mockWebhookVerify.mockReturnValue(payload);

        // Mock DB to return org found by subscription_id
        mockDb.select().from().where().limit.mockResolvedValue([
          { id: "org_found_by_sub" },
        ]);

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
        expect(
          mockSubscriptionService.updateSubscriptionStatus
        ).toHaveBeenCalledWith("org_found_by_sub", "active", "sub_lookup");
      });
    });

    describe("missing subscription_id", () => {
      it("should return 400 when subscription_id is missing", async () => {
        const payload = {
          type: "subscription.active",
          data: {
            metadata: { organisation_id: "org_123" },
          },
        };
        mockWebhookVerify.mockReturnValue(payload);

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "Missing subscription_id" });
      });
    });

    describe("missing organisation_id", () => {
      it("should return 400 when org cannot be determined", async () => {
        const payload = {
          type: "subscription.active",
          data: {
            subscription_id: "sub_unknown",
          },
        };
        mockWebhookVerify.mockReturnValue(payload);

        // DB returns no org
        mockDb.select().from().where().limit.mockResolvedValue([]);

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: "Could not determine organisation",
        });
      });
    });

    describe("non-subscription events", () => {
      it("should acknowledge other event types with 200", async () => {
        const payload = {
          type: "payment.completed",
          data: {
            payment_id: "pay_123",
          },
        };
        mockWebhookVerify.mockReturnValue(payload);

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true });
      });
    });

    describe("webhook verification failures", () => {
      it("should return 401 when signature is invalid", async () => {
        const payload = {
          type: "subscription.active",
          data: {
            subscription_id: "sub_123",
          },
        };
        mockWebhookVerify.mockImplementation(() => {
          throw new Error("Invalid signature");
        });

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: "Invalid signature" });
      });
    });

    describe("missing webhook secret", () => {
      it("should return 500 when DODO_WEBHOOK_SECRET is not configured", async () => {
        const originalSecret = process.env.DODO_WEBHOOK_SECRET;
        delete process.env.DODO_WEBHOOK_SECRET;

        // Recreate app without the secret
        const tempApp = express();
        tempApp.use((req, res, next) => {
          if (req.path === "/api/webhooks/dodo") {
            express.raw({ type: "application/json" })(req, res, next);
          } else {
            express.json()(req, res, next);
          }
        });
        tempApp.use(
          "/",
          createBillingController(
            mockClerkClient as any,
            mockDb,
            mockDodoClient as any,
            mockSubscriptionService as any
          )
        );

        const response = await request(tempApp)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify({ type: "test" }));

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Webhook not configured" });

        process.env.DODO_WEBHOOK_SECRET = originalSecret;
      });
    });

    describe("subscription update error handling", () => {
      it("should return 500 when subscription update fails", async () => {
        const payload = {
          type: "subscription.active",
          data: {
            subscription_id: "sub_error",
            metadata: { organisation_id: "org_error" },
          },
        };
        mockWebhookVerify.mockReturnValue(payload);
        mockSubscriptionService.updateSubscriptionStatus.mockRejectedValue(
          new Error("DB error")
        );

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          error: "Failed to process subscription event",
        });
      });
    });
  });

  describe("POST /api/subscription/checkout - Checkout Session", () => {
    beforeEach(() => {
      vi.mocked(getAuth).mockReset();
    });

    describe("authenticated requests", () => {
      it("should create checkout session for user", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_checkout",
          orgId: null,
        } as any);

        const response = await request(app)
          .post("/api/subscription/checkout")
          .send({ returnUrl: "https://example.com/return" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          checkoutUrl: "https://checkout.dodopayments.com/session_123",
          sessionId: "session_123",
        });
        expect(mockDodoClient.checkoutSessions.create).toHaveBeenCalled();
      });

      it("should create checkout session for organization", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_org_checkout",
          orgId: "org_checkout",
        } as any);

        const response = await request(app)
          .post("/api/subscription/checkout")
          .send({ returnUrl: "https://example.com/return" });

        expect(response.status).toBe(200);
        expect(mockSubscriptionService.getOrgMemberCount).toHaveBeenCalledWith(
          "org_checkout"
        );
      });

      it("should include addon seats for multiple members", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_addon",
          orgId: "org_addon",
        } as any);
        mockSubscriptionService.getOrgMemberCount.mockResolvedValue(5);
        mockSubscriptionService.calculateAddonSeats.mockReturnValue(4);

        const response = await request(app)
          .post("/api/subscription/checkout")
          .send({ returnUrl: "https://example.com/return" });

        expect(response.status).toBe(200);
        const createCall =
          mockDodoClient.checkoutSessions.create.mock.calls[0][0];
        expect(createCall.product_cart[0].addons).toBeDefined();
        expect(createCall.product_cart[0].addons[0].quantity).toBe(4);
      });

      it("should not include addons when only 1 member", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_single",
          orgId: null,
        } as any);
        mockSubscriptionService.getOrgMemberCount.mockResolvedValue(1);
        mockSubscriptionService.calculateAddonSeats.mockReturnValue(0);

        const response = await request(app)
          .post("/api/subscription/checkout")
          .send({ returnUrl: "https://example.com/return" });

        expect(response.status).toBe(200);
        const createCall =
          mockDodoClient.checkoutSessions.create.mock.calls[0][0];
        expect(createCall.product_cart[0].addons).toBeUndefined();
      });
    });

    describe("unauthenticated requests", () => {
      it("should return 401 when not authenticated", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: false,
          userId: null,
          orgId: null,
        } as any);

        const response = await request(app)
          .post("/api/subscription/checkout")
          .send({ returnUrl: "https://example.com/return" });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: "User not authenticated" });
      });
    });

    describe("user not found", () => {
      it("should return 401 when Clerk user is not found", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_not_found",
          orgId: null,
        } as any);
        mockClerkClient.users.getUser.mockResolvedValue(null);

        const response = await request(app)
          .post("/api/subscription/checkout")
          .send({ returnUrl: "https://example.com/return" });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: "User not found" });
      });
    });

    describe("validation errors", () => {
      it("should return 400 when returnUrl is missing", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_no_url",
          orgId: null,
        } as any);

        const response = await request(app)
          .post("/api/subscription/checkout")
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toContain("Invalid return URL");
      });

      it("should return 400 when returnUrl is not a string", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_bad_url",
          orgId: null,
        } as any);

        const response = await request(app)
          .post("/api/subscription/checkout")
          .send({ returnUrl: 12345 });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain("Invalid return URL");
      });
    });

    describe("checkout creation errors", () => {
      it("should return 500 when Dodo checkout fails", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_dodo_error",
          orgId: null,
        } as any);
        mockDodoClient.checkoutSessions.create.mockRejectedValue(
          new Error("Dodo API error")
        );

        const response = await request(app)
          .post("/api/subscription/checkout")
          .send({ returnUrl: "https://example.com/return" });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          success: false,
          error: "Failed to create subscription checkout",
        });
      });
    });
  });
});
