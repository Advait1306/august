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
import { createSyncController } from "../../../controllers/sync.controller";

// Mock @clerk/express
vi.mock("@clerk/express", () => ({
  getAuth: vi.fn(),
}));

import { getAuth } from "@clerk/express";

describe("Sync Controller Integration Tests", () => {
  let app: Express;
  let mockSyncService: {
    handleQuery: ReturnType<typeof vi.fn>;
    handleMutate: ReturnType<typeof vi.fn>;
  };

  beforeAll(() => {
    // No specific env vars needed
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock sync service
    mockSyncService = {
      handleQuery: vi.fn().mockResolvedValue({
        data: [{ id: "1", name: "Test Item" }],
        version: 1,
      }),
      handleMutate: vi.fn().mockResolvedValue({
        success: true,
        version: 2,
      }),
    };

    // Create Express app with controller
    app = express();
    app.use(express.json());
    app.use("/", createSyncController(mockSyncService as any));
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe("POST /query - Zero Query Handler", () => {
    beforeEach(() => {
      vi.mocked(getAuth).mockReset();
    });

    describe("authenticated requests", () => {
      it("should handle query for user without org", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_query_123",
          orgId: null,
        } as any);

        const queryPayload = {
          clientGroupID: "cg_123",
          queries: [{ table: "tasks", filter: {} }],
        };

        const response = await request(app).post("/query").send(queryPayload);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          data: [{ id: "1", name: "Test Item" }],
          version: 1,
        });
        expect(mockSyncService.handleQuery).toHaveBeenCalledWith(
          { userId: "user_query_123", orgId: "user_query_123" },
          expect.any(Object)
        );
      });

      it("should handle query for user with org", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_query_org",
          orgId: "org_query_123",
        } as any);

        const queryPayload = {
          clientGroupID: "cg_456",
          queries: [{ table: "projects", filter: { status: "active" } }],
        };

        const response = await request(app).post("/query").send(queryPayload);

        expect(response.status).toBe(200);
        expect(mockSyncService.handleQuery).toHaveBeenCalledWith(
          { userId: "user_query_org", orgId: "org_query_123" },
          expect.any(Object)
        );
      });

      it("should pass request body in fetch request", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_body_test",
          orgId: "org_body_test",
        } as any);

        const queryPayload = {
          clientGroupID: "cg_body",
          queries: [
            { table: "tasks", filter: { completed: false } },
            { table: "blocks", filter: { type: "text" } },
          ],
        };

        const response = await request(app).post("/query").send(queryPayload);

        expect(response.status).toBe(200);
        expect(mockSyncService.handleQuery).toHaveBeenCalled();

        // Verify the fetch request was created properly
        const [_, fetchRequest] = mockSyncService.handleQuery.mock.calls[0];
        expect(fetchRequest).toBeDefined();
        expect(fetchRequest.method).toBe("POST");
      });

      it("should return sync service response directly", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_response",
          orgId: "org_response",
        } as any);

        const customResponse = {
          data: [
            { id: "a", value: 100 },
            { id: "b", value: 200 },
          ],
          version: 42,
          meta: { cursor: "next_page" },
        };
        mockSyncService.handleQuery.mockResolvedValue(customResponse);

        const response = await request(app).post("/query").send({ test: true });

        expect(response.status).toBe(200);
        expect(response.body).toEqual(customResponse);
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
          .post("/query")
          .send({ clientGroupID: "cg_unauth" });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: "User not authenticated" });
        expect(mockSyncService.handleQuery).not.toHaveBeenCalled();
      });
    });

    describe("error handling", () => {
      it("should propagate sync service errors", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_error",
          orgId: "org_error",
        } as any);

        mockSyncService.handleQuery.mockRejectedValue(
          new Error("Sync query failed")
        );

        const response = await request(app)
          .post("/query")
          .send({ clientGroupID: "cg_error" });

        // Express will catch unhandled errors and return 500
        expect(response.status).toBe(500);
      });
    });
  });

  describe("POST /mutate - Zero Mutate Handler", () => {
    beforeEach(() => {
      vi.mocked(getAuth).mockReset();
    });

    describe("authenticated requests", () => {
      it("should handle mutation for user without org", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_mutate_123",
          orgId: null,
        } as any);

        const mutatePayload = {
          clientGroupID: "cg_mutate",
          mutations: [{ type: "create", table: "tasks", data: { name: "New Task" } }],
        };

        const response = await request(app).post("/mutate").send(mutatePayload);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          version: 2,
        });
        expect(mockSyncService.handleMutate).toHaveBeenCalledWith(
          { userId: "user_mutate_123", orgId: "user_mutate_123" },
          expect.any(Object)
        );
      });

      it("should handle mutation for user with org", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_mutate_org",
          orgId: "org_mutate_123",
        } as any);

        const mutatePayload = {
          clientGroupID: "cg_mutate_org",
          mutations: [
            { type: "update", table: "projects", id: "proj_1", data: { name: "Updated" } },
          ],
        };

        const response = await request(app).post("/mutate").send(mutatePayload);

        expect(response.status).toBe(200);
        expect(mockSyncService.handleMutate).toHaveBeenCalledWith(
          { userId: "user_mutate_org", orgId: "org_mutate_123" },
          expect.any(Object)
        );
      });

      it("should handle multiple mutations", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_multi_mutate",
          orgId: "org_multi_mutate",
        } as any);

        const mutatePayload = {
          clientGroupID: "cg_multi",
          mutations: [
            { type: "create", table: "tasks", data: { name: "Task 1" } },
            { type: "create", table: "tasks", data: { name: "Task 2" } },
            { type: "delete", table: "tasks", id: "old_task" },
          ],
        };

        mockSyncService.handleMutate.mockResolvedValue({
          success: true,
          version: 5,
          applied: 3,
        });

        const response = await request(app).post("/mutate").send(mutatePayload);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          version: 5,
          applied: 3,
        });
      });

      it("should return sync service response directly", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_mutate_response",
          orgId: "org_mutate_response",
        } as any);

        const customResponse = {
          success: true,
          version: 100,
          mutations: [{ id: "mut_1", status: "applied" }],
        };
        mockSyncService.handleMutate.mockResolvedValue(customResponse);

        const response = await request(app).post("/mutate").send({ test: true });

        expect(response.status).toBe(200);
        expect(response.body).toEqual(customResponse);
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
          .post("/mutate")
          .send({ clientGroupID: "cg_unauth_mutate" });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: "User not authenticated" });
        expect(mockSyncService.handleMutate).not.toHaveBeenCalled();
      });
    });

    describe("error handling", () => {
      it("should propagate sync service errors", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_mutate_error",
          orgId: "org_mutate_error",
        } as any);

        mockSyncService.handleMutate.mockRejectedValue(
          new Error("Mutation conflict")
        );

        const response = await request(app)
          .post("/mutate")
          .send({ clientGroupID: "cg_error_mutate" });

        // Express will catch unhandled errors and return 500
        expect(response.status).toBe(500);
      });

      it("should handle validation failures from sync service", async () => {
        vi.mocked(getAuth).mockReturnValue({
          isAuthenticated: true,
          userId: "user_validation",
          orgId: "org_validation",
        } as any);

        mockSyncService.handleMutate.mockResolvedValue({
          success: false,
          error: "Invalid mutation format",
          version: 1,
        });

        const response = await request(app)
          .post("/mutate")
          .send({ invalid: "data" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: false,
          error: "Invalid mutation format",
          version: 1,
        });
      });
    });
  });

  describe("Request transformation", () => {
    it("should convert Express request to Fetch request for query", async () => {
      vi.mocked(getAuth).mockReturnValue({
        isAuthenticated: true,
        userId: "user_transform",
        orgId: "org_transform",
      } as any);

      await request(app)
        .post("/query")
        .set("X-Custom-Header", "custom-value")
        .send({ test: "data" });

      expect(mockSyncService.handleQuery).toHaveBeenCalled();
      const [_, fetchRequest] = mockSyncService.handleQuery.mock.calls[0];

      expect(fetchRequest).toBeInstanceOf(Request);
      expect(fetchRequest.method).toBe("POST");
    });

    it("should convert Express request to Fetch request for mutate", async () => {
      vi.mocked(getAuth).mockReturnValue({
        isAuthenticated: true,
        userId: "user_transform_mutate",
        orgId: "org_transform_mutate",
      } as any);

      await request(app)
        .post("/mutate")
        .set("Content-Type", "application/json")
        .send({ mutations: [] });

      expect(mockSyncService.handleMutate).toHaveBeenCalled();
      const [_, fetchRequest] = mockSyncService.handleMutate.mock.calls[0];

      expect(fetchRequest).toBeInstanceOf(Request);
      expect(fetchRequest.method).toBe("POST");
    });
  });
});
