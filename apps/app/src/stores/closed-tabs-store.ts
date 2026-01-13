import { create } from 'zustand'
import type { ClosedTabInfo } from '@/src/components/workspace-holder/types'

const MAX_CLOSED_TABS = 20

interface ClosedTabsStore {
  // Stack of closed tabs per workspace
  closedTabsByWorkspace: Map<string, ClosedTabInfo[]>

  // Actions
  pushClosedTab: (workspaceId: string, tabInfo: ClosedTabInfo) => void
  popClosedTab: (workspaceId: string) => ClosedTabInfo | undefined
  getClosedTabsCount: (workspaceId: string) => number
  clearClosedTabs: (workspaceId: string) => void
}

export const useClosedTabsStore = create<ClosedTabsStore>()((set, get) => ({
  closedTabsByWorkspace: new Map(),

  pushClosedTab: (workspaceId: string, tabInfo: ClosedTabInfo) => {
    set((state) => {
      const newMap = new Map(state.closedTabsByWorkspace)
      const stack = [...(newMap.get(workspaceId) ?? [])]

      stack.push(tabInfo)

      // Keep only the last MAX_CLOSED_TABS
      if (stack.length > MAX_CLOSED_TABS) {
        stack.shift()
      }

      newMap.set(workspaceId, stack)
      return { closedTabsByWorkspace: newMap }
    })
  },

  popClosedTab: (workspaceId: string) => {
    const { closedTabsByWorkspace } = get()
    const stack = closedTabsByWorkspace.get(workspaceId)

    if (!stack || stack.length === 0) {
      return undefined
    }

    const tabInfo = stack[stack.length - 1]

    set((state) => {
      const newMap = new Map(state.closedTabsByWorkspace)
      const newStack = [...(newMap.get(workspaceId) ?? [])]
      newStack.pop()
      newMap.set(workspaceId, newStack)
      return { closedTabsByWorkspace: newMap }
    })

    return tabInfo
  },

  getClosedTabsCount: (workspaceId: string) => {
    const { closedTabsByWorkspace } = get()
    return closedTabsByWorkspace.get(workspaceId)?.length ?? 0
  },

  clearClosedTabs: (workspaceId: string) => {
    set((state) => {
      const newMap = new Map(state.closedTabsByWorkspace)
      newMap.delete(workspaceId)
      return { closedTabsByWorkspace: newMap }
    })
  },
}))
