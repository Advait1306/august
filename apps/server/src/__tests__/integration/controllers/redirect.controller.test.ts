import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterAll,
} from "vitest";
import request from "supertest";
import express, { Express } from "express";
import { createRedirectController } from "../../../controllers/redirect.controller";

describe("Redirect Controller Integration Tests", () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create Express app with controller
    app = express();
    app.use("/", createRedirectController());
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe("ALL /redirect/composio - Composio Auth Callback Redirect", () => {
    const composioBaseUrl =
      "https://backend.composio.dev/api/v3/toolkits/auth/callback";

    describe("GET requests", () => {
      it("should redirect to Composio without query params", async () => {
        const response = await request(app).get("/redirect/composio");

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(composioBaseUrl);
      });

      it("should redirect to Composio with single query param", async () => {
        const response = await request(app)
          .get("/redirect/composio")
          .query({ code: "auth_code_123" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(
          `${composioBaseUrl}?code=auth_code_123`
        );
      });

      it("should redirect to Composio with multiple query params", async () => {
        const response = await request(app).get("/redirect/composio").query({
          code: "auth_code_456",
          state: "state_abc",
          scope: "read write",
        });

        expect(response.status).toBe(302);
        const location = response.headers.location;
        expect(location).toContain(composioBaseUrl);
        expect(location).toContain("code=auth_code_456");
        expect(location).toContain("state=state_abc");
        // URL encoded space
        expect(location).toContain("scope=read");
      });

      it("should preserve special characters in query params", async () => {
        const response = await request(app).get("/redirect/composio").query({
          token: "abc+def/ghi=",
          redirect: "https://example.com/callback?foo=bar",
        });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain(composioBaseUrl);
      });
    });

    describe("POST requests", () => {
      it("should redirect to Composio for POST requests", async () => {
        const response = await request(app).post("/redirect/composio");

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(composioBaseUrl);
      });

      it("should redirect with query params for POST", async () => {
        const response = await request(app)
          .post("/redirect/composio")
          .query({ connected_account_id: "conn_123" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(
          `${composioBaseUrl}?connected_account_id=conn_123`
        );
      });
    });

    describe("PUT requests", () => {
      it("should redirect to Composio for PUT requests", async () => {
        const response = await request(app).put("/redirect/composio");

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(composioBaseUrl);
      });
    });

    describe("PATCH requests", () => {
      it("should redirect to Composio for PATCH requests", async () => {
        const response = await request(app).patch("/redirect/composio");

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(composioBaseUrl);
      });
    });

    describe("DELETE requests", () => {
      it("should redirect to Composio for DELETE requests", async () => {
        const response = await request(app).delete("/redirect/composio");

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(composioBaseUrl);
      });
    });

    describe("HEAD requests", () => {
      it("should redirect to Composio for HEAD requests", async () => {
        const response = await request(app).head("/redirect/composio");

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(composioBaseUrl);
      });
    });

    describe("OPTIONS requests", () => {
      it("should redirect to Composio for OPTIONS requests", async () => {
        const response = await request(app).options("/redirect/composio");

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(composioBaseUrl);
      });
    });

    describe("edge cases", () => {
      it("should handle empty string query params", async () => {
        const response = await request(app).get("/redirect/composio").query({
          code: "",
          state: "valid_state",
        });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain("code=");
        expect(response.headers.location).toContain("state=valid_state");
      });

      it("should handle numeric query param values", async () => {
        const response = await request(app).get("/redirect/composio").query({
          version: "1",
          timestamp: "1704067200",
        });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain("version=1");
        expect(response.headers.location).toContain("timestamp=1704067200");
      });

      it("should handle boolean-like query param values", async () => {
        const response = await request(app).get("/redirect/composio").query({
          success: "true",
          error: "false",
        });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain("success=true");
        expect(response.headers.location).toContain("error=false");
      });

      it("should handle URL-unsafe characters in query params", async () => {
        const response = await request(app).get("/redirect/composio").query({
          message: "Hello World!",
          symbols: "@#$%",
        });

        expect(response.status).toBe(302);
        // URLSearchParams will encode these
        expect(response.headers.location).toContain(composioBaseUrl);
      });

      it("should handle query params with array-like keys", async () => {
        const response = await request(app)
          .get("/redirect/composio")
          .query({ "items[]": "item1" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain(composioBaseUrl);
      });
    });

    describe("no authentication required", () => {
      it("should redirect without any authentication", async () => {
        // This test verifies that the redirect endpoint doesn't require auth
        // by making a request without any auth headers
        const response = await request(app)
          .get("/redirect/composio")
          .query({ code: "unauthenticated_request" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toContain(composioBaseUrl);
      });
    });
  });

  describe("non-existent routes", () => {
    it("should return 404 for unregistered routes", async () => {
      const response = await request(app).get("/redirect/other");

      expect(response.status).toBe(404);
    });

    it("should return 404 for root redirect path", async () => {
      const response = await request(app).get("/redirect");

      expect(response.status).toBe(404);
    });
  });
});
