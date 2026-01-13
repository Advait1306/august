import { useState, useCallback, useEffect, useRef } from 'react'
import {
  DockviewReact,
  type DockviewReadyEvent,
  type DockviewApi,
  type IDockviewHeaderActionsProps,
} from 'dockview-react'
import { Plus, TerminalSquare, FolderOpen } from 'lucide-react'
import { nanoid } from 'nanoid'
import { cn } from '@/lib/utils'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { useTheme } from '@/src/components/theme'
import { WorkspaceHolderProvider } from './WorkspaceHolderProvider'
import { TerminalPanel } from './panels/TerminalPanel'
import { FileViewerPanel } from './panels/FileViewerPanel'
import { ThemedTab } from './ThemedTab'
import type { WorkspaceHolderProps, ViewType } from './types'
import { useWorkspaceStore } from '@/src/stores/workspace-store'
import { useClosedTabsStore } from '@/src/stores/closed-tabs-store'

import 'dockview-react/dist/styles/dockview.css'
import './workspace-holder.css'

const STORAGE_KEY_PREFIX = 'august-workspace-holder-'

/**
 * Panel components registered with Dockview
 */
const components = {
  terminal: TerminalPanel,
  'file-viewer': FileViewerPanel,
}

/**
 * Custom tab components for proper theming
 */
const tabComponents = {
  default: ThemedTab,
}

/**
 * Props for RightHeaderActions including workspace context
 */
interface RightHeaderActionsProps extends IDockviewHeaderActionsProps {
  workspaceCwd?: string
}

/**
 * Add new panel button with dropdown menu
 */
function RightHeaderActions({ containerApi, workspaceCwd }: RightHeaderActionsProps) {
  const [open, setOpen] = useState(false)

  const handleAddTerminal = () => {
    containerApi.addPanel({
      id: `terminal-${nanoid(8)}`,
      component: 'terminal',
      title: 'Terminal',
      params: { cwd: workspaceCwd },
    })
    setOpen(false)
  }

  const handleAddFileViewer = () => {
    containerApi.addPanel({
      id: `file-viewer-${nanoid(8)}`,
      component: 'file-viewer',
      title: 'File Viewer',
      params: { rootPath: workspaceCwd },
    })
    setOpen(false)
  }

  return (
    <div className="flex h-full items-center pr-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--dv-icon-hover-background-color)] transition-colors"
            title="Add Panel"
          >
            <Plus className="h-4 w-4" />
          </button>
        </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1">
        <button
          onClick={handleAddTerminal}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-700/50 transition-colors"
        >
          <TerminalSquare className="h-4 w-4 text-gray-400" />
          <span>Terminal</span>
          <span className="ml-auto text-xs text-gray-500">⌘T</span>
        </button>
        <button
          onClick={handleAddFileViewer}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-700/50 transition-colors"
        >
          <FolderOpen className="h-4 w-4 text-gray-400" />
          <span>File Viewer</span>
          <span className="ml-auto text-xs text-gray-500">⌘E</span>
        </button>
      </PopoverContent>
    </Popover>
    </div>
  )
}

/**
 * WorkspaceHolder component - A flexible tiling window manager for views
 *
 * Supports drag-and-drop rearrangement, resizable panes, tabbed groups,
 * and persistent layouts via localStorage.
 */
/**
 * Validates that a parsed layout object has the expected structure for Dockview
 */
function isValidLayout(layout: unknown): boolean {
  return (
    layout !== null &&
    typeof layout === 'object' &&
    'grid' in layout &&
    typeof (layout as Record<string, unknown>).grid === 'object'
  )
}

export function WorkspaceHolder({
  storageKey = 'default',
  className,
  onReady,
  workspaceCwd,
  isActive = true,
}: WorkspaceHolderProps) {
  const [api, setApi] = useState<DockviewApi | null>(null)
  const layoutChangeDisposableRef = useRef<{ dispose: () => void } | null>(null)
  const fullStorageKey = `${STORAGE_KEY_PREFIX}${storageKey}`
  const theme = useTheme()
  const dockviewThemeClass = theme === 'dark' ? 'dockview-theme-dark' : 'dockview-theme-light'

  // Cleanup layout change subscription on unmount
  useEffect(() => {
    return () => {
      layoutChangeDisposableRef.current?.dispose()
    }
  }, [])

  // Get workspace and closed tabs stores for keyboard shortcuts
  const {
    activeWorkspaceId,
    setAddDialogOpen,
    selectWorkspaceAtIndex,
    selectNextWorkspace,
    selectPreviousWorkspace,
  } = useWorkspaceStore()
  const { pushClosedTab, popClosedTab } = useClosedTabsStore()

  // Keyboard shortcuts for tab and workspace navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey
      const isCtrl = e.ctrlKey
      const isShift = e.shiftKey
      const isAlt = e.altKey

      // === WORKSPACE SHORTCUTS (global, not tied to active workspace) ===

      // Cmd+N: Open new workspace dialog
      if (isMeta && !isShift && !isAlt && e.key === 'n') {
        e.preventDefault()
        setAddDialogOpen(true)
        return
      }

      // Cmd+Option+1-9: Jump to workspace 1-9
      // Use e.code for number keys since Option can modify e.key on macOS
      if (isMeta && isAlt && !isShift && e.code >= 'Digit1' && e.code <= 'Digit9') {
        e.preventDefault()
        const index = parseInt(e.code.replace('Digit', ''), 10) - 1
        selectWorkspaceAtIndex(index)
        return
      }

      // Cmd+Option+[: Previous workspace
      // Use e.code because Option+[ produces special characters on macOS
      if (isMeta && isAlt && !isShift && e.code === 'BracketLeft') {
        e.preventDefault()
        selectPreviousWorkspace()
        return
      }

      // Cmd+Option+]: Next workspace
      // Use e.code because Option+] produces special characters on macOS
      if (isMeta && isAlt && !isShift && e.code === 'BracketRight') {
        e.preventDefault()
        selectNextWorkspace()
        return
      }

      // === TAB SHORTCUTS (only for active workspace) ===
      if (!api || !isActive) return

      // Cmd+T: New Terminal
      if (isMeta && !isShift && !isAlt && e.key === 't') {
        e.preventDefault()
        api.addPanel({
          id: `terminal-${nanoid(8)}`,
          component: 'terminal',
          title: 'Terminal',
          params: { cwd: workspaceCwd },
        })
        return
      }

      // Cmd+E: New File Viewer
      if (isMeta && !isShift && !isAlt && e.key === 'e') {
        e.preventDefault()
        api.addPanel({
          id: `file-viewer-${nanoid(8)}`,
          component: 'file-viewer',
          title: 'File Viewer',
          params: { rootPath: workspaceCwd },
        })
        return
      }

      // Cmd+W: Close current tab
      if (isMeta && !isShift && !isAlt && e.key === 'w') {
        e.preventDefault()
        const activePanel = api.activePanel
        if (activePanel && activeWorkspaceId) {
          // Save tab info for reopen
          const viewType = activePanel.api.component as ViewType
          const params = (activePanel.params ?? {}) as Record<string, unknown>
          const title = activePanel.api.title ?? ''
          pushClosedTab(activeWorkspaceId, { viewType, params, title })
          activePanel.api.close()
        }
        return
      }

      // Cmd+Shift+T: Reopen last closed tab
      if (isMeta && isShift && !isAlt && (e.key === 't' || e.key === 'T')) {
        e.preventDefault()
        if (activeWorkspaceId) {
          const tabInfo = popClosedTab(activeWorkspaceId)
          if (tabInfo) {
            api.addPanel({
              id: `${tabInfo.viewType}-${nanoid(8)}`,
              component: tabInfo.viewType,
              title: tabInfo.title,
              params: tabInfo.params,
            })
          }
        }
        return
      }

      // Cmd+1-9: Jump to tab 1-9
      if (isMeta && !isShift && !isAlt && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const index = parseInt(e.key, 10) - 1
        const panels = api.panels
        if (index >= 0 && index < panels.length) {
          panels[index].api.setActive()
        }
        return
      }

      // Cmd+Shift+[: Previous tab
      if (isMeta && isShift && !isAlt && e.key === '[') {
        e.preventDefault()
        const panels = api.panels
        if (panels.length > 0) {
          const activePanel = api.activePanel
          const currentIndex = activePanel ? panels.indexOf(activePanel) : 0
          const prevIndex = currentIndex <= 0 ? panels.length - 1 : currentIndex - 1
          panels[prevIndex].api.setActive()
        }
        return
      }

      // Cmd+Shift+]: Next tab
      if (isMeta && isShift && !isAlt && e.key === ']') {
        e.preventDefault()
        const panels = api.panels
        if (panels.length > 0) {
          const activePanel = api.activePanel
          const currentIndex = activePanel ? panels.indexOf(activePanel) : -1
          const nextIndex = (currentIndex + 1) % panels.length
          panels[nextIndex].api.setActive()
        }
        return
      }

      // Ctrl+Tab: Next tab
      if (isCtrl && !isShift && !isAlt && !isMeta && e.key === 'Tab') {
        e.preventDefault()
        const panels = api.panels
        if (panels.length > 0) {
          const activePanel = api.activePanel
          const currentIndex = activePanel ? panels.indexOf(activePanel) : -1
          const nextIndex = (currentIndex + 1) % panels.length
          panels[nextIndex].api.setActive()
        }
        return
      }

      // Ctrl+Shift+Tab: Previous tab
      if (isCtrl && isShift && !isAlt && !isMeta && e.key === 'Tab') {
        e.preventDefault()
        const panels = api.panels
        if (panels.length > 0) {
          const activePanel = api.activePanel
          const currentIndex = activePanel ? panels.indexOf(activePanel) : 0
          const prevIndex = currentIndex <= 0 ? panels.length - 1 : currentIndex - 1
          panels[prevIndex].api.setActive()
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    api,
    workspaceCwd,
    isActive,
    activeWorkspaceId,
    setAddDialogOpen,
    selectWorkspaceAtIndex,
    selectNextWorkspace,
    selectPreviousWorkspace,
    pushClosedTab,
    popClosedTab,
  ])

  const handleReady = useCallback(
    (event: DockviewReadyEvent) => {
      const { api: dockviewApi } = event
      setApi(dockviewApi)

      // Try to restore layout from localStorage
      let layoutRestored = false
      try {
        const saved = localStorage.getItem(fullStorageKey)
        if (saved) {
          const layout = JSON.parse(saved)
          // Validate layout structure before using it
          if (isValidLayout(layout)) {
            dockviewApi.fromJSON(layout)
            layoutRestored = true
          } else {
            console.warn('Invalid WorkspaceHolder layout structure in localStorage, using default')
          }
        }
      } catch (error) {
        console.error('Failed to restore WorkspaceHolder layout:', error)
      }

      // Add default terminal panel if no layout was restored
      if (!layoutRestored) {
        dockviewApi.addPanel({
          id: 'terminal-1',
          component: 'terminal',
          title: 'Terminal',
          params: { cwd: workspaceCwd },
        })
      }

      // Subscribe to layout changes for persistence
      // Store disposable in ref for cleanup on unmount
      layoutChangeDisposableRef.current = dockviewApi.onDidLayoutChange(() => {
        try {
          const layout = dockviewApi.toJSON()
          localStorage.setItem(fullStorageKey, JSON.stringify(layout))
        } catch (error) {
          console.error('Failed to save WorkspaceHolder layout:', error)
        }
      })

      // Call external onReady callback
      onReady?.(dockviewApi)
    },
    [fullStorageKey, onReady, workspaceCwd]
  )

  // Wrap RightHeaderActions to pass workspaceCwd
  const RightHeaderActionsWithCwd = useCallback(
    (props: IDockviewHeaderActionsProps) => (
      <RightHeaderActions {...props} workspaceCwd={workspaceCwd} />
    ),
    [workspaceCwd]
  )

  return (
    <WorkspaceHolderProvider api={api} workspaceCwd={workspaceCwd}>
      <div className={cn('workspace-holder h-full w-full', dockviewThemeClass, className)}>
        <DockviewReact
          components={components}
          tabComponents={tabComponents}
          defaultTabComponent={ThemedTab}
          rightHeaderActionsComponent={RightHeaderActionsWithCwd}
          onReady={handleReady}
          className="h-full"
        />
      </div>
    </WorkspaceHolderProvider>
  )
}

export default WorkspaceHolder
