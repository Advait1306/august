import { useState, useCallback, useEffect } from 'react'
import {
  DockviewReact,
  type DockviewReadyEvent,
  type DockviewApi,
  type IDockviewHeaderActionsProps,
} from 'dockview-react'
import { Plus } from 'lucide-react'
import { nanoid } from 'nanoid'
import { cn } from '@/lib/utils'
import { ViewHolderProvider } from './ViewHolderProvider'
import { TerminalPanel } from './panels/TerminalPanel'
import type { ViewHolderProps } from './types'

import 'dockview-react/dist/styles/dockview.css'
import './view-holder.css'

const STORAGE_KEY_PREFIX = 'august-view-holder-'

/**
 * Panel components registered with Dockview
 */
const components = {
  terminal: TerminalPanel,
}

/**
 * Add new terminal button in tab bar
 */
function RightHeaderActions({ containerApi }: IDockviewHeaderActionsProps) {
  const handleAddTerminal = () => {
    containerApi.addPanel({
      id: `terminal-${nanoid(8)}`,
      component: 'terminal',
      title: 'Terminal',
      params: {},
    })
  }

  return (
    <button
      onClick={handleAddTerminal}
      className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--dv-icon-hover-background-color)] transition-colors"
      title="New Terminal (⌘T)"
    >
      <Plus className="h-4 w-4" />
    </button>
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

  // Keyboard shortcut: Cmd+T / Ctrl+T to add new terminal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault()
        if (api) {
          api.addPanel({
            id: `terminal-${nanoid(8)}`,
            component: 'terminal',
            title: 'Terminal',
            params: {},
          })
        }
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
