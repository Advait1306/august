import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { UsageService } from "../../../services/usage.service.js";
import type { AppState } from "../../../config/state.js";

// Mock interface for the database chain methods that matches drizzle's fluent API
interface MockOnConflictDoNothing {
  onConflictDoNothing: Mock<(target?: unknown) => Promise<void>>;
}

interface MockValues {
  values: Mock<(data?: unknown) => MockOnConflictDoNothing>;
}

interface MockInsert {
  insert: Mock<(table?: unknown) => MockValues>;
}

type MockDb = MockInsert;

// Mock the database
function createMockDb(): MockDb {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  } as MockDb;
}

describe("UsageService", () => {
  let service: UsageService;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton
    (UsageService as unknown as { instance: UsageService | null }).instance = null;
    mockDb = createMockDb();
    service = UsageService.getInstance(mockDb as unknown as AppState["db"]);
  });

  describe("recordUsage", () => {
    const testUsageData = {
      organisationId: "org_123",
      taskId: "task_456",
      messageId: "msg_789",
      model: "claude-3-opus",
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationInputTokens: 100,
      cacheReadInputTokens: 200,
    };

    it("inserts usage record with correct values", async () => {
      await service.recordUsage(testUsageData);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.insert().values).toHaveBeenCalledWith({
        organisation_id: "org_123",
        task_id: "task_456",
        message_id: "msg_789",
        model: "claude-3-opus",
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 200,
      });
      expect(mockDb.insert().values().onConflictDoNothing).toHaveBeenCalled();
    });

    it("handles duplicate message_id by doing nothing", async () => {
      await service.recordUsage(testUsageData);
      await service.recordUsage(testUsageData);

      // Both calls should succeed without throwing
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it("handles zero token values", async () => {
      const zeroTokenData = {
        ...testUsageData,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      };

      await service.recordUsage(zeroTokenData);

      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          input_tokens: 0,
          output_tokens: 0,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        })
      );
    });

    it("handles large token values", async () => {
      const largeTokenData = {
        ...testUsageData,
        inputTokens: 1000000,
        outputTokens: 500000,
        cacheCreationInputTokens: 100000,
        cacheReadInputTokens: 200000,
      };

      await service.recordUsage(largeTokenData);

      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          input_tokens: 1000000,
          output_tokens: 500000,
          cache_creation_input_tokens: 100000,
          cache_read_input_tokens: 200000,
        })
      );
    });
  });
});
