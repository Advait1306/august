import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { DockviewApi } from 'dockview-react'
import type { Workspace } from '@/src/types/workspace'

const STORAGE_KEY = 'august-workspaces'
const WORKSPACE_HOLDER_STORAGE_PREFIX = 'august-workspace-holder-workspace-'

interface WorkspaceStore {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  workspaceApis: Map<string, DockviewApi>
  isInitialized: boolean
  isAddDialogOpen: boolean
  openDiffPanels: Set<string> // Set of workspace IDs with diff panel open

  // Actions
  initializeDefaultWorkspace: (homeDir: string) => void
  createWorkspace: (name: string, cwd: string) => Workspace
  deleteWorkspace: (id: string) => void
  updateWorkspace: (id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>) => void
  setActiveWorkspace: (id: string) => void
  registerWorkspaceApi: (id: string, api: DockviewApi) => void
  unregisterWorkspaceApi: (id: string) => void
  getActiveWorkspace: () => Workspace | undefined
  getActiveWorkspaceApi: () => DockviewApi | null
  setAddDialogOpen: (open: boolean) => void

  // Navigation helpers for keyboard shortcuts
  selectWorkspaceAtIndex: (index: number) => void
  selectNextWorkspace: () => void
  selectPreviousWorkspace: () => void

  // Git diff panel actions
  openDiffPanel: (workspaceId: string) => void
  closeDiffPanel: (workspaceId: string) => void
  toggleDiffPanel: (workspaceId: string) => void
  isDiffPanelOpen: (workspaceId: string) => boolean
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      workspaces: [],
      activeWorkspaceId: null,
      workspaceApis: new Map(),
      isInitialized: false,
      isAddDialogOpen: false,
      openDiffPanels: new Set(),

      initializeDefaultWorkspace: (homeDir: string) => {
        const { workspaces, isInitialized } = get()

        // Only initialize if no workspaces exist and not already initialized
        if (workspaces.length === 0 && !isInitialized) {
          const defaultWorkspace: Workspace = {
            id: 'default',
            name: 'Home',
            cwd: homeDir,
            createdAt: Date.now(),
          }
          set({
            workspaces: [defaultWorkspace],
            activeWorkspaceId: 'default',
            isInitialized: true,
          })
        } else if (!isInitialized) {
          set({ isInitialized: true })
        }
      },

      createWorkspace: (name: string, cwd: string) => {
        const workspace: Workspace = {
          id: nanoid(),
          name,
          cwd,
          createdAt: Date.now(),
        }
        set((state) => ({
          workspaces: [...state.workspaces, workspace],
          activeWorkspaceId: workspace.id,
        }))
        return workspace
      },

      deleteWorkspace: (id: string) => {
        const { workspaces, activeWorkspaceId } = get()

        // Prevent deleting the last workspace
        if (workspaces.length <= 1) {
          return
        }

        const newWorkspaces = workspaces.filter((w) => w.id !== id)

        // Clean up localStorage layout data for deleted workspace
        try {
          localStorage.removeItem(`${WORKSPACE_HOLDER_STORAGE_PREFIX}${id}`)
        } catch (error) {
          console.error('Failed to clean up workspace layout data:', error)
        }

        set({
          workspaces: newWorkspaces,
          activeWorkspaceId:
            activeWorkspaceId === id ? newWorkspaces[0].id : activeWorkspaceId,
        })
      },

      updateWorkspace: (id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? { ...w, ...updates } : w
          ),
        }))
      },

      setActiveWorkspace: (id: string) => {
        const { workspaces } = get()
        if (workspaces.some((w) => w.id === id)) {
          set({ activeWorkspaceId: id })
        }
      },

      registerWorkspaceApi: (id: string, api: DockviewApi) => {
        const { workspaceApis } = get()
        const newApis = new Map(workspaceApis)
        newApis.set(id, api)
        set({ workspaceApis: newApis })
      },

      unregisterWorkspaceApi: (id: string) => {
        const { workspaceApis } = get()
        const newApis = new Map(workspaceApis)
        newApis.delete(id)
        set({ workspaceApis: newApis })
      },

      getActiveWorkspace: () => {
        const { workspaces, activeWorkspaceId } = get()
        return workspaces.find((w) => w.id === activeWorkspaceId)
      },

      getActiveWorkspaceApi: () => {
        const { workspaceApis, activeWorkspaceId } = get()
        if (!activeWorkspaceId) return null
        return workspaceApis.get(activeWorkspaceId) ?? null
      },

      setAddDialogOpen: (open: boolean) => {
        set({ isAddDialogOpen: open })
      },

      selectWorkspaceAtIndex: (index: number) => {
        const { workspaces } = get()
        if (index >= 0 && index < workspaces.length) {
          set({ activeWorkspaceId: workspaces[index].id })
        }
      },

      selectNextWorkspace: () => {
        const { workspaces, activeWorkspaceId } = get()
        const currentIndex = workspaces.findIndex((w) => w.id === activeWorkspaceId)
        const nextIndex = (currentIndex + 1) % workspaces.length
        set({ activeWorkspaceId: workspaces[nextIndex].id })
      },

      selectPreviousWorkspace: () => {
        const { workspaces, activeWorkspaceId } = get()
        const currentIndex = workspaces.findIndex((w) => w.id === activeWorkspaceId)
        const prevIndex = currentIndex <= 0 ? workspaces.length - 1 : currentIndex - 1
        set({ activeWorkspaceId: workspaces[prevIndex].id })
      },

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
      name: STORAGE_KEY,
      partialize: (state) => ({
        workspaces: state.workspaces,
        activeWorkspaceId: state.activeWorkspaceId,
        openDiffPanels: state.openDiffPanels,
      }),
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
