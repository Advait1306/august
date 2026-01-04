import { describe, it, expect, vi, beforeEach } from "vitest";
import { SubscriptionService } from "../../../services/subscription.service.js";

// Mock the database
function createMockDb() {
  return {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  };
}

// Mock Dodo Payments client
function createMockDodoClient() {
  return {
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue({
        product_id: "pdt_test",
        quantity: 1,
      }),
      changePlan: vi.fn().mockResolvedValue({ success: true }),
    },
  };
}

// Mock Clerk client
function createMockClerkClient() {
  return {
    organizations: {
      getOrganizationMembershipList: vi.fn().mockResolvedValue({
        totalCount: 3,
        data: [],
      }),
    },
  };
}

describe("SubscriptionService", () => {
  let service: SubscriptionService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockDodoClient: ReturnType<typeof createMockDodoClient>;
  let mockClerkClient: ReturnType<typeof createMockClerkClient>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockDodoClient = createMockDodoClient();
    mockClerkClient = createMockClerkClient();
    service = new SubscriptionService(
      mockDb as any,
      mockDodoClient as any,
      mockClerkClient as any
    );
    vi.clearAllMocks();
  });

  describe("getOrgMemberCount", () => {
    it("returns member count from Clerk", async () => {
      mockClerkClient.organizations.getOrganizationMembershipList.mockResolvedValue(
        {
          totalCount: 5,
          data: [],
        }
      );

      const count = await service.getOrgMemberCount("org_123");

      expect(count).toBe(5);
      expect(
        mockClerkClient.organizations.getOrganizationMembershipList
      ).toHaveBeenCalledWith({
        organizationId: "org_123",
      });
    });

    it("throws error when Clerk API fails", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockClerkClient.organizations.getOrganizationMembershipList.mockRejectedValue(
        new Error("Clerk API error")
      );

      await expect(service.getOrgMemberCount("org_123")).rejects.toThrow(
        "Clerk API error"
      );
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("calculateAddonSeats", () => {
    it("returns 0 for 1 member (base seat included)", () => {
      expect(service.calculateAddonSeats(1)).toBe(0);
    });

    it("returns 0 for 0 members", () => {
      expect(service.calculateAddonSeats(0)).toBe(0);
    });

    it("returns memberCount - 1 for multiple members", () => {
      expect(service.calculateAddonSeats(2)).toBe(1);
      expect(service.calculateAddonSeats(5)).toBe(4);
      expect(service.calculateAddonSeats(10)).toBe(9);
    });

    it("handles negative input gracefully", () => {
      expect(service.calculateAddonSeats(-1)).toBe(0);
    });
  });

  describe("updateSubscriptionStatus", () => {
    it("updates status without subscription ID", async () => {
      await service.updateSubscriptionStatus("org_123", "active");

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.update().set).toHaveBeenCalledWith({
        subscription_status: "active",
      });
    });

    it("updates status with subscription ID", async () => {
      await service.updateSubscriptionStatus("org_123", "active", "sub_456");

      expect(mockDb.update().set).toHaveBeenCalledWith({
        subscription_status: "active",
        subscription_id: "sub_456",
      });
    });

    it("handles different status values", async () => {
      const statuses = ["active", "cancelled", "paused", "on_trial"] as const;

      for (const status of statuses) {
        vi.clearAllMocks();
        await service.updateSubscriptionStatus("org_123", status as any);
        expect(mockDb.update().set).toHaveBeenCalledWith(
          expect.objectContaining({
            subscription_status: status,
          })
        );
      }
    });
  });

  describe("getSubscription", () => {
    it("retrieves subscription from Dodo", async () => {
      const mockSubscription = {
        product_id: "pdt_test",
        quantity: 1,
        status: "active",
      };
      mockDodoClient.subscriptions.retrieve.mockResolvedValue(mockSubscription);

      const result = await service.getSubscription("sub_123");

      expect(result).toEqual(mockSubscription);
      expect(mockDodoClient.subscriptions.retrieve).toHaveBeenCalledWith(
        "sub_123"
      );
    });

    it("throws error when Dodo API fails", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockDodoClient.subscriptions.retrieve.mockRejectedValue(
        new Error("Dodo API error")
      );

      await expect(service.getSubscription("sub_123")).rejects.toThrow(
        "Dodo API error"
      );
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("updateSubscriptionSeats", () => {
    it("updates subscription with addon seats", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      mockDodoClient.subscriptions.retrieve.mockResolvedValue({
        product_id: "pdt_test",
        quantity: 1,
      });

      await service.updateSubscriptionSeats("sub_123", 3);

      expect(mockDodoClient.subscriptions.changePlan).toHaveBeenCalledWith(
        "sub_123",
        {
          product_id: "pdt_test",
          quantity: 1,
          proration_billing_mode: "prorated_immediately",
          addons: expect.arrayContaining([
            expect.objectContaining({ quantity: 3 }),
          ]),
        }
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "Updated subscription sub_123 addon seats to 3"
      );
      consoleSpy.mockRestore();
    });

    it("sends empty addons array when quantity is 0", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      mockDodoClient.subscriptions.retrieve.mockResolvedValue({
        product_id: "pdt_test",
        quantity: 1,
      });

      await service.updateSubscriptionSeats("sub_123", 0);

      expect(mockDodoClient.subscriptions.changePlan).toHaveBeenCalledWith(
        "sub_123",
        expect.objectContaining({
          addons: [],
        })
      );
      consoleSpy.mockRestore();
    });

    it("throws error when Dodo API fails", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockDodoClient.subscriptions.retrieve.mockResolvedValue({
        product_id: "pdt_test",
        quantity: 1,
      });
      mockDodoClient.subscriptions.changePlan.mockRejectedValue(
        new Error("Dodo API error")
      );

      await expect(service.updateSubscriptionSeats("sub_123", 3)).rejects.toThrow(
        "Dodo API error"
      );
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("handleMemberChange", () => {
    beforeEach(() => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("skips if org not found", async () => {
      mockDb.select().from().where().limit.mockResolvedValue([]);

      await service.handleMemberChange("org_123");

      expect(mockDodoClient.subscriptions.changePlan).not.toHaveBeenCalled();
    });

    it("skips if org has no subscription", async () => {
      mockDb.select().from().where().limit.mockResolvedValue([
        { id: "org_123", subscription_id: null },
      ]);

      await service.handleMemberChange("org_123");

      expect(mockDodoClient.subscriptions.changePlan).not.toHaveBeenCalled();
    });

    it("updates seats using provided member count", async () => {
      mockDb.select().from().where().limit.mockResolvedValue([
        { id: "org_123", subscription_id: "sub_456" },
      ]);
      mockDodoClient.subscriptions.retrieve.mockResolvedValue({
        product_id: "pdt_test",
        quantity: 1,
      });

      await service.handleMemberChange("org_123", 5);

      // 5 members = 4 addon seats
      expect(mockDodoClient.subscriptions.changePlan).toHaveBeenCalledWith(
        "sub_456",
        expect.objectContaining({
          addons: expect.arrayContaining([
            expect.objectContaining({ quantity: 4 }),
          ]),
        })
      );
      // Should not call Clerk API when member count is provided
      expect(
        mockClerkClient.organizations.getOrganizationMembershipList
      ).not.toHaveBeenCalled();
    });

    it("fetches member count from Clerk when not provided", async () => {
      mockDb.select().from().where().limit.mockResolvedValue([
        { id: "org_123", subscription_id: "sub_456" },
      ]);
      mockClerkClient.organizations.getOrganizationMembershipList.mockResolvedValue(
        { totalCount: 3, data: [] }
      );
      mockDodoClient.subscriptions.retrieve.mockResolvedValue({
        product_id: "pdt_test",
        quantity: 1,
      });

      await service.handleMemberChange("org_123");

      expect(
        mockClerkClient.organizations.getOrganizationMembershipList
      ).toHaveBeenCalledWith({ organizationId: "org_123" });
      // 3 members = 2 addon seats
      expect(mockDodoClient.subscriptions.changePlan).toHaveBeenCalledWith(
        "sub_456",
        expect.objectContaining({
          addons: expect.arrayContaining([
            expect.objectContaining({ quantity: 2 }),
          ]),
        })
      );
    });

    it("does not throw on error (catches and logs)", async () => {
      mockDb.select().from().where().limit.mockRejectedValue(
        new Error("DB error")
      );

      // Should not throw
      await expect(service.handleMemberChange("org_123")).resolves.toBeUndefined();
    });
  });
});
