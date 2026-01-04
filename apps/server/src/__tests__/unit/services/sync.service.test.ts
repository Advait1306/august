import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { SyncService } from "../../../services/sync.service.js";
import { OAuthService } from "../../../services/oauth.service.js";
import type { DbProviderType } from "../../../config/state.js";
import type { Mixpanel } from "mixpanel";
import type DodoPayments from "dodopayments";

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
import type { AuthData } from "@jupiter/sync/zero/schema";

// Mock interfaces for partial implementations
interface MockMixpanel {
  track: ReturnType<typeof vi.fn>;
  people: {
    set: ReturnType<typeof vi.fn>;
  };
}

interface MockDodoClient {
  subscriptions: {
    retrieve: ReturnType<typeof vi.fn>;
    changePlan: ReturnType<typeof vi.fn>;
  };
}

// Mock factories
function createMockDbProvider(): ReturnType<typeof vi.fn> {
  return vi.fn();
}

function createMockMixpanel(): MockMixpanel {
  return {
    track: vi.fn(),
    people: {
      set: vi.fn(),
    },
  };
}

function createMockDodoClient(): MockDodoClient {
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
  let mockMp: MockMixpanel;
  let mockDodoClient: MockDodoClient;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singletons
    (SyncService as unknown as { instance: SyncService | null }).instance = null;
    (OAuthService as unknown as { instance: OAuthService | null }).instance = null;

    mockDbProvider = createMockDbProvider();
    mockMp = createMockMixpanel();
    mockDodoClient = createMockDodoClient();

    // Initialize OAuthService singleton (required by SyncService.handleMutate internally)
    OAuthService.getInstance({ select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() } as unknown as Parameters<typeof OAuthService.getInstance>[0]);

    service = SyncService.getInstance(
      mockDbProvider as unknown as DbProviderType,
      mockMp as unknown as Mixpanel,
      mockDodoClient as unknown as DodoPayments
    );
  });

  describe("handleQuery", () => {
    it("calls handleQueryRequest with correct parameters", async () => {
      const authData: AuthData = { userId: "user_123", orgId: "org_456" };
      const mockRequest = createMockRequest({ query: "testQuery" });
      const expectedResponse = { data: "test" };

      (handleQueryRequest as Mock).mockResolvedValue(expectedResponse);

      const result = await service.handleQuery(authData, mockRequest);

      expect(result).toEqual(expectedResponse);
      expect(handleQueryRequest).toHaveBeenCalledWith(
        expect.any(Function),
        schema,
        mockRequest
      );
    });

    it("uses mustGetQuery to retrieve query function", async () => {
      const authData: AuthData = { userId: "user_123", orgId: "org_456" };
      const mockRequest = createMockRequest();
      const mockQueryFn = vi.fn().mockReturnValue({ result: "query_result" });

      (mustGetQuery as Mock).mockReturnValue({ fn: mockQueryFn });
      (handleQueryRequest as Mock).mockImplementation(
        async (queryHandler) => {
          // Simulate the query handler being called
          const result = queryHandler("testQuery", { arg1: "value1" });
          return result;
        }
      );

      await service.handleQuery(authData, mockRequest);

      expect(mustGetQuery).toHaveBeenCalledWith(queries, "testQuery");
      expect(mockQueryFn).toHaveBeenCalledWith({
        args: { arg1: "value1" },
        ctx: authData,
      });
    });

    it("passes authData as context to query function", async () => {
      const authData: AuthData = { userId: "user_abc", orgId: "org_xyz" };
      const mockRequest = createMockRequest();
      const mockQueryFn = vi.fn().mockReturnValue({});

      (mustGetQuery as Mock).mockReturnValue({ fn: mockQueryFn });
      (handleQueryRequest as Mock).mockImplementation(
        async (queryHandler) => {
          queryHandler("someQuery", { filter: "active" });
          return {};
        }
      );

      await service.handleQuery(authData, mockRequest);

      expect(mockQueryFn).toHaveBeenCalledWith(
        expect.objectContaining({
          ctx: authData,
        })
      );
    });

    it("handles query errors gracefully", async () => {
      const authData: AuthData = { userId: "user_123", orgId: "org_456" };
      const mockRequest = createMockRequest();
      const queryError = new Error("Query failed");

      (handleQueryRequest as Mock).mockRejectedValue(queryError);

      await expect(
        service.handleQuery(authData, mockRequest)
      ).rejects.toThrow("Query failed");
    });
  });

  describe("handleMutate", () => {
    it("calls handleMutateRequest with correct parameters", async () => {
      const authData: AuthData = { userId: "user_123", orgId: "org_456" };
      const mockRequest = createMockRequest({ mutation: "testMutation" });
      const expectedResponse = { success: true };
      const mockServerMutators = { testMutator: { fn: vi.fn() } };

      (createServerMutators as Mock).mockReturnValue(mockServerMutators);
      (handleMutateRequest as Mock).mockResolvedValue(expectedResponse);

      const result = await service.handleMutate(authData, mockRequest);

      expect(result).toEqual(expectedResponse);
      expect(handleMutateRequest).toHaveBeenCalledWith(
        mockDbProvider,
        expect.any(Function),
        mockRequest
      );
    });

    it("creates server mutators with correct dependencies", async () => {
      const authData: AuthData = { userId: "user_123", orgId: "org_456" };
      const mockRequest = createMockRequest();
      const mockServerMutators = {};

      (createServerMutators as Mock).mockReturnValue(mockServerMutators);
      (handleMutateRequest as Mock).mockResolvedValue({});

      await service.handleMutate(authData, mockRequest);

      expect(createServerMutators).toHaveBeenCalledWith(
        expect.any(Array), // asyncTasks array
        mockMp,
        OAuthService.getInstance(), // OAuthService singleton is called internally
        expect.any(Function), // addToAgentLoopQueue
        mockDodoClient
      );
    });

    it("uses mustGetMutator to retrieve mutator function", async () => {
      const authData: AuthData = { userId: "user_123", orgId: "org_456" };
      const mockRequest = createMockRequest();
      const mockMutatorFn = vi.fn().mockReturnValue({ result: "mutated" });
      const mockServerMutators = { testMutator: { fn: mockMutatorFn } };
      const mockTx = { query: vi.fn(), mutate: vi.fn() };

      (createServerMutators as Mock).mockReturnValue(mockServerMutators);
      (mustGetMutator as Mock).mockReturnValue({ fn: mockMutatorFn });
      (handleMutateRequest as Mock).mockImplementation(
        async (_dbProvider, transactHandler) => {
          // Simulate the transact handler being called with a transact function
          // The transact function receives a callback that gets (tx, name, args)
          type TxCallback = (tx: unknown, name: string, args: unknown) => unknown;
          await transactHandler((txCallback: TxCallback) => {
            // Simulate calling the callback with tx, name, and args
            return txCallback(mockTx, "testMutator", { data: "test" });
          });
          return {};
        }
      );

      await service.handleMutate(authData, mockRequest);

      expect(mustGetMutator).toHaveBeenCalledWith(
        mockServerMutators,
        "testMutator"
      );
    });

    it("passes authData as context to mutator function", async () => {
      const authData: AuthData = { userId: "user_abc", orgId: "org_xyz" };
      const mockRequest = createMockRequest();
      const mockMutatorFn = vi.fn().mockReturnValue({});
      const mockServerMutators = { testMutator: { fn: mockMutatorFn } };
      const mockTx = {};

      (createServerMutators as Mock).mockReturnValue(mockServerMutators);
      (mustGetMutator as Mock).mockReturnValue({ fn: mockMutatorFn });
      (handleMutateRequest as Mock).mockImplementation(
        async (_dbProvider, transactHandler) => {
          // Simulate the transact handler being called with a transact function
          type TxCallback = (tx: unknown, name: string, args: unknown) => unknown;
          await transactHandler((txCallback: TxCallback) => {
            return txCallback(mockTx, "testMutator", { data: "test" });
          });
          return {};
        }
      );

      await service.handleMutate(authData, mockRequest);

      expect(mockMutatorFn).toHaveBeenCalledWith(
        expect.objectContaining({
          ctx: authData,
        })
      );
    });

    it("runs async tasks after mutation completes", async () => {
      const authData: AuthData = { userId: "user_123", orgId: "org_456" };
      const mockRequest = createMockRequest();
      const asyncTask1 = vi.fn().mockResolvedValue(undefined);
      const asyncTask2 = vi.fn().mockResolvedValue(undefined);

      (createServerMutators as Mock).mockImplementation((asyncTasks: Array<() => Promise<void>>) => {
        // Simulate mutators adding async tasks
        asyncTasks.push(asyncTask1);
        asyncTasks.push(asyncTask2);
        return {};
      });
      (handleMutateRequest as Mock).mockResolvedValue({ success: true });

      await service.handleMutate(authData, mockRequest);

      expect(asyncTask1).toHaveBeenCalled();
      expect(asyncTask2).toHaveBeenCalled();
    });

    it("continues even if some async tasks fail", async () => {
      const authData: AuthData = { userId: "user_123", orgId: "org_456" };
      const mockRequest = createMockRequest();
      const asyncTask1 = vi.fn().mockRejectedValue(new Error("Task 1 failed"));
      const asyncTask2 = vi.fn().mockResolvedValue(undefined);
      const asyncTask3 = vi.fn().mockRejectedValue(new Error("Task 3 failed"));

      (createServerMutators as Mock).mockImplementation((asyncTasks: Array<() => Promise<void>>) => {
        asyncTasks.push(asyncTask1);
        asyncTasks.push(asyncTask2);
        asyncTasks.push(asyncTask3);
        return {};
      });
      (handleMutateRequest as Mock).mockResolvedValue({ success: true });

      // Should not throw even with failing tasks (uses Promise.allSettled)
      const result = await service.handleMutate(authData, mockRequest);

      expect(result).toEqual({ success: true });
      expect(asyncTask1).toHaveBeenCalled();
      expect(asyncTask2).toHaveBeenCalled();
      expect(asyncTask3).toHaveBeenCalled();
    });

    it("returns mutation result even when no async tasks exist", async () => {
      const authData: AuthData = { userId: "user_123", orgId: "org_456" };
      const mockRequest = createMockRequest();
      const expectedResponse = { mutationId: "mut_123" };

      (createServerMutators as Mock).mockReturnValue({});
      (handleMutateRequest as Mock).mockResolvedValue(expectedResponse);

      const result = await service.handleMutate(authData, mockRequest);

      expect(result).toEqual(expectedResponse);
    });

    it("handles mutation errors gracefully", async () => {
      const authData: AuthData = { userId: "user_123", orgId: "org_456" };
      const mockRequest = createMockRequest();
      const mutationError = new Error("Mutation failed");

      (createServerMutators as Mock).mockReturnValue({});
      (handleMutateRequest as Mock).mockRejectedValue(mutationError);

      await expect(
        service.handleMutate(authData, mockRequest)
      ).rejects.toThrow("Mutation failed");
    });

    it("async tasks are called after handleMutateRequest resolves", async () => {
      const authData: AuthData = { userId: "user_123", orgId: "org_456" };
      const mockRequest = createMockRequest();
      const callOrder: string[] = [];

      const asyncTask = vi.fn().mockImplementation(async () => {
        callOrder.push("asyncTask");
      });

      (createServerMutators as Mock).mockImplementation((asyncTasks: Array<() => Promise<void>>) => {
        asyncTasks.push(asyncTask);
        return {};
      });
      (handleMutateRequest as Mock).mockImplementation(async () => {
        callOrder.push("handleMutateRequest");
        return { success: true };
      });

      await service.handleMutate(authData, mockRequest);

      expect(callOrder).toEqual(["handleMutateRequest", "asyncTask"]);
    });
  });
});
