import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock IPC channels
const mockIpcMainHandle = vi.fn();

vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcMainHandle,
  },
}));

// Mock @jupiter/shared/ipc
vi.mock("@jupiter/shared/ipc", () => ({
  IPC_CHANNELS: {
    SHELL_TOOLS: {
      GET_MANIFEST: "shell-tools:get-manifest",
      EXECUTE: "shell-tools:execute",
    },
  },
  IPC: {},
}));

// Mock @august/shell-tools
const mockGrep = vi.fn();
const mockGlob = vi.fn();
const mockLs = vi.fn();
const mockEdit = vi.fn();
const mockWrite = vi.fn();
const mockMultiedit = vi.fn();
const mockBash = vi.fn();
const mockShellToolsManifest = {
  tools: [
    { name: "grep", description: "Search file contents" },
    { name: "glob", description: "Pattern match files" },
    { name: "ls", description: "List directory contents" },
    { name: "edit", description: "Edit a file" },
    { name: "write", description: "Write a file" },
    { name: "multiedit", description: "Edit multiple files" },
    { name: "bash", description: "Execute bash command" },
  ],
};

vi.mock("@august/shell-tools", () => ({
  shellToolsManifest: mockShellToolsManifest,
  grep: mockGrep,
  glob: mockGlob,
  ls: mockLs,
  edit: mockEdit,
  write: mockWrite,
  multiedit: mockMultiedit,
  bash: mockBash,
}));

describe("Shell Tools IPC Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerShellToolsIpcHandlers", () => {
    it("should register handlers for GET_MANIFEST and EXECUTE channels", async () => {
      const { registerShellToolsIpcHandlers } = await import(
        "../../ipc/shell-tools"
      );

      registerShellToolsIpcHandlers();

      expect(mockIpcMainHandle).toHaveBeenCalledTimes(2);

      const registeredChannels = mockIpcMainHandle.mock.calls.map(
        (call: unknown[]) => call[0]
      );
      expect(registeredChannels).toContain("shell-tools:get-manifest");
      expect(registeredChannels).toContain("shell-tools:execute");
    });

    it("should return the shell tools manifest when GET_MANIFEST is called", async () => {
      const { registerShellToolsIpcHandlers } = await import(
        "../../ipc/shell-tools"
      );

      registerShellToolsIpcHandlers();

      // Find the GET_MANIFEST handler
      const getManifestCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "shell-tools:get-manifest"
      );
      const handler = getManifestCall?.[1] as () => unknown;

      const result = handler();

      expect(result).toEqual(mockShellToolsManifest);
    });

    it("should execute grep tool when EXECUTE is called with grep", async () => {
      const { registerShellToolsIpcHandlers } = await import(
        "../../ipc/shell-tools"
      );

      registerShellToolsIpcHandlers();

      // Find the EXECUTE handler
      const executeCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "shell-tools:execute"
      );
      const handler = executeCall?.[1] as (
        event: unknown,
        request: { name: string; input: unknown }
      ) => Promise<unknown>;

      const mockGrepResult = { matches: ["file1.ts", "file2.ts"] };
      mockGrep.mockResolvedValueOnce(mockGrepResult);

      const result = await handler({}, { name: "grep", input: { pattern: "test" } });

      expect(mockGrep).toHaveBeenCalledWith({ pattern: "test" });
      expect(result).toEqual(mockGrepResult);
    });

    it("should execute glob tool when EXECUTE is called with glob", async () => {
      const { registerShellToolsIpcHandlers } = await import(
        "../../ipc/shell-tools"
      );

      registerShellToolsIpcHandlers();

      const executeCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "shell-tools:execute"
      );
      const handler = executeCall?.[1] as (
        event: unknown,
        request: { name: string; input: unknown }
      ) => Promise<unknown>;

      const mockGlobResult = { files: ["src/*.ts"] };
      mockGlob.mockResolvedValueOnce(mockGlobResult);

      const result = await handler({}, { name: "glob", input: { pattern: "**/*.ts" } });

      expect(mockGlob).toHaveBeenCalledWith({ pattern: "**/*.ts" });
      expect(result).toEqual(mockGlobResult);
    });

    it("should execute ls tool when EXECUTE is called with ls", async () => {
      const { registerShellToolsIpcHandlers } = await import(
        "../../ipc/shell-tools"
      );

      registerShellToolsIpcHandlers();

      const executeCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "shell-tools:execute"
      );
      const handler = executeCall?.[1] as (
        event: unknown,
        request: { name: string; input: unknown }
      ) => Promise<unknown>;

      const mockLsResult = { entries: ["file1", "file2", "dir1"] };
      mockLs.mockResolvedValueOnce(mockLsResult);

      const result = await handler({}, { name: "ls", input: { path: "/some/path" } });

      expect(mockLs).toHaveBeenCalledWith({ path: "/some/path" });
      expect(result).toEqual(mockLsResult);
    });

    it("should execute edit tool when EXECUTE is called with edit", async () => {
      const { registerShellToolsIpcHandlers } = await import(
        "../../ipc/shell-tools"
      );

      registerShellToolsIpcHandlers();

      const executeCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "shell-tools:execute"
      );
      const handler = executeCall?.[1] as (
        event: unknown,
        request: { name: string; input: unknown }
      ) => Promise<unknown>;

      const mockEditResult = { success: true };
      mockEdit.mockResolvedValueOnce(mockEditResult);

      const editInput = { file: "test.ts", search: "old", replace: "new" };
      const result = await handler({}, { name: "edit", input: editInput });

      expect(mockEdit).toHaveBeenCalledWith(editInput);
      expect(result).toEqual(mockEditResult);
    });

    it("should execute write tool when EXECUTE is called with write", async () => {
      const { registerShellToolsIpcHandlers } = await import(
        "../../ipc/shell-tools"
      );

      registerShellToolsIpcHandlers();

      const executeCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "shell-tools:execute"
      );
      const handler = executeCall?.[1] as (
        event: unknown,
        request: { name: string; input: unknown }
      ) => Promise<unknown>;

      const mockWriteResult = { success: true };
      mockWrite.mockResolvedValueOnce(mockWriteResult);

      const writeInput = { file: "test.ts", content: "console.log('hello')" };
      const result = await handler({}, { name: "write", input: writeInput });

      expect(mockWrite).toHaveBeenCalledWith(writeInput);
      expect(result).toEqual(mockWriteResult);
    });

    it("should execute bash tool when EXECUTE is called with bash", async () => {
      const { registerShellToolsIpcHandlers } = await import(
        "../../ipc/shell-tools"
      );

      registerShellToolsIpcHandlers();

      const executeCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "shell-tools:execute"
      );
      const handler = executeCall?.[1] as (
        event: unknown,
        request: { name: string; input: unknown }
      ) => Promise<unknown>;

      const mockBashResult = { stdout: "hello", exitCode: 0 };
      mockBash.mockResolvedValueOnce(mockBashResult);

      const result = await handler({}, { name: "bash", input: { command: "echo hello" } });

      expect(mockBash).toHaveBeenCalledWith({ command: "echo hello" });
      expect(result).toEqual(mockBashResult);
    });

    it("should throw error for unknown tool name", async () => {
      const { registerShellToolsIpcHandlers } = await import(
        "../../ipc/shell-tools"
      );

      registerShellToolsIpcHandlers();

      const executeCall = mockIpcMainHandle.mock.calls.find(
        (call: unknown[]) => call[0] === "shell-tools:execute"
      );
      const handler = executeCall?.[1] as (
        event: unknown,
        request: { name: string; input: unknown }
      ) => Promise<unknown>;

      await expect(
        handler({}, { name: "unknown-tool", input: {} })
      ).rejects.toThrow("Unknown shell tool: unknown-tool");
    });
  });
});
