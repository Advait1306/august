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
import { createClerkController } from "../../../controllers/clerk.controller";

// Create a mock verify function that can be controlled per test
const mockWebhookVerify = vi.fn();

// Mock svix Webhook as a proper class
vi.mock("svix", () => {
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

describe("Clerk Controller Integration Tests", () => {
  let app: Express;
  let mockClerkService: {
    createUser: ReturnType<typeof vi.fn>;
    deleteUser: ReturnType<typeof vi.fn>;
    createOrganisation: ReturnType<typeof vi.fn>;
    deleteOrganisation: ReturnType<typeof vi.fn>;
    generateSignInToken: ReturnType<typeof vi.fn>;
  };
  let mockSubscriptionService: {
    handleMemberChange: ReturnType<typeof vi.fn>;
  };

  beforeAll(() => {
    process.env.CLERK_WEBHOOK_KEY = "whsec_test_key";
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock services
    mockClerkService = {
      createUser: vi.fn().mockResolvedValue(undefined),
      deleteUser: vi.fn().mockResolvedValue(undefined),
      createOrganisation: vi.fn().mockResolvedValue(undefined),
      deleteOrganisation: vi.fn().mockResolvedValue(undefined),
      generateSignInToken: vi.fn().mockResolvedValue("test_ticket_token"),
    };

    mockSubscriptionService = {
      handleMemberChange: vi.fn().mockResolvedValue(undefined),
    };

    // Create Express app with controller
    app = express();
    app.use(express.raw({ type: "application/json" }));
    app.use(
      "/",
      createClerkController(
        mockClerkService as any,
        mockSubscriptionService as any
      )
    );
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe("POST /clerk - Webhook Handler", () => {
    const validHeaders = {
      "svix-id": "msg_test123",
      "svix-timestamp": "1234567890",
      "svix-signature": "v1,test_signature",
    };

    describe("user.created event", () => {
      it("should create user and return 200", async () => {
        const payload = {
          type: "user.created",
          data: { id: "user_123" },
        };
        mockWebhookVerify.mockReturnValue(undefined);

        const response = await request(app)
          .post("/clerk")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
        expect(mockClerkService.createUser).toHaveBeenCalledWith("user_123");
      });
    });

    describe("user.deleted event", () => {
      it("should delete user and return 200", async () => {
        const payload = {
          type: "user.deleted",
          data: { id: "user_456" },
        };
        mockWebhookVerify.mockReturnValue(undefined);

        const response = await request(app)
          .post("/clerk")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
        expect(mockClerkService.deleteUser).toHaveBeenCalledWith("user_456");
      });
    });

    describe("organization.created event", () => {
      it("should create organisation and return 200", async () => {
        const payload = {
          type: "organization.created",
          data: { id: "org_789" },
        };
        mockWebhookVerify.mockReturnValue(undefined);

        const response = await request(app)
          .post("/clerk")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
        expect(mockClerkService.createOrganisation).toHaveBeenCalledWith(
          "org_789"
        );
      });
    });

    describe("organization.deleted event", () => {
      it("should delete organisation and return 200", async () => {
        const payload = {
          type: "organization.deleted",
          data: { id: "org_101" },
        };
        mockWebhookVerify.mockReturnValue(undefined);

        const response = await request(app)
          .post("/clerk")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
        expect(mockClerkService.deleteOrganisation).toHaveBeenCalledWith(
          "org_101"
        );
      });
    });

    describe("organizationMembership.created event", () => {
      it("should handle member change and return 200", async () => {
        const payload = {
          type: "organizationMembership.created",
          data: {
            organization: {
              id: "org_member_test",
              members_count: 5,
            },
          },
        };
        mockWebhookVerify.mockReturnValue(undefined);

        const response = await request(app)
          .post("/clerk")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
        expect(mockClerkService.createOrganisation).toHaveBeenCalledWith(
          "org_member_test"
        );
        expect(mockSubscriptionService.handleMemberChange).toHaveBeenCalledWith(
          "org_member_test",
          5
        );
      });

      it("should return 400 when organization ID is missing", async () => {
        const payload = {
          type: "organizationMembership.created",
          data: {
            organization: null,
          },
        };
        mockWebhookVerify.mockReturnValue(undefined);

        const response = await request(app)
          .post("/clerk")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(400);
      });
    });

    describe("organizationMembership.deleted event", () => {
      it("should handle member change on deletion", async () => {
        const payload = {
          type: "organizationMembership.deleted",
          data: {
            organization: {
              id: "org_member_delete",
              members_count: 3,
            },
          },
        };
        mockWebhookVerify.mockReturnValue(undefined);

        const response = await request(app)
          .post("/clerk")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
        expect(mockSubscriptionService.handleMemberChange).toHaveBeenCalledWith(
          "org_member_delete",
          3
        );
      });
    });

    describe("unhandled events", () => {
      it("should return 200 for unhandled event types", async () => {
        const payload = {
          type: "session.created",
          data: { id: "sess_123" },
        };
        mockWebhookVerify.mockReturnValue(undefined);

        const response = await request(app)
          .post("/clerk")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(200);
      });
    });

    describe("webhook verification failures", () => {
      it("should return 400 when webhook signature is invalid", async () => {
        const payload = {
          type: "user.created",
          data: { id: "user_123" },
        };
        mockWebhookVerify.mockImplementation(() => {
          throw new Error("Invalid signature");
        });

        const response = await request(app)
          .post("/clerk")
          .set("Content-Type", "application/json")
          .set(validHeaders)
          .send(JSON.stringify(payload));

        expect(response.status).toBe(400);
        expect(mockClerkService.createUser).not.toHaveBeenCalled();
      });

      it("should return 400 when headers are missing", async () => {
        const payload = {
          type: "user.created",
          data: { id: "user_123" },
        };
        mockWebhookVerify.mockImplementation(() => {
          throw new Error("Missing headers");
        });

        const response = await request(app)
          .post("/clerk")
          .set("Content-Type", "application/json")
          .send(JSON.stringify(payload));

        expect(response.status).toBe(400);
      });
    });
  });

  describe("GET /ticket - Sign-in Ticket Generation", () => {
    beforeEach(() => {
      // Reset getAuth mock for each test
      vi.mocked(getAuth).mockReset();
    });

    describe("authenticated requests", () => {
      it("should return ticket when user is authenticated", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_ticket_123",
        } as any);

        const response = await request(app).get("/ticket");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ ticket: "test_ticket_token" });
        expect(mockClerkService.generateSignInToken).toHaveBeenCalledWith(
          "user_ticket_123"
        );
      });
    });

    describe("unauthenticated requests", () => {
      it("should return 401 when user is not authenticated", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: false,
          userId: null,
        } as any);

        const response = await request(app).get("/ticket");

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: "User not authenticated" });
        expect(mockClerkService.generateSignInToken).not.toHaveBeenCalled();
      });
    });

    describe("error handling", () => {
      it("should return 500 when token generation fails", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_error_123",
        } as any);
        mockClerkService.generateSignInToken.mockRejectedValue(
          new Error("Token generation failed")
        );

        const response = await request(app).get("/ticket");

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Failed to generate token" });
      });
    });
  });
});
