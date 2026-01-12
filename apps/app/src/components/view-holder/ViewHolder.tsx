import { useState, useCallback, useEffect } from 'react'
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
import { ViewHolderProvider } from './ViewHolderProvider'
import { TerminalPanel } from './panels/TerminalPanel'
import { FileViewerPanel } from './panels/FileViewerPanel'
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
 * Add new panel button with dropdown menu
 */
function RightHeaderActions({ containerApi }: IDockviewHeaderActionsProps) {
  const [open, setOpen] = useState(false)

  const handleAddTerminal = () => {
    containerApi.addPanel({
      id: `terminal-${nanoid(8)}`,
      component: 'terminal',
      title: 'Terminal',
      params: {},
    })
    setOpen(false)
  }

  const handleAddFileViewer = () => {
    containerApi.addPanel({
      id: `file-viewer-${nanoid(8)}`,
      component: 'file-viewer',
      title: 'File Viewer',
      params: {},
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
export function ViewHolder({
  storageKey = 'default',
  className,
  onReady,
}: ViewHolderProps) {
  const [api, setApi] = useState<DockviewApi | null>(null)
  const fullStorageKey = `${STORAGE_KEY_PREFIX}${storageKey}`

  // Keyboard shortcuts: Cmd+T for terminal, Cmd+E for file viewer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!api) return

      // Cmd+T / Ctrl+T - New Terminal
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault()
        api.addPanel({
          id: `terminal-${nanoid(8)}`,
          component: 'terminal',
          title: 'Terminal',
          params: {},
        })
      }

      // Cmd+E / Ctrl+E - New File Viewer
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        api.addPanel({
          id: `file-viewer-${nanoid(8)}`,
          component: 'file-viewer',
          title: 'File Viewer',
          params: {},
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [api])

  const handleReady = useCallback(
    (event: DockviewReadyEvent) => {
      const { api: dockviewApi } = event
      setApi(dockviewApi)

      // Try to restore layout from localStorage
      try {
        const saved = localStorage.getItem(fullStorageKey)
        if (saved) {
          const layout = JSON.parse(saved)
          dockviewApi.fromJSON(layout)
        } else {
          // Add default terminal panel
          dockviewApi.addPanel({
            id: 'terminal-1',
            component: 'terminal',
            title: 'Terminal',
            params: {},
          })
        }
      } catch (error) {
        console.error('Failed to restore ViewHolder layout:', error)
        // Fallback: add default terminal panel
        dockviewApi.addPanel({
          id: 'terminal-1',
          component: 'terminal',
          title: 'Terminal',
          params: {},
        })
      }

      // Subscribe to layout changes for persistence
      const disposable = dockviewApi.onDidLayoutChange(() => {
        try {
          const layout = dockviewApi.toJSON()
          localStorage.setItem(fullStorageKey, JSON.stringify(layout))
        } catch (error) {
          console.error('Failed to save ViewHolder layout:', error)
        }
      })

      // Call external onReady callback
      onReady?.(dockviewApi)

      // Cleanup subscription on unmount handled by Dockview
      return () => disposable.dispose()
    },
    [fullStorageKey, onReady]
  )

  return (
    <ViewHolderProvider api={api}>
      <div className={cn('view-holder h-full w-full', className)}>
        <DockviewReact
          components={components}
          rightHeaderActionsComponent={RightHeaderActions}
          onReady={handleReady}
          className="dockview-theme-dark h-full"
        />
      </div>
    </ViewHolderProvider>
  )
}

export default ViewHolder
