import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface GitStore {
  // State - track which workspaces have diff panels open
  openDiffPanels: Set<string> // Set of workspace IDs

  // Actions
  openDiffPanel: (workspaceId: string) => void
  closeDiffPanel: (workspaceId: string) => void
  toggleDiffPanel: (workspaceId: string) => void
  isDiffPanelOpen: (workspaceId: string) => boolean
}

export const useGitStore = create<GitStore>()(
  persist(
    (set, get) => ({
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
    }),
    {
      name: 'august-git-store',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          const parsed = JSON.parse(str)
          return {
            ...parsed,
            state: {
              ...parsed.state,
              // Convert array back to Set
              openDiffPanels: new Set(parsed.state.openDiffPanels || []),
            },
          }
        },
        setItem: (name, value) => {
          const toStore = {
            ...value,
            state: {
              ...value.state,
              // Convert Set to array for JSON serialization
              openDiffPanels: Array.from(value.state.openDiffPanels || []),
            },
          }
          localStorage.setItem(name, JSON.stringify(toStore))
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
)
