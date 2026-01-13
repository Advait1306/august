import { create } from 'zustand'
import type { DockviewApi } from 'dockview-react'

interface ActiveWorkspaceApiStore {
  api: DockviewApi | null
  workspaceCwd: string | null
  setApi: (api: DockviewApi | null, workspaceCwd: string | null) => void
}

/**
 * Store to hold a reference to the active workspace's Dockview API.
 * This allows global components (like FileOpener) to add panels to the active workspace.
 */
export const useActiveWorkspaceApiStore = create<ActiveWorkspaceApiStore>((set) => ({
  api: null,
  workspaceCwd: null,
  setApi: (api, workspaceCwd) => set({ api, workspaceCwd }),
}))
