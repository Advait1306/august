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
import type { SignedInAuthObject, SignedOutAuthObject } from "@clerk/backend/internal";
import type { DodoWebhookService, WebhookEvent } from "../../../services/dodo-webhook.service";
import type { BillingService } from "../../../services/billing.service";
import type { SubscriptionService } from "../../../services/subscription.service";

// Mock @clerk/express
vi.mock("@clerk/express", () => ({
  getAuth: vi.fn(),
}));

import { getAuth } from "@clerk/express";

// Mock types for testing
interface MockDodoWebhookService {
  verifyAndParseWebhook: ReturnType<typeof vi.fn>;
  handleWebhookEvent: ReturnType<typeof vi.fn>;
  resolveOrganisationId: ReturnType<typeof vi.fn>;
}

interface MockBillingService {
  createCheckoutSession: ReturnType<typeof vi.fn>;
}

interface MockSubscriptionService {
  updateSubscriptionStatus: ReturnType<typeof vi.fn>;
  getOrgMemberCount: ReturnType<typeof vi.fn>;
  calculateAddonSeats: ReturnType<typeof vi.fn>;
}

// Partial mock types that satisfy the minimal interface needed for tests
type PartialMockAuthObject = Pick<SignedInAuthObject | SignedOutAuthObject, 'isAuthenticated' | 'userId' | 'orgId'>;

describe("Billing Controller Integration Tests", () => {
  let app: Express;
  let mockDodoWebhookService: MockDodoWebhookService;
  let mockBillingService: MockBillingService;
  let mockSubscriptionService: MockSubscriptionService;

  beforeAll(() => {
    process.env.DODO_WEBHOOK_SECRET = "whsec_test_dodo";
    process.env.WEB_URL = "http://localhost:3000";
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock DodoWebhookService
    mockDodoWebhookService = {
      verifyAndParseWebhook: vi.fn(),
      handleWebhookEvent: vi.fn().mockResolvedValue(undefined),
      resolveOrganisationId: vi.fn(),
    };

    // Create mock BillingService
    mockBillingService = {
      createCheckoutSession: vi.fn().mockResolvedValue({
        checkoutUrl: "https://checkout.dodopayments.com/session_123",
        sessionId: "session_123",
      }),
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
        mockDodoWebhookService as unknown as DodoWebhookService,
        mockBillingService as unknown as BillingService,
        mockSubscriptionService as unknown as SubscriptionService
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
        mockDodoWebhookService.verifyAndParseWebhook.mockResolvedValue(payload);

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true });
        expect(mockDodoWebhookService.handleWebhookEvent).toHaveBeenCalledWith(
          payload,
          mockSubscriptionService
        );
      });
    });

    describe("subscription.on_hold event", () => {
      it("should handle on_hold event via webhook service", async () => {
        const payload = {
          type: "subscription.on_hold",
          data: {
            subscription_id: "sub_456",
            metadata: { organisation_id: "org_456" },
          },
        };
        mockDodoWebhookService.verifyAndParseWebhook.mockResolvedValue(payload);

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
        expect(mockDodoWebhookService.handleWebhookEvent).toHaveBeenCalledWith(
          payload,
          mockSubscriptionService
        );
      });
    });

    describe("subscription.failed event", () => {
      it("should handle failed event via webhook service", async () => {
        const payload = {
          type: "subscription.failed",
          data: {
            subscription_id: "sub_789",
            metadata: { organisation_id: "org_789" },
          },
        };
        mockDodoWebhookService.verifyAndParseWebhook.mockResolvedValue(payload);

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
        expect(mockDodoWebhookService.handleWebhookEvent).toHaveBeenCalledWith(
          payload,
          mockSubscriptionService
        );
      });
    });

    describe("subscription.cancelled event", () => {
      it("should handle cancelled event via webhook service", async () => {
        const payload = {
          type: "subscription.cancelled",
          data: {
            subscription_id: "sub_cancel",
            metadata: { organisation_id: "org_cancel" },
          },
        };
        mockDodoWebhookService.verifyAndParseWebhook.mockResolvedValue(payload);

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
        expect(mockDodoWebhookService.handleWebhookEvent).toHaveBeenCalledWith(
          payload,
          mockSubscriptionService
        );
      });
    });

    describe("subscription.renewed event", () => {
      it("should handle renewed event via webhook service", async () => {
        const payload = {
          type: "subscription.renewed",
          data: {
            subscription_id: "sub_renew",
            metadata: { organisation_id: "org_renew" },
          },
        };
        mockDodoWebhookService.verifyAndParseWebhook.mockResolvedValue(payload);

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
        expect(mockDodoWebhookService.handleWebhookEvent).toHaveBeenCalledWith(
          payload,
          mockSubscriptionService
        );
      });
    });

    describe("subscription.expired event", () => {
      it("should handle expired event via webhook service", async () => {
        const payload = {
          type: "subscription.expired",
          data: {
            subscription_id: "sub_expire",
            metadata: { organisation_id: "org_expire" },
          },
        };
        mockDodoWebhookService.verifyAndParseWebhook.mockResolvedValue(payload);

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
        expect(mockDodoWebhookService.handleWebhookEvent).toHaveBeenCalledWith(
          payload,
          mockSubscriptionService
        );
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
        mockDodoWebhookService.verifyAndParseWebhook.mockResolvedValue(payload as unknown as WebhookEvent);

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
        mockDodoWebhookService.verifyAndParseWebhook.mockRejectedValue(
          new Error("Invalid signature")
        );

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
        mockDodoWebhookService.verifyAndParseWebhook.mockRejectedValue(
          new Error("DODO_WEBHOOK_SECRET not configured")
        );

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify({ type: "test" }));

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "DODO_WEBHOOK_SECRET not configured" });
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
        mockDodoWebhookService.verifyAndParseWebhook.mockResolvedValue(payload);
        mockDodoWebhookService.handleWebhookEvent.mockRejectedValue(
          new Error("Failed to process subscription event: subscription.active")
        );

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          error: "Failed to process subscription event: subscription.active",
        });
      });
    });

    describe("missing subscription_id error", () => {
      it("should return 500 when subscription_id is missing", async () => {
        const payload = {
          type: "subscription.active",
          data: {
            metadata: { organisation_id: "org_123" },
          },
        };
        mockDodoWebhookService.verifyAndParseWebhook.mockResolvedValue(payload);
        mockDodoWebhookService.handleWebhookEvent.mockRejectedValue(
          new Error("Missing subscription_id in webhook payload")
        );

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Missing subscription_id in webhook payload" });
      });
    });

    describe("missing organisation_id error", () => {
      it("should return 500 when org cannot be determined", async () => {
        const payload = {
          type: "subscription.active",
          data: {
            subscription_id: "sub_unknown",
          },
        };
        mockDodoWebhookService.verifyAndParseWebhook.mockResolvedValue(payload);
        mockDodoWebhookService.handleWebhookEvent.mockRejectedValue(
          new Error("Could not determine org ID from metadata or subscription lookup")
        );

        const response = await request(app)
          .post("/api/webhooks/dodo")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          error: "Could not determine org ID from metadata or subscription lookup",
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
        } as unknown as PartialMockAuthObject as ReturnType<typeof getAuth>);

        const response = await request(app)
          .post("/api/subscription/checkout")
          .send({ returnUrl: "https://example.com/return" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          checkoutUrl: "https://checkout.dodopayments.com/session_123",
          sessionId: "session_123",
        });
        expect(mockBillingService.createCheckoutSession).toHaveBeenCalledWith({
          userId: "user_checkout",
          organisationId: "user_checkout",
          returnUrl: "https://example.com/return",
          memberCount: 3,
        });
      });

      it("should create checkout session for organization", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_org_checkout",
          orgId: "org_checkout",
        } as unknown as PartialMockAuthObject as ReturnType<typeof getAuth>);

        const response = await request(app)
          .post("/api/subscription/checkout")
          .send({ returnUrl: "https://example.com/return" });

        expect(response.status).toBe(200);
        expect(mockSubscriptionService.getOrgMemberCount).toHaveBeenCalledWith(
          "org_checkout"
        );
        expect(mockBillingService.createCheckoutSession).toHaveBeenCalledWith({
          userId: "user_org_checkout",
          organisationId: "org_checkout",
          returnUrl: "https://example.com/return",
          memberCount: 3,
        });
      });

      it("should pass correct member count to billing service", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_addon",
          orgId: "org_addon",
        } as unknown as PartialMockAuthObject as ReturnType<typeof getAuth>);
        mockSubscriptionService.getOrgMemberCount.mockResolvedValue(5);

        const response = await request(app)
          .post("/api/subscription/checkout")
          .send({ returnUrl: "https://example.com/return" });

        expect(response.status).toBe(200);
        expect(mockBillingService.createCheckoutSession).toHaveBeenCalledWith({
          userId: "user_addon",
          organisationId: "org_addon",
          returnUrl: "https://example.com/return",
          memberCount: 5,
        });
      });
    });

    describe("unauthenticated requests", () => {
      it("should return 401 when not authenticated", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: false,
          userId: null,
          orgId: null,
        } as unknown as PartialMockAuthObject as ReturnType<typeof getAuth>);

        const response = await request(app)
          .post("/api/subscription/checkout")
          .send({ returnUrl: "https://example.com/return" });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: "Unauthorized" });
      });

      it("should return 401 when userId is missing", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: null,
          orgId: null,
        } as unknown as PartialMockAuthObject as ReturnType<typeof getAuth>);

        const response = await request(app)
          .post("/api/subscription/checkout")
          .send({ returnUrl: "https://example.com/return" });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: "Unauthorized" });
      });
    });

    describe("validation errors", () => {
      it("should return 400 when returnUrl is missing", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_no_url",
          orgId: null,
        } as unknown as PartialMockAuthObject as ReturnType<typeof getAuth>);

        const response = await request(app)
          .post("/api/subscription/checkout")
          .send({});

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "returnUrl is required" });
      });

      it("should return 400 when returnUrl is not a string", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_bad_url",
          orgId: null,
        } as unknown as PartialMockAuthObject as ReturnType<typeof getAuth>);

        const response = await request(app)
          .post("/api/subscription/checkout")
          .send({ returnUrl: 12345 });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "returnUrl is required" });
      });
    });

    describe("checkout creation errors", () => {
      it("should throw error when billing service fails", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_dodo_error",
          orgId: null,
        } as unknown as PartialMockAuthObject as ReturnType<typeof getAuth>);
        mockBillingService.createCheckoutSession.mockRejectedValue(
          new Error("Dodo API error")
        );

        const response = await request(app)
          .post("/api/subscription/checkout")
          .send({ returnUrl: "https://example.com/return" });

        expect(response.status).toBe(500);
      });
    });
  });
});
