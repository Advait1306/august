import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock IPC handlers
const mockIpcMainHandle = vi.fn();

vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcMainHandle,
  },
}));

// Mock @jupiter/shared/ipc
vi.mock("@jupiter/shared/ipc", () => ({
  IPC_CHANNELS: {
    AUTO_UPDATER: {
      CHECK: "auto-updater:check",
      QUIT_AND_INSTALL: "auto-updater:quit-and-install",
      GET_INFO: "auto-updater:get-info",
    },
  },
  IPC: {},
}));

// Mock the auto-updater service
const mockCheckForUpdates = vi.fn();
const mockQuitAndInstall = vi.fn();
const mockGetUpdateInfo = vi.fn();

vi.mock("../../services/auto-updater-service", () => ({
  autoUpdaterService: {
    checkForUpdates: mockCheckForUpdates,
    quitAndInstall: mockQuitAndInstall,
    getUpdateInfo: mockGetUpdateInfo,
  },
}));

describe("Auto Updater IPC Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerAutoUpdaterIpcHandlers", () => {
    it("should register handlers for all auto-updater channels", async () => {
      const { registerAutoUpdaterIpcHandlers } = await import(
        "../../ipc/auto-updater"
      );

      registerAutoUpdaterIpcHandlers();

      expect(mockIpcMainHandle).toHaveBeenCalledTimes(3);

      const registeredChannels = mockIpcMainHandle.mock.calls.map(
        (call: unknown[]) => call[0]
      );
      expect(registeredChannels).toContain("auto-updater:check");
      expect(registeredChannels).toContain("auto-updater:quit-and-install");
      expect(registeredChannels).toContain("auto-updater:get-info");
    });
  });

  describe("CHECK handler", () => {
    it("should return success when check succeeds", async () => {
      const { registerAutoUpdaterIpcHandlers } = await import(
        "../../ipc/auto-updater"
      );

      registerAutoUpdaterIpcHandlers();

      mockCheckForUpdates.mockResolvedValueOnce(undefined);

      const checkCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "auto-updater:check"
      );
      const handler = checkCall?.[1] as () => Promise<{ success: boolean; error?: string }>;

      const result = await handler();

      expect(mockCheckForUpdates).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("should return error when check fails", async () => {
      const { registerAutoUpdaterIpcHandlers } = await import(
        "../../ipc/auto-updater"
      );

      registerAutoUpdaterIpcHandlers();

      mockCheckForUpdates.mockRejectedValueOnce(new Error("Network error"));

      const checkCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "auto-updater:check"
      );
      const handler = checkCall?.[1] as () => Promise<{ success: boolean; error?: string }>;

      const result = await handler();

      expect(result).toEqual({ success: false, error: "Network error" });
    });

    it("should handle non-Error objects", async () => {
      const { registerAutoUpdaterIpcHandlers } = await import(
        "../../ipc/auto-updater"
      );

      registerAutoUpdaterIpcHandlers();

      mockCheckForUpdates.mockRejectedValueOnce("String error");

      const checkCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "auto-updater:check"
      );
      const handler = checkCall?.[1] as () => Promise<{ success: boolean; error?: string }>;

      const result = await handler();

      expect(result).toEqual({ success: false, error: "String error" });
    });
  });

  describe("QUIT_AND_INSTALL handler", () => {
    it("should return success when quit and install succeeds", async () => {
      const { registerAutoUpdaterIpcHandlers } = await import(
        "../../ipc/auto-updater"
      );

      registerAutoUpdaterIpcHandlers();

      mockQuitAndInstall.mockResolvedValueOnce(undefined);

      const quitCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "auto-updater:quit-and-install"
      );
      const handler = quitCall?.[1] as () => Promise<{ success: boolean; error?: string }>;

      const result = await handler();

      expect(mockQuitAndInstall).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("should return error when quit and install fails", async () => {
      const { registerAutoUpdaterIpcHandlers } = await import(
        "../../ipc/auto-updater"
      );

      registerAutoUpdaterIpcHandlers();

      mockQuitAndInstall.mockRejectedValueOnce(new Error("Installation failed"));

      const quitCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "auto-updater:quit-and-install"
      );
      const handler = quitCall?.[1] as () => Promise<{ success: boolean; error?: string }>;

      const result = await handler();

      expect(result).toEqual({ success: false, error: "Installation failed" });
    });
  });

  describe("GET_INFO handler", () => {
    it("should return update info when available", async () => {
      const { registerAutoUpdaterIpcHandlers } = await import(
        "../../ipc/auto-updater"
      );

      registerAutoUpdaterIpcHandlers();

      const mockUpdateInfo = {
        version: "1.2.0",
        releaseDate: "2024-01-15",
        releaseName: "New Release",
      };
      mockGetUpdateInfo.mockResolvedValueOnce(mockUpdateInfo);

      const getInfoCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "auto-updater:get-info"
      );
      const handler = getInfoCall?.[1] as () => Promise<{ success: boolean; data?: unknown; error?: string }>;

      const result = await handler();

      expect(mockGetUpdateInfo).toHaveBeenCalled();
      expect(result).toEqual({ success: true, data: mockUpdateInfo });
    });

    it("should return null when no update available", async () => {
      const { registerAutoUpdaterIpcHandlers } = await import(
        "../../ipc/auto-updater"
      );

      registerAutoUpdaterIpcHandlers();

      mockGetUpdateInfo.mockResolvedValueOnce(null);

      const getInfoCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "auto-updater:get-info"
      );
      const handler = getInfoCall?.[1] as () => Promise<{ success: boolean; data?: unknown; error?: string }>;

      const result = await handler();

      expect(result).toEqual({ success: true, data: null });
    });

    it("should return error when get info fails", async () => {
      const { registerAutoUpdaterIpcHandlers } = await import(
        "../../ipc/auto-updater"
      );

      registerAutoUpdaterIpcHandlers();

      mockGetUpdateInfo.mockRejectedValueOnce(new Error("Failed to get info"));

      const getInfoCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "auto-updater:get-info"
      );
      const handler = getInfoCall?.[1] as () => Promise<{ success: boolean; data?: unknown; error?: string }>;

      const result = await handler();

      expect(result).toEqual({ success: false, error: "Failed to get info" });
    });
  });
});
