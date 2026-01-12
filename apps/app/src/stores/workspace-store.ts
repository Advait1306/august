import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { Workspace } from '@/src/types/workspace'

const STORAGE_KEY = 'august-workspaces'
const VIEW_HOLDER_STORAGE_PREFIX = 'august-view-holder-workspace-'

interface WorkspaceStore {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  isInitialized: boolean

  // Actions
  initializeDefaultWorkspace: (homeDir: string) => void
  createWorkspace: (name: string, cwd: string) => Workspace
  deleteWorkspace: (id: string) => void
  updateWorkspace: (id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>) => void
  setActiveWorkspace: (id: string) => void
  getActiveWorkspace: () => Workspace | undefined
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      workspaces: [],
      activeWorkspaceId: null,
      isInitialized: false,

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
          localStorage.removeItem(`${VIEW_HOLDER_STORAGE_PREFIX}${id}`)
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

      getActiveWorkspace: () => {
        const { workspaces, activeWorkspaceId } = get()
        return workspaces.find((w) => w.id === activeWorkspaceId)
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        workspaces: state.workspaces,
        activeWorkspaceId: state.activeWorkspaceId,
      }),
    }
  )
)
