import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock IPC handlers
const mockIpcMainHandle = vi.fn();
const mockShowOpenDialog = vi.fn();

vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcMainHandle,
  },
  dialog: {
    showOpenDialog: mockShowOpenDialog,
  },
}));

// Mock @jupiter/shared/ipc
vi.mock("@jupiter/shared/ipc", () => ({
  IPC_CHANNELS: {
    PROJECTS: {
      SELECT_FOLDER: "projects:select-folder",
      GET_DEFAULT_CWD: "projects:get-default-cwd",
    },
  },
  IPC: {},
}));

// Mock node modules
const mockExistsSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock("node:fs", () => ({
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
}));

vi.mock("node:os", () => ({
  homedir: () => "/Users/testuser",
}));

describe("Projects IPC Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerProjectIpcHandlers", () => {
    it("should register handlers for SELECT_FOLDER and GET_DEFAULT_CWD channels", async () => {
      const { registerProjectIpcHandlers } = await import("../../ipc/projects");

      registerProjectIpcHandlers();

      expect(mockIpcMainHandle).toHaveBeenCalledTimes(2);

      const registeredChannels = mockIpcMainHandle.mock.calls.map(
        (call: unknown[]) => call[0]
      );
      expect(registeredChannels).toContain("projects:select-folder");
      expect(registeredChannels).toContain("projects:get-default-cwd");
    });
  });

  describe("SELECT_FOLDER handler", () => {
    it("should return null when dialog is canceled", async () => {
      const { registerProjectIpcHandlers } = await import("../../ipc/projects");

      registerProjectIpcHandlers();

      mockShowOpenDialog.mockResolvedValueOnce({
        canceled: true,
        filePaths: [],
      });

      // Find the SELECT_FOLDER handler
      const selectFolderCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "projects:select-folder"
      );
      const handler = selectFolderCall?.[1] as () => Promise<unknown>;

      const result = await handler();

      expect(result).toBeNull();
    });

    it("should return null when no folder is selected", async () => {
      const { registerProjectIpcHandlers } = await import("../../ipc/projects");

      registerProjectIpcHandlers();

      mockShowOpenDialog.mockResolvedValueOnce({
        canceled: false,
        filePaths: [],
      });

      const selectFolderCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "projects:select-folder"
      );
      const handler = selectFolderCall?.[1] as () => Promise<unknown>;

      const result = await handler();

      expect(result).toBeNull();
    });

    it("should return project info when folder is selected", async () => {
      const { registerProjectIpcHandlers } = await import("../../ipc/projects");

      registerProjectIpcHandlers();

      mockShowOpenDialog.mockResolvedValueOnce({
        canceled: false,
        filePaths: ["/Users/test/my-project"],
      });

      const selectFolderCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "projects:select-folder"
      );
      const handler = selectFolderCall?.[1] as () => Promise<unknown>;

      const result = await handler();

      expect(result).toEqual({
        name: "my-project",
        path: "/Users/test/my-project",
      });
    });

    it("should use 'Unnamed Project' when folder has no name", async () => {
      const { registerProjectIpcHandlers } = await import("../../ipc/projects");

      registerProjectIpcHandlers();

      mockShowOpenDialog.mockResolvedValueOnce({
        canceled: false,
        filePaths: ["/"],
      });

      const selectFolderCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "projects:select-folder"
      );
      const handler = selectFolderCall?.[1] as () => Promise<unknown>;

      const result = await handler();

      expect(result).toEqual({
        name: "Unnamed Project",
        path: "/",
      });
    });

    it("should open dialog with correct options", async () => {
      const { registerProjectIpcHandlers } = await import("../../ipc/projects");

      registerProjectIpcHandlers();

      mockShowOpenDialog.mockResolvedValueOnce({
        canceled: true,
        filePaths: [],
      });

      const selectFolderCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "projects:select-folder"
      );
      const handler = selectFolderCall?.[1] as () => Promise<unknown>;

      await handler();

      expect(mockShowOpenDialog).toHaveBeenCalledWith({
        properties: ["openDirectory"],
        title: "Select Project Folder",
      });
    });
  });

  describe("GET_DEFAULT_CWD handler", () => {
    it("should return default path when directory exists", async () => {
      const { registerProjectIpcHandlers } = await import("../../ipc/projects");

      registerProjectIpcHandlers();

      mockExistsSync.mockReturnValueOnce(true);

      const getDefaultCwdCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "projects:get-default-cwd"
      );
      const handler = getDefaultCwdCall?.[1] as () => Promise<string>;

      const result = await handler();

      expect(result).toBe("/Users/testuser/Documents/August");
      expect(mockMkdirSync).not.toHaveBeenCalled();
    });

    it("should create directory when it does not exist", async () => {
      const { registerProjectIpcHandlers } = await import("../../ipc/projects");

      registerProjectIpcHandlers();

      mockExistsSync.mockReturnValueOnce(false);

      const getDefaultCwdCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "projects:get-default-cwd"
      );
      const handler = getDefaultCwdCall?.[1] as () => Promise<string>;

      const result = await handler();

      expect(result).toBe("/Users/testuser/Documents/August");
      expect(mockMkdirSync).toHaveBeenCalledWith(
        "/Users/testuser/Documents/August",
        { recursive: true }
      );
    });

    it("should fallback to home directory when mkdir fails", async () => {
      const { registerProjectIpcHandlers } = await import("../../ipc/projects");

      registerProjectIpcHandlers();

      mockExistsSync.mockReturnValueOnce(false);
      mockMkdirSync.mockImplementationOnce(() => {
        throw new Error("Permission denied");
      });

      // Suppress expected console.error from the fallback code path
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const getDefaultCwdCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "projects:get-default-cwd"
      );
      const handler = getDefaultCwdCall?.[1] as () => Promise<string>;

      const result = await handler();

      expect(result).toBe("/Users/testuser");
      consoleErrorSpy.mockRestore();
    });
  });
});
