/**
 * Test fixtures for MCP-related entities: mcps, mcpStore, connections
 */

export interface McpFixture {
  id: string;
  organisation_id: string;
  author_id: string;
  name: string;
  mcp_store_id: string | null;
  integration_type: "oauth" | "composio";
  custom_mcp_server_url: string | null;
  created_at: number;
  updated_at: number;
}

export interface McpStoreFixture {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  category: string | null;
  integration_type: "oauth" | "composio";
  is_active: number;
  sort_order: number | null;
  metadata: any;
  created_at: number;
  updated_at: number;
}

export interface McpComposioConnectionFixture {
  id: string;
  mcp_id: string;
  connection_url: string;
  created_at: number;
  updated_at: number;
}

export interface McpOauthConnectionFixture {
  id: string;
  mcp_id: string;
  oauth_client_id: string | null;
  oauth_client_secret: string | null;
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_at: number | null;
  scope: string | null;
  provider_metadata: any;
  oauth_metadata: any;
  created_at: number;
  updated_at: number;
}

export function createMcpFixture(
  overrides: Partial<McpFixture> = {}
): McpFixture {
  return {
    id: "mcp-1",
    organisation_id: "test-org-id",
    author_id: "test-user-id",
    name: "Test MCP",
    mcp_store_id: "store-1",
    integration_type: "oauth",
    custom_mcp_server_url: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

export function createComposioMcpFixture(
  overrides: Partial<McpFixture> = {}
): McpFixture {
  return createMcpFixture({
    id: "mcp-composio-1",
    name: "Test Composio MCP",
    integration_type: "composio",
    ...overrides,
  });
}

export function createMcpStoreFixture(
  overrides: Partial<McpStoreFixture> = {}
): McpStoreFixture {
  return {
    id: "store-1",
    slug: "test-integration",
    name: "Test Integration",
    description: "A test integration for unit tests",
    logo_url: "https://example.com/logo.png",
    category: "productivity",
    integration_type: "oauth",
    is_active: 1,
    sort_order: 1,
    metadata: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

export function createMcpComposioConnectionFixture(
  overrides: Partial<McpComposioConnectionFixture> = {}
): McpComposioConnectionFixture {
  return {
    id: "conn-1",
    mcp_id: "mcp-1",
    connection_url: "https://composio.example.com/connections/abc123",
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

export function createMcpOauthConnectionFixture(
  overrides: Partial<McpOauthConnectionFixture> = {}
): McpOauthConnectionFixture {
  return {
    id: "oauth-conn-1",
    mcp_id: "mcp-1",
    oauth_client_id: null,
    oauth_client_secret: null,
    access_token: "encrypted_access_token",
    refresh_token: "encrypted_refresh_token",
    token_type: "Bearer",
    expires_at: Date.now() + 3600000,
    scope: "read write",
    provider_metadata: null,
    oauth_metadata: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}
