import { vi, beforeEach, afterEach } from "vitest";

// Mock environment variables for tests
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.CLERK_SECRET_KEY = "sk_test_clerk_key";
process.env.CLERK_WEBHOOK_KEY = "whsec_test_key";
process.env.DODO_PAYMENTS_API_KEY = "sk_test_dodo_key";
process.env.DODO_PAYMENTS_ENVIRONMENT = "test_mode";
process.env.DODO_WEBHOOK_SECRET = "whsec_test_dodo";
process.env.COMPOSIO_API_KEY = "sk_test_composio";
process.env.ENCRYPTION_KEY = "test-encryption-key-32-chars-ok!";
process.env.SERVER_URL = "http://localhost:8080";
process.env.WEB_URL = "http://localhost:3000";
process.env.MIXPANEL_TOKEN = "test_mixpanel_token";
process.env.NODE_ENV = "test";

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks();
});
