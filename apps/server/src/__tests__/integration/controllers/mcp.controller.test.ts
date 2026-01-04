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

// Mock auth return type that matches the properties we test from Clerk's getAuth
interface MockAuthResult {
  isAuthenticated: boolean;
  userId: string | null;
  orgId: string | null;
}

// Mock @clerk/express
vi.mock("@clerk/express", () => ({
  getAuth: vi.fn(),
}));

// Create mock service instances that can be configured per test
const mockOAuthServiceInstance = {
  initiateOAuthFlow: vi.fn(),
  handleOAuthCallback: vi.fn(),
};

const mockComposioServiceInstance = {
  initiateComposioFlow: vi.fn(),
  handleComposioCallback: vi.fn(),
};

const mockMcpServiceInstance = {
  getMcpStoreById: vi.fn(),
};

import { getAuth } from "@clerk/express";
import { createMCPController } from "../../../controllers/mcp.controller";
import type { OAuthService } from "../../../services/oauth.service";
import type { ComposioService } from "../../../services/composio.service";
import type { McpService } from "../../../services/mcp.service";

// Helper to create a properly typed mock auth result
function createMockAuth(auth: MockAuthResult): ReturnType<typeof getAuth> {
  return auth as unknown as ReturnType<typeof getAuth>;
}

describe("MCP Controller Integration Tests", () => {
  let app: Express;

  beforeAll(() => {
    process.env.WEB_URL = "http://localhost:3000";
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock service responses
    mockOAuthServiceInstance.initiateOAuthFlow.mockResolvedValue({
      authorizationUrl: "https://oauth.provider.com/authorize?state=test",
    });
    mockOAuthServiceInstance.handleOAuthCallback.mockResolvedValue({
      success: true,
      redirectUri: "http://localhost:3000/integrations?status=success",
    });

    mockComposioServiceInstance.initiateComposioFlow.mockResolvedValue({
      redirectUrl: "https://composio.dev/auth?state=test",
    });
    mockComposioServiceInstance.handleComposioCallback.mockResolvedValue({
      success: true,
      redirectUri: "http://localhost:3000/integrations?status=success",
    });

    // Default: no MCP store found
    mockMcpServiceInstance.getMcpStoreById.mockResolvedValue(null);

    // Create Express app with controller using injected mock services
    app = express();
    app.use(express.json());
    app.use(
      "/",
      createMCPController(
        mockOAuthServiceInstance as unknown as OAuthService,
        mockComposioServiceInstance as unknown as ComposioService,
        mockMcpServiceInstance as unknown as McpService
      )
    );
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/mcp/authorize - OAuth/Composio Flow Initiation", () => {
    beforeEach(() => {
      vi.mocked(getAuth).mockReset();
    });

    describe("authenticated requests with template MCP", () => {
      it("should initiate OAuth flow for OAuth-type MCP", async () => {
        vi.mocked(getAuth).mockReturnValue(
          createMockAuth({
            isAuthenticated: true,
            userId: "user_oauth",
            orgId: "org_oauth",
          })
        );

        // Mock mcpService to return OAuth-type MCP
        mockMcpServiceInstance.getMcpStoreById.mockResolvedValue({
          id: "mcp_oauth",
          integration_type: "oauth",
        });

        const response = await request(app)
          .post("/api/mcp/authorize")
          .send({ mcp_store_id: "mcp_oauth" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          authorizationUrl: "https://oauth.provider.com/authorize?state=test",
        });
        expect(mockOAuthServiceInstance.initiateOAuthFlow).toHaveBeenCalledWith({
          mcpStoreId: "mcp_oauth",
          customMcpUrl: undefined,
          customMcpName: undefined,
          userId: "user_oauth",
          organisationId: "org_oauth",
        });
      });

      it("should initiate Composio flow for Composio-type MCP", async () => {
        vi.mocked(getAuth).mockReturnValue(
          createMockAuth({
            isAuthenticated: true,
            userId: "user_composio",
            orgId: "org_composio",
          })
        );

        // Mock mcpService to return Composio-type MCP
        mockMcpServiceInstance.getMcpStoreById.mockResolvedValue({
          id: "mcp_composio",
          integration_type: "composio",
        });

        const response = await request(app)
          .post("/api/mcp/authorize")
          .send({ mcp_store_id: "mcp_composio" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          authorizationUrl: "https://composio.dev/auth?state=test",
        });
        expect(mockComposioServiceInstance.initiateComposioFlow).toHaveBeenCalledWith({
          mcpStoreId: "mcp_composio",
          userId: "user_composio",
          organisationId: "org_composio",
        });
      });

      it("should return 404 when MCP is not found in store", async () => {
        vi.mocked(getAuth).mockReturnValue(
          createMockAuth({
            isAuthenticated: true,
            userId: "user_not_found",
            orgId: "org_not_found",
          })
        );

        // Mock mcpService to return null (not found)
        mockMcpServiceInstance.getMcpStoreById.mockResolvedValue(null);

        const response = await request(app)
          .post("/api/mcp/authorize")
          .send({ mcp_store_id: "mcp_unknown" });

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: "MCP not found in store" });
      });
    });

    describe("authenticated requests with custom MCP", () => {
      it("should initiate OAuth flow for custom MCP", async () => {
        vi.mocked(getAuth).mockReturnValue(
          createMockAuth({
            isAuthenticated: true,
            userId: "user_custom",
            orgId: "org_custom",
          })
        );

        const response = await request(app).post("/api/mcp/authorize").send({
          custom_mcp_url: "https://custom-mcp.example.com",
          custom_mcp_name: "My Custom MCP",
        });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          authorizationUrl: "https://oauth.provider.com/authorize?state=test",
        });
        expect(mockOAuthServiceInstance.initiateOAuthFlow).toHaveBeenCalledWith({
          mcpStoreId: undefined,
          customMcpUrl: "https://custom-mcp.example.com",
          customMcpName: "My Custom MCP",
          userId: "user_custom",
          organisationId: "org_custom",
        });
      });
    });

    describe("unauthenticated requests", () => {
      it("should return 401 when not authenticated", async () => {
        vi.mocked(getAuth).mockReturnValue(
          createMockAuth({
            isAuthenticated: false,
            userId: null,
            orgId: null,
          })
        );

        const response = await request(app)
          .post("/api/mcp/authorize")
          .send({ mcp_store_id: "mcp_test" });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: "Unauthorized" });
      });

      it("should return 401 when userId is missing", async () => {
        vi.mocked(getAuth).mockReturnValue(
          createMockAuth({
            isAuthenticated: true,
            userId: null,
            orgId: "org_test",
          })
        );

        const response = await request(app)
          .post("/api/mcp/authorize")
          .send({ mcp_store_id: "mcp_test" });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: "Unauthorized" });
      });

      it("should return 401 when orgId is missing", async () => {
        vi.mocked(getAuth).mockReturnValue(
          createMockAuth({
            isAuthenticated: true,
            userId: "user_test",
            orgId: null,
          })
        );

        const response = await request(app)
          .post("/api/mcp/authorize")
          .send({ mcp_store_id: "mcp_test" });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: "Unauthorized" });
      });
    });

    describe("validation errors", () => {
      it("should return 400 when neither template nor custom MCP provided", async () => {
        vi.mocked(getAuth).mockReturnValue(
          createMockAuth({
            isAuthenticated: true,
            userId: "user_empty",
            orgId: "org_empty",
          })
        );

        const response = await request(app).post("/api/mcp/authorize").send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toContain(
          "Must provide either mcp_store_id"
        );
      });

      it("should return 400 when both template and custom MCP provided", async () => {
        vi.mocked(getAuth).mockReturnValue(
          createMockAuth({
            isAuthenticated: true,
            userId: "user_both",
            orgId: "org_both",
          })
        );

        const response = await request(app).post("/api/mcp/authorize").send({
          mcp_store_id: "mcp_template",
          custom_mcp_url: "https://custom.example.com",
          custom_mcp_name: "Custom MCP",
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain(
          "Cannot provide both mcp_store_id"
        );
      });

      it("should return 400 when custom_mcp_url without custom_mcp_name", async () => {
        vi.mocked(getAuth).mockReturnValue(
          createMockAuth({
            isAuthenticated: true,
            userId: "user_partial",
            orgId: "org_partial",
          })
        );

        const response = await request(app).post("/api/mcp/authorize").send({
          custom_mcp_url: "https://custom.example.com",
        });

        expect(response.status).toBe(400);
      });

      it("should return 400 when custom_mcp_name without custom_mcp_url", async () => {
        vi.mocked(getAuth).mockReturnValue(
          createMockAuth({
            isAuthenticated: true,
            userId: "user_partial",
            orgId: "org_partial",
          })
        );

        const response = await request(app).post("/api/mcp/authorize").send({
          custom_mcp_name: "My Custom MCP",
        });

        expect(response.status).toBe(400);
      });
    });

    describe("error handling", () => {
      it("should return 500 when OAuth flow fails", async () => {
        vi.mocked(getAuth).mockReturnValue(
          createMockAuth({
            isAuthenticated: true,
            userId: "user_error",
            orgId: "org_error",
          })
        );

        mockOAuthServiceInstance.initiateOAuthFlow.mockRejectedValue(
          new Error("OAuth provider error")
        );

        const response = await request(app).post("/api/mcp/authorize").send({
          custom_mcp_url: "https://custom.example.com",
          custom_mcp_name: "Custom MCP",
        });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "OAuth provider error" });
      });

      it("should return 500 with generic message for non-Error exceptions", async () => {
        vi.mocked(getAuth).mockReturnValue(
          createMockAuth({
            isAuthenticated: true,
            userId: "user_generic_error",
            orgId: "org_generic_error",
          })
        );

        mockOAuthServiceInstance.initiateOAuthFlow.mockRejectedValue("String error");

        const response = await request(app).post("/api/mcp/authorize").send({
          custom_mcp_url: "https://custom.example.com",
          custom_mcp_name: "Custom MCP",
        });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Internal server error" });
      });
    });
  });

  describe("GET /api/mcp/callback - OAuth/Composio Callback Handler", () => {
    describe("OAuth callback", () => {
      it("should handle successful OAuth callback and redirect", async () => {
        mockOAuthServiceInstance.handleOAuthCallback.mockResolvedValue({
          success: true,
          redirectUri: "http://localhost:3000/integrations?status=success",
        });

        const response = await request(app)
          .get("/api/mcp/callback")
          .query({ code: "auth_code_123", state: "state_xyz" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(
          "http://localhost:3000/integrations?status=success"
        );
        expect(mockOAuthServiceInstance.handleOAuthCallback).toHaveBeenCalledWith({
          code: "auth_code_123",
          state: "state_xyz",
        });
      });

      it("should use default redirect when redirectUri not provided", async () => {
        mockOAuthServiceInstance.handleOAuthCallback.mockResolvedValue({
          success: true,
        });

        const response = await request(app)
          .get("/api/mcp/callback")
          .query({ code: "auth_code", state: "state_123" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(
          "http://localhost:3000/integrations?status=success"
        );
      });

      it("should redirect with error when OAuth callback fails", async () => {
        mockOAuthServiceInstance.handleOAuthCallback.mockResolvedValue({
          success: false,
          error: "Token exchange failed",
        });

        const response = await request(app)
          .get("/api/mcp/callback")
          .query({ code: "bad_code", state: "bad_state" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain("status=error");
        expect(response.headers.location).toContain("Token%20exchange%20failed");
      });
    });

    describe("Composio callback", () => {
      it("should handle successful Composio callback and redirect", async () => {
        mockComposioServiceInstance.handleComposioCallback.mockResolvedValue({
          success: true,
          redirectUri: "http://localhost:3000/integrations?status=success",
        });

        const response = await request(app)
          .get("/api/mcp/callback")
          .query({ connected_account_id: "conn_acc_123" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(
          "http://localhost:3000/integrations?status=success"
        );
        expect(mockComposioServiceInstance.handleComposioCallback).toHaveBeenCalledWith(
          {
            connectedAccountId: "conn_acc_123",
          }
        );
      });

      it("should use default redirect when redirectUri not provided", async () => {
        mockComposioServiceInstance.handleComposioCallback.mockResolvedValue({
          success: true,
        });

        const response = await request(app)
          .get("/api/mcp/callback")
          .query({ connected_account_id: "conn_acc_456" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(
          "http://localhost:3000/integrations?status=success"
        );
      });

      it("should redirect with error when Composio callback fails", async () => {
        mockComposioServiceInstance.handleComposioCallback.mockResolvedValue({
          success: false,
          error: "Connection failed",
          redirectUri: "http://localhost:3000/integrations?status=error",
        });

        const response = await request(app)
          .get("/api/mcp/callback")
          .query({ connected_account_id: "bad_conn" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(
          "http://localhost:3000/integrations?status=error"
        );
      });

      it("should use default error redirect when redirectUri not provided on failure", async () => {
        mockComposioServiceInstance.handleComposioCallback.mockResolvedValue({
          success: false,
          error: "Connection failed",
        });

        const response = await request(app)
          .get("/api/mcp/callback")
          .query({ connected_account_id: "bad_conn" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain("status=error");
        expect(response.headers.location).toContain("Connection%20failed");
      });
    });

    describe("missing parameters", () => {
      it("should return 400 when no callback parameters provided", async () => {
        const response = await request(app).get("/api/mcp/callback");

        expect(response.status).toBe(400);
        expect(response.text).toBe("Missing required callback parameters");
      });

      it("should return 400 when only code without state", async () => {
        const response = await request(app)
          .get("/api/mcp/callback")
          .query({ code: "auth_code" });

        expect(response.status).toBe(400);
        expect(response.text).toBe("Missing required callback parameters");
      });

      it("should return 400 when only state without code", async () => {
        const response = await request(app)
          .get("/api/mcp/callback")
          .query({ state: "state_123" });

        expect(response.status).toBe(400);
        expect(response.text).toBe("Missing required callback parameters");
      });
    });

    describe("error handling", () => {
      it("should redirect to error page when callback throws exception", async () => {
        mockOAuthServiceInstance.handleOAuthCallback.mockRejectedValue(
          new Error("Unexpected error")
        );

        const response = await request(app)
          .get("/api/mcp/callback")
          .query({ code: "error_code", state: "error_state" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain("status=error");
        expect(response.headers.location).toContain(
          "Internal%20server%20error"
        );
      });

      it("should redirect to error page when Composio callback throws exception", async () => {
        mockComposioServiceInstance.handleComposioCallback.mockRejectedValue(
          new Error("Composio error")
        );

        const response = await request(app)
          .get("/api/mcp/callback")
          .query({ connected_account_id: "error_conn" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain("status=error");
      });
    });
  });
});
