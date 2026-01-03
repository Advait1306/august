import { vi } from "vitest";
import React from "react";

// Mock useAuth hook
export const mockUseAuth = vi.fn(() => ({
  isLoaded: true,
  isSignedIn: true,
  userId: "test-user-id",
  sessionId: "test-session-id",
  getToken: vi.fn().mockResolvedValue("mock-token"),
}));

// Mock useUser hook
export const mockUseUser = vi.fn(() => ({
  isLoaded: true,
  isSignedIn: true,
  user: {
    id: "test-user-id",
    emailAddresses: [{ emailAddress: "test@example.com" }],
    firstName: "Test",
    lastName: "User",
    fullName: "Test User",
  },
}));

// Mock useSession hook
export const mockUseSession = vi.fn(() => ({
  isLoaded: true,
  isSignedIn: true,
  session: {
    id: "test-session-id",
  },
}));

// Setup Clerk mocks
export const setupClerkMocks = () => {
  vi.mock("@clerk/clerk-react", () => ({
    useAuth: mockUseAuth,
    useUser: mockUseUser,
    useSession: mockUseSession,
    ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
    SignedIn: ({ children }: { children: React.ReactNode }) => children,
    SignedOut: () => null,
    SignIn: () => React.createElement("div", { "data-testid": "clerk-sign-in" }),
    SignUp: () => React.createElement("div", { "data-testid": "clerk-sign-up" }),
    OrganizationSwitcher: () => null,
    UserButton: () =>
      React.createElement("div", { "data-testid": "clerk-user-button" }),
  }));
};

// Reset Clerk mocks
export const resetClerkMocks = () => {
  mockUseAuth.mockClear();
  mockUseUser.mockClear();
  mockUseSession.mockClear();
};

// Helper to simulate signed out state
export const setSignedOut = () => {
  mockUseAuth.mockReturnValue({
    isLoaded: true,
    isSignedIn: false,
    userId: null,
    sessionId: null,
    getToken: vi.fn().mockResolvedValue(null),
  });

  mockUseUser.mockReturnValue({
    isLoaded: true,
    isSignedIn: false,
    user: null,
  });
};

// Helper to simulate loading state
export const setLoading = () => {
  mockUseAuth.mockReturnValue({
    isLoaded: false,
    isSignedIn: false,
    userId: null,
    sessionId: null,
    getToken: vi.fn().mockResolvedValue(null),
  });

  mockUseUser.mockReturnValue({
    isLoaded: false,
    isSignedIn: false,
    user: null,
  });
};
