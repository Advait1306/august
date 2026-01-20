import { create } from 'zustand'
import { IPC } from '@jupiter/shared/ipc'

interface GitStore {
  // State
  isDiffPanelOpen: boolean
  diffWorkspaceCwd: string | null
  gitStatus: IPC.Git.StatusResponse | null
  isLoadingStatus: boolean

  // Actions
  openDiffPanel: (workspaceCwd: string) => void
  closeDiffPanel: () => void
  toggleDiffPanel: (workspaceCwd: string) => void
  setGitStatus: (status: IPC.Git.StatusResponse | null) => void
  setIsLoadingStatus: (isLoading: boolean) => void
}

export const useGitStore = create<GitStore>()((set, get) => ({
  isDiffPanelOpen: false,
  diffWorkspaceCwd: null,
  gitStatus: null,
  isLoadingStatus: false,

  openDiffPanel: (workspaceCwd: string) => {
    set({
      isDiffPanelOpen: true,
      diffWorkspaceCwd: workspaceCwd,
    })
  },

  closeDiffPanel: () => {
    set({
      isDiffPanelOpen: false,
      gitStatus: null,
    })
  },

  toggleDiffPanel: (workspaceCwd: string) => {
    const { isDiffPanelOpen, diffWorkspaceCwd } = get()

    // If panel is open for the same workspace, close it
    if (isDiffPanelOpen && diffWorkspaceCwd === workspaceCwd) {
      set({
        isDiffPanelOpen: false,
        gitStatus: null,
      })
    } else {
      // Open panel for this workspace
      set({
        isDiffPanelOpen: true,
        diffWorkspaceCwd: workspaceCwd,
        gitStatus: null,
      })
    }
  },

  setGitStatus: (status: IPC.Git.StatusResponse | null) => {
    set({ gitStatus: status })
  },

  setIsLoadingStatus: (isLoading: boolean) => {
    set({ isLoadingStatus: isLoading })
  },
}))
