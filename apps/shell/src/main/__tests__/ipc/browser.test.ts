import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock IPC handlers
const mockIpcMainHandle = vi.fn()
const mockShellOpenExternal = vi.fn()

vi.mock('electron', () => ({
  ipcMain: {
    handle: mockIpcMainHandle
  },
  shell: {
    openExternal: mockShellOpenExternal
  }
}))

// Mock @jupiter/shared/ipc
vi.mock('@jupiter/shared/ipc', () => ({
  IPC_CHANNELS: {
    BROWSER: {
      OPEN_URL: 'browser:open-url'
    }
  }
}))

describe('Browser IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('registerBrowserIpcHandlers', () => {
    it('should register handler for OPEN_URL channel', async () => {
      const { registerBrowserIpcHandlers } = await import('../../ipc/browser')

      registerBrowserIpcHandlers()

      expect(mockIpcMainHandle).toHaveBeenCalledTimes(1)
      expect(mockIpcMainHandle).toHaveBeenCalledWith('browser:open-url', expect.any(Function))
    })

    it('should open URL in external browser', async () => {
      const { registerBrowserIpcHandlers } = await import('../../ipc/browser')

      registerBrowserIpcHandlers()

      // Get the handler function
      const handler = mockIpcMainHandle.mock.calls[0][1] as (
        event: unknown,
        url: string
      ) => Promise<boolean>

      const result = await handler({}, 'https://example.com')

      expect(mockShellOpenExternal).toHaveBeenCalledWith('https://example.com')
      expect(result).toBe(true)
    })

    it('should open various URL types', async () => {
      const { registerBrowserIpcHandlers } = await import('../../ipc/browser')

      registerBrowserIpcHandlers()

      const handler = mockIpcMainHandle.mock.calls[0][1] as (
        event: unknown,
        url: string
      ) => Promise<boolean>

      // Test with different URL types
      await handler({}, 'https://github.com/user/repo')
      expect(mockShellOpenExternal).toHaveBeenCalledWith('https://github.com/user/repo')

      await handler({}, 'mailto:test@example.com')
      expect(mockShellOpenExternal).toHaveBeenCalledWith('mailto:test@example.com')

      await handler({}, 'https://docs.august.tech')
      expect(mockShellOpenExternal).toHaveBeenCalledWith('https://docs.august.tech')
    })
  })
})
