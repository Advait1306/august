import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import type { DockviewApi } from 'dockview-react'
import { nanoid } from 'nanoid'
import type { ViewType, WorkspaceHolderContextValue, ClosedTabInfo } from './types'
import { getViewType } from './registry'

const WorkspaceHolderContext = createContext<WorkspaceHolderContextValue | null>(null)

interface WorkspaceHolderProviderProps {
  children: ReactNode
  api: DockviewApi | null
  workspaceCwd?: string
}

/**
 * Context provider for WorkspaceHolder API access
 */
export function WorkspaceHolderProvider({ children, api, workspaceCwd }: WorkspaceHolderProviderProps) {
  const addPanel = useCallback(
    (viewType: ViewType, params: Record<string, unknown> = {}) => {
      if (!api) return

      const viewTypeInfo = getViewType(viewType)
      if (!viewTypeInfo) {
        console.warn(`Unknown view type: ${viewType}`)
        return
      }

      const id = `${viewType}-${nanoid(8)}`

      // Merge workspace cwd into params based on view type
      const cwdParams: Record<string, unknown> = {}
      if (workspaceCwd) {
        if (viewType === 'terminal') {
          cwdParams.cwd = workspaceCwd
        } else if (viewType === 'file-viewer') {
          cwdParams.rootPath = workspaceCwd
        }
      }

      api.addPanel({
        id,
        component: viewType,
        title: viewTypeInfo.displayName,
        params: { ...viewTypeInfo.defaultParams, ...cwdParams, ...params },
      })
    },
    [api, workspaceCwd]
  )

  const closeActivePanel = useCallback((): ClosedTabInfo | null => {
    if (!api) return null

    const activePanel = api.activePanel
    if (!activePanel) return null

    // Extract info before closing
    const viewType = activePanel.api.component as ViewType
    const params = (activePanel.params ?? {}) as Record<string, unknown>
    const title = activePanel.api.title ?? ''

    activePanel.api.close()

    return { viewType, params, title }
  }, [api])

  const activatePanelAtIndex = useCallback(
    (index: number) => {
      if (!api) return

      const panels = api.panels
      if (index >= 0 && index < panels.length) {
        panels[index].api.setActive()
      }
    },
    [api]
  )

  const activateNextPanel = useCallback(() => {
    if (!api) return

    const panels = api.panels
    if (panels.length === 0) return

    const activePanel = api.activePanel
    const currentIndex = activePanel ? panels.indexOf(activePanel) : -1
    const nextIndex = (currentIndex + 1) % panels.length
    panels[nextIndex].api.setActive()
  }, [api])

  const activatePreviousPanel = useCallback(() => {
    if (!api) return

    const panels = api.panels
    if (panels.length === 0) return

    const activePanel = api.activePanel
    const currentIndex = activePanel ? panels.indexOf(activePanel) : 0
    const prevIndex = currentIndex <= 0 ? panels.length - 1 : currentIndex - 1
    panels[prevIndex].api.setActive()
  }, [api])

  const getPanelCount = useCallback(() => {
    return api?.panels.length ?? 0
  }, [api])

  const reopenTab = useCallback(
    (tabInfo: ClosedTabInfo) => {
      addPanel(tabInfo.viewType, tabInfo.params)
    },
    [addPanel]
  )

  const value = useMemo<WorkspaceHolderContextValue>(
    () => ({
      api,
      addPanel,
      closeActivePanel,
      activatePanelAtIndex,
      activateNextPanel,
      activatePreviousPanel,
      getPanelCount,
      reopenTab,
    }),
    [api, addPanel, closeActivePanel, activatePanelAtIndex, activateNextPanel, activatePreviousPanel, getPanelCount, reopenTab]
  )

  return (
    <WorkspaceHolderContext.Provider value={value}>
      {children}
    </WorkspaceHolderContext.Provider>
  )
}

/**
 * Hook to access WorkspaceHolder API
 */
export function useWorkspaceHolder(): WorkspaceHolderContextValue {
  const context = useContext(WorkspaceHolderContext)
  if (!context) {
    throw new Error('useWorkspaceHolder must be used within a WorkspaceHolderProvider')
  }
  return context
}
