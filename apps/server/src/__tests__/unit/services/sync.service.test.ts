import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { SyncService } from "../../../services/sync.service.js";

// Mock @rocicorp/zero
vi.mock("@rocicorp/zero", () => ({
  mustGetQuery: vi.fn(),
  mustGetMutator: vi.fn(),
}));

// Mock @rocicorp/zero/server
vi.mock("@rocicorp/zero/server", () => ({
  handleQueryRequest: vi.fn(),
  handleMutateRequest: vi.fn(),
}));

// Mock @jupiter/sync imports
vi.mock("@jupiter/sync/queries/data", () => ({
  queries: { testQuery: { fn: vi.fn() } },
}));

vi.mock("@jupiter/sync/server-mutators/data", () => ({
  createServerMutators: vi.fn(),
}));

vi.mock("@jupiter/sync/zero/schema", () => ({
  schema: { tables: {} },
}));

// Mock the agent loop queue
vi.mock("../../../queues/workers/agentLoopWorker", () => ({
  addToAgentLoopQueue: vi.fn(),
}));

// Import mocked modules
import { mustGetQuery, mustGetMutator } from "@rocicorp/zero";
import { handleQueryRequest, handleMutateRequest } from "@rocicorp/zero/server";
import { queries } from "@jupiter/sync/queries/data";
import { createServerMutators } from "@jupiter/sync/server-mutators/data";
import { schema } from "@jupiter/sync/zero/schema";

// Mock types
type AuthData = {
  sub: string;
  org?: string;
};

// Mock factories
function createMockDbProvider() {
  return vi.fn();
}

function createMockMixpanel() {
  return {
    track: vi.fn(),
    people: {
      set: vi.fn(),
    },
  };
}

function createMockOAuthService() {
  return {
    getToken: vi.fn(),
    refreshToken: vi.fn(),
  };
}

function createMockDodoClient() {
  return {
    subscriptions: {
      retrieve: vi.fn(),
      changePlan: vi.fn(),
    },
  };
}

function createMockRequest(body: object = {}): Request {
  return {
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Request;
}

describe("SyncService", () => {
  let service: SyncService;
  let mockDbProvider: ReturnType<typeof createMockDbProvider>;
  let mockMp: ReturnType<typeof createMockMixpanel>;
  let mockOAuthService: ReturnType<typeof createMockOAuthService>;
  let mockDodoClient: ReturnType<typeof createMockDodoClient>;

  beforeEach(() => {
    mockDbProvider = createMockDbProvider();
    mockMp = createMockMixpanel();
    mockOAuthService = createMockOAuthService();
    mockDodoClient = createMockDodoClient();

    service = new SyncService(
      mockDbProvider as any,
      mockMp as any,
      mockOAuthService as any,
      mockDodoClient as any
    );

    vi.clearAllMocks();
  });

  describe("handleQuery", () => {
    it("calls handleQueryRequest with correct parameters", async () => {
      const authData: AuthData = { sub: "user_123", org: "org_456" };
      const mockRequest = createMockRequest({ query: "testQuery" });
      const expectedResponse = { data: "test" };

      (handleQueryRequest as Mock).mockResolvedValue(expectedResponse);

      const result = await service.handleQuery(authData as any, mockRequest);

      expect(result).toEqual(expectedResponse);
      expect(handleQueryRequest).toHaveBeenCalledWith(
        expect.any(Function),
        schema,
        mockRequest
      );
    });

    it("uses mustGetQuery to retrieve query function", async () => {
      const authData: AuthData = { sub: "user_123" };
      const mockRequest = createMockRequest();
      const mockQueryFn = vi.fn().mockReturnValue({ result: "query_result" });

      (mustGetQuery as Mock).mockReturnValue({ fn: mockQueryFn });
      (handleQueryRequest as Mock).mockImplementation(
        async (queryHandler, _schema, _body) => {
          // Simulate the query handler being called
          const result = queryHandler("testQuery", { arg1: "value1" });
          return result;
        }
      );

      await service.handleQuery(authData as any, mockRequest);

      expect(mustGetQuery).toHaveBeenCalledWith(queries, "testQuery");
      expect(mockQueryFn).toHaveBeenCalledWith({
        args: { arg1: "value1" },
        ctx: authData,
      });
    });

    it("passes authData as context to query function", async () => {
      const authData: AuthData = { sub: "user_abc", org: "org_xyz" };
      const mockRequest = createMockRequest();
      const mockQueryFn = vi.fn().mockReturnValue({});

      (mustGetQuery as Mock).mockReturnValue({ fn: mockQueryFn });
      (handleQueryRequest as Mock).mockImplementation(
        async (queryHandler, _schema, _body) => {
          queryHandler("someQuery", { filter: "active" });
          return {};
        }
      );

      await service.handleQuery(authData as any, mockRequest);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.objectContaining({
          ctx: authData,
        })
      );
    });

    it("handles query errors gracefully", async () => {
      const authData: AuthData = { sub: "user_123" };
      const mockRequest = createMockRequest();
      const queryError = new Error("Query failed");

      (handleQueryRequest as Mock).mockRejectedValue(queryError);

      await expect(
        service.handleQuery(authData as any, mockRequest)
      ).rejects.toThrow("Query failed");
    });
  });

  describe("handleMutate", () => {
    it("calls handleMutateRequest with correct parameters", async () => {
      const authData: AuthData = { sub: "user_123", org: "org_456" };
      const mockRequest = createMockRequest({ mutation: "testMutation" });
      const expectedResponse = { success: true };
      const mockServerMutators = { testMutator: { fn: vi.fn() } };

      (createServerMutators as Mock).mockReturnValue(mockServerMutators);
      (handleMutateRequest as Mock).mockResolvedValue(expectedResponse);

      const result = await service.handleMutate(authData as any, mockRequest);

      expect(result).toEqual(expectedResponse);
      expect(handleMutateRequest).toHaveBeenCalledWith(
        mockDbProvider,
        expect.any(Function),
        mockRequest
      );
    });

    it("creates server mutators with correct dependencies", async () => {
      const authData: AuthData = { sub: "user_123" };
      const mockRequest = createMockRequest();
      const mockServerMutators = {};

      (createServerMutators as Mock).mockReturnValue(mockServerMutators);
      (handleMutateRequest as Mock).mockResolvedValue({});

      await service.handleMutate(authData as any, mockRequest);

      expect(createServerMutators).toHaveBeenCalledWith(
        expect.any(Array), // asyncTasks array
        mockMp,
        mockOAuthService,
        expect.any(Function), // addToAgentLoopQueue
        mockDodoClient
      );
    });

    it("uses mustGetMutator to retrieve mutator function", async () => {
      const authData: AuthData = { sub: "user_123" };
      const mockRequest = createMockRequest();
      const mockMutatorFn = vi.fn().mockReturnValue({ result: "mutated" });
      const mockServerMutators = { testMutator: { fn: mockMutatorFn } };
      const mockTx = { query: vi.fn(), mutate: vi.fn() };

      (createServerMutators as Mock).mockReturnValue(mockServerMutators);
      (mustGetMutator as Mock).mockReturnValue({ fn: mockMutatorFn });
      (handleMutateRequest as Mock).mockImplementation(
        async (_dbProvider, transactHandler, _body) => {
          // Simulate the transact handler being called with a transact function
          // The transact function receives a callback that gets (tx, name, args)
          await transactHandler((txCallback: (tx: any, name: string, args: any) => any) => {
            // Simulate calling the callback with tx, name, and args
            return txCallback(mockTx, "testMutator", { data: "test" });
          });
          return {};
        }
      );

      await service.handleMutate(authData as any, mockRequest);

      expect(mustGetMutator).toHaveBeenCalledWith(
        mockServerMutators,
        "testMutator"
      );
    });

    it("passes authData as context to mutator function", async () => {
      const authData: AuthData = { sub: "user_abc", org: "org_xyz" };
      const mockRequest = createMockRequest();
      const mockMutatorFn = vi.fn().mockReturnValue({});
      const mockServerMutators = { testMutator: { fn: mockMutatorFn } };
      const mockTx = {};

      (createServerMutators as Mock).mockReturnValue(mockServerMutators);
      (mustGetMutator as Mock).mockReturnValue({ fn: mockMutatorFn });
      (handleMutateRequest as Mock).mockImplementation(
        async (_dbProvider, transactHandler, _body) => {
          // Simulate the transact handler being called with a transact function
          await transactHandler((txCallback: (tx: any, name: string, args: any) => any) => {
            return txCallback(mockTx, "testMutator", { data: "test" });
          });
          return {};
        }
      );

      await service.handleMutate(authData as any, mockRequest);

      expect(mockMutatorFn).toHaveBeenCalledWith(
        expect.objectContaining({
          ctx: authData,
        })
      );
    });

    it("runs async tasks after mutation completes", async () => {
      const authData: AuthData = { sub: "user_123" };
      const mockRequest = createMockRequest();
      const asyncTask1 = vi.fn().mockResolvedValue(undefined);
      const asyncTask2 = vi.fn().mockResolvedValue(undefined);

      (createServerMutators as Mock).mockImplementation((asyncTasks) => {
        // Simulate mutators adding async tasks
        asyncTasks.push(asyncTask1);
        asyncTasks.push(asyncTask2);
        return {};
      });
      (handleMutateRequest as Mock).mockResolvedValue({ success: true });

      await service.handleMutate(authData as any, mockRequest);

      expect(asyncTask1).toHaveBeenCalled();
      expect(asyncTask2).toHaveBeenCalled();
    });

    it("continues even if some async tasks fail", async () => {
      const authData: AuthData = { sub: "user_123" };
      const mockRequest = createMockRequest();
      const asyncTask1 = vi.fn().mockRejectedValue(new Error("Task 1 failed"));
      const asyncTask2 = vi.fn().mockResolvedValue(undefined);
      const asyncTask3 = vi.fn().mockRejectedValue(new Error("Task 3 failed"));

      (createServerMutators as Mock).mockImplementation((asyncTasks) => {
        asyncTasks.push(asyncTask1);
        asyncTasks.push(asyncTask2);
        asyncTasks.push(asyncTask3);
        return {};
      });
      (handleMutateRequest as Mock).mockResolvedValue({ success: true });

      // Should not throw even with failing tasks (uses Promise.allSettled)
      const result = await service.handleMutate(authData as any, mockRequest);

      expect(result).toEqual({ success: true });
      expect(asyncTask1).toHaveBeenCalled();
      expect(asyncTask2).toHaveBeenCalled();
      expect(asyncTask3).toHaveBeenCalled();
    });

    it("returns mutation result even when no async tasks exist", async () => {
      const authData: AuthData = { sub: "user_123" };
      const mockRequest = createMockRequest();
      const expectedResponse = { mutationId: "mut_123" };

      (createServerMutators as Mock).mockReturnValue({});
      (handleMutateRequest as Mock).mockResolvedValue(expectedResponse);

      const result = await service.handleMutate(authData as any, mockRequest);

      expect(result).toEqual(expectedResponse);
    });

    it("handles mutation errors gracefully", async () => {
      const authData: AuthData = { sub: "user_123" };
      const mockRequest = createMockRequest();
      const mutationError = new Error("Mutation failed");

      (createServerMutators as Mock).mockReturnValue({});
      (handleMutateRequest as Mock).mockRejectedValue(mutationError);

      await expect(
        service.handleMutate(authData as any, mockRequest)
      ).rejects.toThrow("Mutation failed");
    });

    it("async tasks are called after handleMutateRequest resolves", async () => {
      const authData: AuthData = { sub: "user_123" };
      const mockRequest = createMockRequest();
      const callOrder: string[] = [];

      const asyncTask = vi.fn().mockImplementation(async () => {
        callOrder.push("asyncTask");
      });

      (createServerMutators as Mock).mockImplementation((asyncTasks) => {
        asyncTasks.push(asyncTask);
        return {};
      });
      (handleMutateRequest as Mock).mockImplementation(async () => {
        callOrder.push("handleMutateRequest");
        return { success: true };
      });

      await service.handleMutate(authData as any, mockRequest);

      expect(callOrder).toEqual(["handleMutateRequest", "asyncTask"]);
    });
  });
});
