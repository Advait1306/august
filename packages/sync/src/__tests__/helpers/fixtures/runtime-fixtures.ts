/**
 * Test fixtures for runtime-related entities
 */

export interface RuntimeFixture {
  id: string;
  user_id: string;
  tools: Array<{ name: string; version: string }> | null;
  created_at: number;
  updated_at: number;
}

export interface UserFixture {
  id: string;
  deleted_at: number | null;
}

export function createRuntimeFixture(
  overrides: Partial<RuntimeFixture> = {}
): RuntimeFixture {
  return {
    id: "runtime-1",
    user_id: "test-user-id",
    tools: [
      { name: "bash", version: "1.0.0" },
      { name: "read", version: "1.0.0" },
      { name: "write", version: "1.0.0" },
    ],
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

export function createUserFixture(
  overrides: Partial<UserFixture> = {}
): UserFixture {
  return {
    id: "test-user-id",
    deleted_at: null,
    ...overrides,
  };
}
