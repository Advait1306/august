import { create } from 'zustand'

interface GitStore {
  // State - track which workspaces have diff panels open
  openDiffPanels: Set<string> // Set of workspace IDs

  // Actions
  openDiffPanel: (workspaceId: string) => void
  closeDiffPanel: (workspaceId: string) => void
  toggleDiffPanel: (workspaceId: string) => void
  isDiffPanelOpen: (workspaceId: string) => boolean
}

export const useGitStore = create<GitStore>()((set, get) => ({
  openDiffPanels: new Set(),

  openDiffPanel: (workspaceId: string) => {
    const { openDiffPanels } = get()
    const newSet = new Set(openDiffPanels)
    newSet.add(workspaceId)
    set({ openDiffPanels: newSet })
  },

  closeDiffPanel: (workspaceId: string) => {
    const { openDiffPanels } = get()
    const newSet = new Set(openDiffPanels)
    newSet.delete(workspaceId)
    set({ openDiffPanels: newSet })
  },

  toggleDiffPanel: (workspaceId: string) => {
    const { openDiffPanels } = get()
    const newSet = new Set(openDiffPanels)
    if (newSet.has(workspaceId)) {
      newSet.delete(workspaceId)
    } else {
      newSet.add(workspaceId)
    }
    set({ openDiffPanels: newSet })
  },

  isDiffPanelOpen: (workspaceId: string) => {
    return get().openDiffPanels.has(workspaceId)
  },
}))
