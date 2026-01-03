import React, { ReactElement, ReactNode } from "react";
import { render, RenderOptions, RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsProvider, Settings } from "@/src/contexts/settings-context";

// Re-export everything from testing-library
export * from "@testing-library/react";
export { userEvent };

// All providers wrapper
interface AllProvidersProps {
  children: ReactNode;
  initialSettings?: Partial<Settings>;
}

const AllProviders = ({ children, initialSettings }: AllProvidersProps) => {
  return (
    <SettingsProvider defaultSettings={initialSettings}>
      {children}
    </SettingsProvider>
  );
};

// Custom render options
interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  initialSettings?: Partial<Settings>;
}

/**
 * Custom render function that wraps components with all necessary providers.
 * Returns the render result plus a userEvent instance for simulating interactions.
 *
 * @example
 * ```tsx
 * const { user, getByRole } = customRender(<MyComponent />);
 * await user.click(getByRole('button'));
 * ```
 */
export const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult & { user: ReturnType<typeof userEvent.setup> } => {
  const { initialSettings, ...renderOptions } = options;

  const user = userEvent.setup();

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <AllProviders initialSettings={initialSettings}>{children}</AllProviders>
  );

  return {
    user,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
};

// Helper to wait for async operations
export const waitForLoadingToFinish = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

// ============================================
// Mock Data Factories
// ============================================

/**
 * Create a mock task object for testing
 */
export const createMockTask = (overrides: Record<string, unknown> = {}) => ({
  id: "test-task-" + Math.random().toString(36).substring(2, 11),
  name: "Test Task",
  status: "available" as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  runtime_id: "test-runtime-id",
  last_session_id: "test-session-id",
  metadata: {},
  ...overrides,
});

/**
 * Create a mock user object for testing
 */
export const createMockUser = (overrides: Record<string, unknown> = {}) => ({
  id: "test-user-id",
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  fullName: "Test User",
  ...overrides,
});

/**
 * Create mock settings for testing
 */
export const createMockSettings = (
  overrides: Partial<Settings> = {}
): Settings => ({
  general: {
    language: "en",
    notifications: true,
    ...(overrides.general || {}),
  },
  appearance: {
    theme: "system",
    fontSize: "medium",
    compactMode: false,
    ...(overrides.appearance || {}),
  },
  claudeCode: {
    binaryPath: "",
    autoUpdate: true,
    enableLogging: false,
    inheritUserSettings: false,
    ...(overrides.claudeCode || {}),
  },
  privacy: {
    analytics: true,
    crashReporting: true,
    ...(overrides.privacy || {}),
  },
  experimental: {
    enableExperimentalFeatures: false,
    ...(overrides.experimental || {}),
  },
});

/**
 * Create a mock message object for testing
 */
export const createMockMessage = (overrides: Record<string, unknown> = {}) => ({
  id: "test-message-" + Math.random().toString(36).substring(2, 11),
  task_id: "test-task-id",
  role: "user" as const,
  content: "Test message content",
  created_at: new Date().toISOString(),
  ...overrides,
});

/**
 * Create a mock permission request for testing
 */
export const createMockPermission = (
  overrides: Record<string, unknown> = {}
) => ({
  toolName: "bash",
  input: { command: "ls -la" },
  grant: () => {},
  deny: () => {},
  alwaysAllow: () => {},
  ...overrides,
});
