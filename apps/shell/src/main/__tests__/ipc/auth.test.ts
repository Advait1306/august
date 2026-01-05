import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock IPC handlers
const mockIpcMainHandle = vi.fn();
const mockShellOpenExternal = vi.fn();

vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcMainHandle,
  },
  BrowserWindow: vi.fn(),
  shell: {
    openExternal: mockShellOpenExternal,
  },
}));

// Mock @jupiter/shared/ipc
vi.mock("@jupiter/shared/ipc", () => ({
  IPC_CHANNELS: {
    AUTH: {
      OPEN_LOGIN: "auth:open-login",
      TICKET_RECEIVED: "auth:ticket-received",
    },
  },
  IPC: {},
}));

describe("Auth IPC Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerAuthIpcHandlers", () => {
    it("should register handler for OPEN_LOGIN channel", async () => {
      const { registerAuthIpcHandlers } = await import("../../ipc/auth");

      registerAuthIpcHandlers();

      expect(mockIpcMainHandle).toHaveBeenCalledTimes(1);
      expect(mockIpcMainHandle).toHaveBeenCalledWith(
        "auth:open-login",
        expect.any(Function)
      );
    });

    it("should open external login URL when OPEN_LOGIN is called", async () => {
      const { registerAuthIpcHandlers } = await import("../../ipc/auth");

      registerAuthIpcHandlers();

      // Get the handler function
      const handler = mockIpcMainHandle.mock.calls[0][1] as () => Promise<boolean>;

      const result = await handler();

      expect(mockShellOpenExternal).toHaveBeenCalledWith(
        "https://app.august.tech/authorise"
      );
      expect(result).toBe(true);
    });
  });

  describe("setMainWindow", () => {
    it("should store the main window reference", async () => {
      const { setMainWindow } = await import("../../ipc/auth");

      const mockWindow = {
        isDestroyed: vi.fn(() => false),
        webContents: {
          send: vi.fn(),
        },
      };

      // Should not throw
      setMainWindow(mockWindow as unknown as Electron.BrowserWindow);
    });
  });

  describe("handleAuthToken", () => {
    it("should send token to renderer when window is available", async () => {
      const { setMainWindow, handleAuthToken } = await import("../../ipc/auth");

      const mockSend = vi.fn();
      const mockWindow = {
        isDestroyed: vi.fn(() => false),
        webContents: {
          send: mockSend,
        },
      };

      setMainWindow(mockWindow as unknown as Electron.BrowserWindow);

      const token = { ticket: "test-token-123" };
      handleAuthToken(token);

      expect(mockSend).toHaveBeenCalledWith("auth:ticket-received", token);
    });

    it("should not send token when window is destroyed", async () => {
      const { setMainWindow, handleAuthToken } = await import("../../ipc/auth");

      const mockSend = vi.fn();
      const mockWindow = {
        isDestroyed: vi.fn(() => true),
        webContents: {
          send: mockSend,
        },
      };

      setMainWindow(mockWindow as unknown as Electron.BrowserWindow);

      const token = { ticket: "test-token-123" };
      handleAuthToken(token);

      expect(mockSend).not.toHaveBeenCalled();
    });

    it("should not throw when no window is set", async () => {
      // Reset module to clear window reference
      vi.resetModules();

      const { handleAuthToken } = await import("../../ipc/auth");

      const token = { ticket: "test-token-123" };

      // Should not throw
      expect(() => handleAuthToken(token)).not.toThrow();
    });
  });
});
