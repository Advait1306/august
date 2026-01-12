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
import { ViewHolderProvider } from './ViewHolderProvider'
import { TerminalPanel } from './panels/TerminalPanel'
import { FileViewerPanel } from './panels/FileViewerPanel'
import { ThemedTab } from './ThemedTab'
import type { ViewHolderProps } from './types'

import 'dockview-react/dist/styles/dockview.css'
import './view-holder.css'

const STORAGE_KEY_PREFIX = 'august-view-holder-'

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
  )
}

/**
 * ViewHolder component - A flexible tiling window manager for views
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

export function ViewHolder({
  storageKey = 'default',
  className,
  onReady,
  workspaceCwd,
  isActive = true,
}: ViewHolderProps) {
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

  // Keyboard shortcuts: Cmd+T for terminal, Cmd+E for file viewer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts for the active workspace
      if (!api || !isActive) return

      // Cmd+T / Ctrl+T - New Terminal
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault()
        api.addPanel({
          id: `terminal-${nanoid(8)}`,
          component: 'terminal',
          title: 'Terminal',
          params: { cwd: workspaceCwd },
        })
      }

      // Cmd+E / Ctrl+E - New File Viewer
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        api.addPanel({
          id: `file-viewer-${nanoid(8)}`,
          component: 'file-viewer',
          title: 'File Viewer',
          params: { rootPath: workspaceCwd },
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [api, workspaceCwd, isActive])

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
            console.warn('Invalid ViewHolder layout structure in localStorage, using default')
          }
        }
      } catch (error) {
        console.error('Failed to restore ViewHolder layout:', error)
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
          console.error('Failed to save ViewHolder layout:', error)
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
    <ViewHolderProvider api={api} workspaceCwd={workspaceCwd}>
      <div className={cn('view-holder h-full w-full', dockviewThemeClass, className)}>
        <DockviewReact
          components={components}
          tabComponents={tabComponents}
          defaultTabComponent={ThemedTab}
          rightHeaderActionsComponent={RightHeaderActionsWithCwd}
          onReady={handleReady}
          className="h-full"
        />
      </div>
    </ViewHolderProvider>
  )
}

export default ViewHolder
