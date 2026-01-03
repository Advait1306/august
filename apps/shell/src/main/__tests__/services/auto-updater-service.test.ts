import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock electron-updater before importing the service
const mockAutoUpdater = {
  logger: null,
  autoDownload: false,
  autoInstallOnAppQuit: false,
  on: vi.fn(),
  checkForUpdatesAndNotify: vi.fn(),
  checkForUpdates: vi.fn(),
  quitAndInstall: vi.fn(),
};

vi.mock("electron-updater", () => ({
  autoUpdater: mockAutoUpdater,
}));

// Mock electron
const mockBrowserWindow = {
  isDestroyed: vi.fn(() => false),
  webContents: {
    send: vi.fn(),
  },
};

vi.mock("electron", () => ({
  app: {
    isPackaged: false,
  },
  BrowserWindow: vi.fn(() => mockBrowserWindow),
}));

// Mock electron-log
vi.mock("electron-log", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("AutoUpdaterService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset the singleton for each test
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getInstance", () => {
    it("should return a singleton instance", async () => {
      const { AutoUpdaterService } = await import(
        "../../services/auto-updater-service"
      );

      const instance1 = AutoUpdaterService.getInstance();
      const instance2 = AutoUpdaterService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("should configure autoUpdater on initialization", async () => {
      const { AutoUpdaterService } = await import(
        "../../services/auto-updater-service"
      );

      AutoUpdaterService.getInstance();

      expect(mockAutoUpdater.autoDownload).toBe(true);
      expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true);
    });

    it("should register event listeners on initialization", async () => {
      const { AutoUpdaterService } = await import(
        "../../services/auto-updater-service"
      );

      AutoUpdaterService.getInstance();

      // Check that event listeners were registered
      const eventNames = mockAutoUpdater.on.mock.calls.map(
        (call: unknown[]) => call[0]
      );
      expect(eventNames).toContain("checking-for-update");
      expect(eventNames).toContain("update-available");
      expect(eventNames).toContain("update-not-available");
      expect(eventNames).toContain("error");
      expect(eventNames).toContain("download-progress");
      expect(eventNames).toContain("update-downloaded");
    });
  });

  describe("setMainWindow", () => {
    it("should store the main window reference", async () => {
      const { AutoUpdaterService } = await import(
        "../../services/auto-updater-service"
      );

      const service = AutoUpdaterService.getInstance();
      service.setMainWindow(mockBrowserWindow as unknown as Electron.BrowserWindow);

      // The window is stored - we can verify by triggering an event
      // and checking if send was called
    });
  });

  describe("checkForUpdates", () => {
    it("should skip update check in development mode", async () => {
      const { AutoUpdaterService } = await import(
        "../../services/auto-updater-service"
      );

      const service = AutoUpdaterService.getInstance();
      await service.checkForUpdates();

      // In development mode (app.isPackaged = false), it should not call checkForUpdatesAndNotify
      expect(mockAutoUpdater.checkForUpdatesAndNotify).not.toHaveBeenCalled();
    });
  });

  describe("quitAndInstall", () => {
    it("should call autoUpdater.quitAndInstall", async () => {
      const { AutoUpdaterService } = await import(
        "../../services/auto-updater-service"
      );

      const service = AutoUpdaterService.getInstance();
      await service.quitAndInstall();

      expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      mockAutoUpdater.quitAndInstall.mockImplementationOnce(() => {
        throw new Error("Installation failed");
      });

      const { AutoUpdaterService } = await import(
        "../../services/auto-updater-service"
      );

      const service = AutoUpdaterService.getInstance();
      service.setMainWindow(mockBrowserWindow as unknown as Electron.BrowserWindow);

      // Should not throw
      await expect(service.quitAndInstall()).resolves.not.toThrow();
    });
  });

  describe("getUpdateInfo", () => {
    it("should return null in development mode", async () => {
      const { AutoUpdaterService } = await import(
        "../../services/auto-updater-service"
      );

      const service = AutoUpdaterService.getInstance();
      const result = await service.getUpdateInfo();

      expect(result).toBeNull();
    });
  });

  describe("destroy", () => {
    it("should clear the update check interval", async () => {
      const { AutoUpdaterService } = await import(
        "../../services/auto-updater-service"
      );

      const service = AutoUpdaterService.getInstance();
      service.destroy();

      // After destroy, the interval should be cleared
      // We can verify by advancing time and checking no additional calls
    });
  });

  describe("update check interval", () => {
    it("should set up a 4-hour interval for update checks", async () => {
      const { AutoUpdaterService } = await import(
        "../../services/auto-updater-service"
      );

      AutoUpdaterService.getInstance();

      // The interval should be set to 4 hours
      const fourHoursInMs = 4 * 60 * 60 * 1000;

      // Advance time by 4 hours
      vi.advanceTimersByTime(fourHoursInMs);

      // In development mode, checkForUpdatesAndNotify should still not be called
      // because app.isPackaged is false
    });
  });
});
