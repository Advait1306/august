import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { ClerkService } from "../../../services/clerk.service.js";
import { AppState } from "../../../config/state.js";

// Define mock interfaces for the database operations
interface MockOnConflictDoNothing {
  onConflictDoNothing: Mock<() => Promise<undefined>>;
}

interface MockValues {
  values: Mock<(value?: unknown) => MockOnConflictDoNothing>;
}

interface MockInsert {
  insert: Mock<(table?: unknown) => MockValues>;
}

interface MockWhere {
  where: Mock<(condition?: unknown) => Promise<undefined>>;
}

interface MockSet {
  set: Mock<(values?: { deleted_at: Date }) => MockWhere>;
}

interface MockUpdate {
  update: Mock<(table?: unknown) => MockSet>;
}

interface MockDb extends MockInsert, MockUpdate {}

// Mock the database
function createMockDb(): MockDb {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };
}

describe("ClerkService", () => {
  let service: ClerkService;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton
    (ClerkService as unknown as { instance: ClerkService | null }).instance = null;
    mockDb = createMockDb();
    service = ClerkService.getInstance(mockDb as unknown as AppState["db"]);
  });

  describe("createUser", () => {
    it("inserts a user with the given ID", async () => {
      await service.createUser("user_123");

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.insert().values).toHaveBeenCalledWith({ id: "user_123" });
      expect(mockDb.insert().values().onConflictDoNothing).toHaveBeenCalled();
    });

    it("handles conflict by doing nothing (upsert behavior)", async () => {
      // Second call should not throw
      await service.createUser("user_123");
      await service.createUser("user_123");

      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe("createOrganisation", () => {
    it("inserts an organisation with the given ID", async () => {
      await service.createOrganisation("org_456");

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.insert().values).toHaveBeenCalledWith({ id: "org_456" });
      expect(mockDb.insert().values().onConflictDoNothing).toHaveBeenCalled();
    });

    it("handles conflict by doing nothing (upsert behavior)", async () => {
      await service.createOrganisation("org_456");
      await service.createOrganisation("org_456");

      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe("deleteUser", () => {
    it("soft deletes a user by setting deleted_at", async () => {
      const beforeTime = new Date();
      await service.deleteUser("user_123");
      const afterTime = new Date();

      expect(mockDb.update).toHaveBeenCalled();
      const setCall = mockDb.update().set.mock.calls[0]![0]!;
      expect(setCall.deleted_at).toBeInstanceOf(Date);
      expect(setCall.deleted_at.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime()
      );
      expect(setCall.deleted_at.getTime()).toBeLessThanOrEqual(
        afterTime.getTime()
      );
    });
  });

  describe("deleteOrganisation", () => {
    it("soft deletes an organisation by setting deleted_at", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const beforeTime = new Date();
      await service.deleteOrganisation("org_456");
      const afterTime = new Date();

      expect(mockDb.update).toHaveBeenCalled();
      const setCall = mockDb.update().set.mock.calls[0]![0]!;
      expect(setCall.deleted_at).toBeInstanceOf(Date);
      expect(setCall.deleted_at.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime()
      );
      expect(setCall.deleted_at.getTime()).toBeLessThanOrEqual(
        afterTime.getTime()
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "Soft deleted organisation org_456"
      );

      consoleSpy.mockRestore();
    });
  });

  describe("generateSignInToken", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      process.env.CLERK_SECRET_KEY = "sk_test_clerk_key";
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("calls Clerk API and returns the token", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: "sign_in_token_abc123" }),
      });

      const token = await service.generateSignInToken("user_123");

      expect(token).toBe("sign_in_token_abc123");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.clerk.com/v1/sign_in_tokens",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer sk_test_clerk_key",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_id: "user_123" }),
        }
      );
    });

    it("throws error when Clerk API returns error", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("Invalid API key"),
      });

      await expect(service.generateSignInToken("user_123")).rejects.toThrow(
        "Failed to generate token"
      );

      expect(consoleSpy).toHaveBeenCalledWith("Clerk API error:", expect.any(String));
      consoleSpy.mockRestore();
    });
  });
});
