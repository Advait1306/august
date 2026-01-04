import { vi } from "vitest";

export function createMockDb() {
  const mockQuery = {
    tasks: { findFirst: vi.fn(), findMany: vi.fn() },
    turns: { findFirst: vi.fn(), findMany: vi.fn() },
    blocks: { findFirst: vi.fn(), findMany: vi.fn() },
    users: { findFirst: vi.fn(), findMany: vi.fn() },
    organisations: { findFirst: vi.fn(), findMany: vi.fn() },
    mcps: { findFirst: vi.fn(), findMany: vi.fn() },
    usage: { findFirst: vi.fn(), findMany: vi.fn() },
    projects: { findFirst: vi.fn(), findMany: vi.fn() },
    agents: { findFirst: vi.fn(), findMany: vi.fn() },
    oauthStates: { findFirst: vi.fn(), findMany: vi.fn() },
    mcpOauthIntegrationDetails: { findFirst: vi.fn(), findMany: vi.fn() },
  };

  const mockDb = {
    query: mockQuery,
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  };

  return { mockDb, mockQuery };
}

export type MockDb = ReturnType<typeof createMockDb>["mockDb"];
