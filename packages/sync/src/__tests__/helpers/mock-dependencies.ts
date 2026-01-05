import { vi } from "vitest";
import type {
  AsyncTask,
  OAuthService,
  AddToAgentLoopQueue,
  TrackEventFn,
  AgentLoopJobData,
} from "../../features/types";

/**
 * Creates a mock AsyncTask array.
 * AsyncTask is an array of async functions that get executed after mutations.
 */
export function createMockAsyncTasks(): AsyncTask {
  return [];
}

/**
 * Creates a mock OAuthService with a revokeToken method.
 */
export function createMockOAuthService(): OAuthService {
  return {
    revokeToken: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Creates a mock AddToAgentLoopQueue function.
 */
export function createMockAgentLoopQueue(): AddToAgentLoopQueue {
  return vi.fn().mockResolvedValue(undefined);
}

/**
 * Creates a mock TrackEvent function.
 */
export function createMockTrackEvent(): TrackEventFn {
  return vi.fn().mockResolvedValue(undefined);
}

/**
 * Creates a mock TrackEventFn factory (used by server mutators).
 * Returns a function that takes userId, orgId and returns a TrackEventFn.
 */
export function createMockTrackEventFactory(): (
  userId: string,
  orgId: string
) => TrackEventFn {
  return vi.fn().mockImplementation((_userId: string, _orgId: string) => {
    return vi.fn().mockResolvedValue(undefined);
  });
}

/**
 * Creates a mock Mixpanel client.
 */
export function createMockMixpanel() {
  return {
    track: vi.fn(),
    people: {
      set: vi.fn(),
    },
  };
}

/**
 * Creates a mock DodoPayments client.
 */
export function createMockDodoClient() {
  return {
    customers: {
      list: vi.fn().mockResolvedValue({ items: [] }),
      customerPortal: {
        create: vi.fn().mockResolvedValue({ link: "https://portal.example.com" }),
      },
    },
  };
}

/**
 * Helper to create a mock DodoPayments client with a customer.
 */
export function createMockDodoClientWithCustomer(customerId: string) {
  return {
    customers: {
      list: vi.fn().mockResolvedValue({
        items: [{ customer_id: customerId }],
      }),
      customerPortal: {
        create: vi.fn().mockResolvedValue({ link: "https://portal.example.com/session" }),
      },
    },
  };
}
