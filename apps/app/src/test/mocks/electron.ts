import { vi } from "vitest";

// Types matching packages/shared/src/types/window.ts
interface MockElectronAPI {
  ipcRenderer: {
    on: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    invoke: ReturnType<typeof vi.fn>;
    removeAllListeners: ReturnType<typeof vi.fn>;
  };
}

interface MockWindowAPI {
  projects: {
    selectFolder: ReturnType<typeof vi.fn>;
    getDefaultCwd: ReturnType<typeof vi.fn>;
  };
  auth: {
    getToken: ReturnType<typeof vi.fn>;
    openLogin: ReturnType<typeof vi.fn>;
    onTokenReceived: ReturnType<typeof vi.fn>;
  };
  autoUpdater: {
    checkForUpdates: ReturnType<typeof vi.fn>;
    quitAndInstall: ReturnType<typeof vi.fn>;
    getUpdateInfo: ReturnType<typeof vi.fn>;
  };
  browser: {
    openUrl: ReturnType<typeof vi.fn>;
  };
  shellTools: {
    getManifest: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
  };
}

// Store event handlers for IPC simulation
const ipcHandlers = new Map<string, Set<Function>>();

// Create factory functions for fresh mocks
export const createElectronMock = (): MockElectronAPI => ({
  ipcRenderer: {
    on: vi.fn((channel: string, callback: Function) => {
      if (!ipcHandlers.has(channel)) {
        ipcHandlers.set(channel, new Set());
      }
      ipcHandlers.get(channel)!.add(callback);
      // Return cleanup function
      return () => {
        ipcHandlers.get(channel)?.delete(callback);
      };
    }),
    send: vi.fn(),
    invoke: vi.fn(),
    removeAllListeners: vi.fn((channel: string) => {
      ipcHandlers.delete(channel);
    }),
  },
});

export const createApiMock = (): MockWindowAPI => ({
  projects: {
    selectFolder: vi
      .fn()
      .mockResolvedValue({ name: "test-project", path: "/test/path" }),
    getDefaultCwd: vi.fn().mockResolvedValue("/Users/test/projects"),
  },
  auth: {
    getToken: vi.fn().mockResolvedValue("mock-auth-token"),
    openLogin: vi.fn().mockResolvedValue(true),
    onTokenReceived: vi.fn((_callback: (token: string) => void) => {
      return () => {}; // Return cleanup function
    }),
  },
  autoUpdater: {
    checkForUpdates: vi.fn().mockResolvedValue({ success: true }),
    quitAndInstall: vi.fn().mockResolvedValue({ success: true }),
    getUpdateInfo: vi.fn().mockResolvedValue({
      success: true,
      data: { version: "1.0.1", releaseDate: "2024-01-01" },
    }),
  },
  browser: {
    openUrl: vi.fn().mockResolvedValue(true),
  },
  shellTools: {
    getManifest: vi.fn().mockResolvedValue({
      tools: [
        { name: "bash", version: "1.0.0" },
        { name: "grep", version: "1.0.0" },
        { name: "glob", version: "1.0.0" },
      ],
    }),
    execute: vi.fn().mockImplementation((name: string) => {
      // Return mock results based on tool name
      switch (name) {
        case "bash":
          return Promise.resolve({ stdout: "", stderr: "", exitCode: 0 });
        case "grep":
          return Promise.resolve({ matches: [] });
        case "glob":
          return Promise.resolve({ files: [] });
        default:
          return Promise.resolve({});
      }
    }),
  },
});

// Global electron mock instances
let electronMock: MockElectronAPI;
let apiMock: MockWindowAPI;

export const setupElectronMocks = () => {
  electronMock = createElectronMock();
  apiMock = createApiMock();

  // @ts-expect-error - Setting up mock on window
  window.electron = electronMock;
  // @ts-expect-error - Setting up mock on window
  window.api = apiMock;
};

export const getElectronMock = () => electronMock;
export const getApiMock = () => apiMock;

// Helper to simulate IPC events (useful for testing update-context)
export const simulateIpcEvent = (channel: string, ...args: unknown[]) => {
  const handlers = ipcHandlers.get(channel);
  if (handlers) {
    handlers.forEach((handler) => {
      handler({}, ...args);
    });
  }
};

// Reset mocks between tests
export const resetElectronMocks = () => {
  ipcHandlers.clear();
  vi.clearAllMocks();
  setupElectronMocks();
};
