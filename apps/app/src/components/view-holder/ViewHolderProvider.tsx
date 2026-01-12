import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import type { DockviewApi } from 'dockview-react'
import { nanoid } from 'nanoid'
import type { ViewType, ViewHolderContextValue } from './types'
import { getViewType } from './registry'

const ViewHolderContext = createContext<ViewHolderContextValue | null>(null)

interface ViewHolderProviderProps {
  children: ReactNode
  api: DockviewApi | null
}

/**
 * Context provider for ViewHolder API access
 */
export function ViewHolderProvider({ children, api }: ViewHolderProviderProps) {
  const addPanel = useCallback(
    (viewType: ViewType, params: Record<string, unknown> = {}) => {
      if (!api) return

      const viewTypeInfo = getViewType(viewType)
      if (!viewTypeInfo) {
        console.warn(`Unknown view type: ${viewType}`)
        return
      }

      const id = `${viewType}-${nanoid(8)}`
      api.addPanel({
        id,
        component: viewType,
        title: viewTypeInfo.displayName,
        params: { ...viewTypeInfo.defaultParams, ...params },
      })
    },
    [api]
  )

  const value = useMemo<ViewHolderContextValue>(
    () => ({
      api,
      addPanel,
    }),
    [api, addPanel]
  )

  return (
    <ViewHolderContext.Provider value={value}>
      {children}
    </ViewHolderContext.Provider>
  )
}

/**
 * Hook to access ViewHolder API
 */
export function useViewHolder(): ViewHolderContextValue {
  const context = useContext(ViewHolderContext)
  if (!context) {
    throw new Error('useViewHolder must be used within a ViewHolderProvider')
  }
  return context
}
