import type { DockviewApi } from 'dockview-react'

/**
 * Supported view types - extend this union as new views are added
 */
export type ViewType = 'terminal'

/**
 * Terminal-specific panel props
 */
export interface TerminalPanelParams {
  cwd?: string
  env?: Record<string, string>
}

/**
 * Type-safe params mapping for each view type
 */
export interface ViewParamsMap {
  terminal: TerminalPanelParams
}

/**
 * Registry entry for a view type
 */
export interface ViewTypeRegistration<T extends ViewType = ViewType> {
  type: T
  displayName: string
  icon: React.ComponentType<{ className?: string }>
  defaultParams: ViewParamsMap[T]
}

/**
 * Props for the ViewHolder component
 */
export interface ViewHolderProps {
  /** Storage key suffix for localStorage persistence */
  storageKey?: string
  /** Additional CSS classes */
  className?: string
  /** Callback when Dockview is ready and API is available */
  onReady?: (api: DockviewApi) => void
}

/**
 * Context value providing access to Dockview API
 */
export interface ViewHolderContextValue {
  api: DockviewApi | null
  /** Add a new panel with the specified view type */
  addPanel: (viewType: ViewType, params?: Record<string, unknown>) => void
}
