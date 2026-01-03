import { vi } from "vitest";

// Mock Zero instance
export const mockZero = {
  mutate: vi.fn().mockReturnValue({ client: Promise.resolve() }),
  query: vi.fn().mockReturnValue([]),
};

// Mock useQuery result
export const mockUseQuery = vi.fn(() => [[], { loading: false }]);

// Mock useZero hook
export const mockUseZero = vi.fn(() => mockZero);

// Setup Zero mocks - call this to register the mocks
export const setupZeroMocks = () => {
  vi.mock("@rocicorp/zero/react", () => ({
    createUseZero: () => mockUseZero,
    useQuery: mockUseQuery,
    ZeroProvider: ({ children }: { children: React.ReactNode }) => children,
  }));

  vi.mock("@jupiter/sync/queries/data", () => ({
    queries: {
      tasks: {
        all: vi.fn(() => ({ queryKey: ["tasks"] })),
      },
      blocks: {
        getPendingShellTools: vi.fn(() => ({ queryKey: ["blocks", "pending"] })),
      },
    },
  }));

  vi.mock("@jupiter/sync/mutators/data", () => ({
    mutators: {
      tasks: {
        create: vi.fn((data: unknown) => data),
        abort: vi.fn((data: unknown) => data),
      },
      message: {
        create: vi.fn((data: unknown) => data),
      },
      runtimes: {
        register: vi.fn((data: unknown) => data),
      },
      tools: {
        submitResult: vi.fn((data: unknown) => data),
      },
    },
  }));
};

// Reset Zero mocks
export const resetZeroMocks = () => {
  mockZero.mutate.mockClear();
  mockZero.query.mockClear();
  mockUseQuery.mockClear();
  mockUseZero.mockClear();
};
