/**
 * Test fixtures for organisation-related entities: organisations, usage, dodoCustomerPortal
 */

export interface OrganisationFixture {
  id: string;
  payment_id: string | null;
  subscription_id: string | null;
  subscription_status:
    | "pending"
    | "active"
    | "on_hold"
    | "cancelled"
    | "failed"
    | "expired"
    | null;
  billing_exempt: boolean;
  deleted_at: number | null;
}

export interface UsageFixture {
  id: number;
  organisation_id: string;
  task_id: string | null;
  message_id: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  created_at: number;
}

export interface DodoCustomerPortalFixture {
  organisation_id: string;
  link: string;
  created_at: number;
}

export function createOrganisationFixture(
  overrides: Partial<OrganisationFixture> = {}
): OrganisationFixture {
  return {
    id: "test-org-id",
    payment_id: "pay_123",
    subscription_id: "sub_123",
    subscription_status: "active",
    billing_exempt: false,
    deleted_at: null,
    ...overrides,
  };
}

export function createUsageFixture(
  overrides: Partial<UsageFixture> = {}
): UsageFixture {
  return {
    id: 1,
    organisation_id: "test-org-id",
    task_id: "task-1",
    message_id: "msg_123",
    model: "claude-3-opus",
    input_tokens: 100,
    output_tokens: 200,
    cache_creation_input_tokens: 50,
    cache_read_input_tokens: 25,
    created_at: Date.now(),
    ...overrides,
  };
}

export function createDodoCustomerPortalFixture(
  overrides: Partial<DodoCustomerPortalFixture> = {}
): DodoCustomerPortalFixture {
  return {
    organisation_id: "test-org-id",
    link: "https://portal.dodo.com/session/abc123",
    created_at: Date.now(),
    ...overrides,
  };
}

/**
 * Creates an expired portal fixture (older than 24 hours)
 */
export function createExpiredDodoCustomerPortalFixture(
  overrides: Partial<DodoCustomerPortalFixture> = {}
): DodoCustomerPortalFixture {
  const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000;
  return createDodoCustomerPortalFixture({
    created_at: twentyFiveHoursAgo,
    ...overrides,
  });
}
