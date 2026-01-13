import type { DockviewApi } from 'dockview-react'

/**
 * Supported view types - extend this union as new views are added
 */
export type ViewType = 'terminal' | 'file-viewer'

/**
 * Terminal-specific panel props
 */
export interface TerminalPanelParams {
  cwd?: string
  env?: Record<string, string>
}

/**
 * File viewer panel props
 */
export interface FileViewerPanelParams {
  rootPath?: string
  showHidden?: boolean
  initialFilePath?: string
}

/**
 * Type-safe params mapping for each view type
 */
export interface ViewParamsMap {
  terminal: TerminalPanelParams
  'file-viewer': FileViewerPanelParams
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
 * Props for the WorkspaceHolder component
 */
export interface WorkspaceHolderProps {
  /** Storage key suffix for localStorage persistence */
  storageKey?: string
  /** Additional CSS classes */
  className?: string
  /** Callback when Dockview is ready and API is available */
  onReady?: (api: DockviewApi) => void
  /** Default working directory for terminals and file viewers in this workspace */
  workspaceCwd?: string
  /** Whether this workspace is currently active (for keyboard shortcuts) */
  isActive?: boolean
}

/**
 * Information about a closed tab for reopen functionality
 */
export interface ClosedTabInfo {
  viewType: ViewType
  params: Record<string, unknown>
  title: string
}

/**
 * Context value providing access to Dockview API
 */
export interface WorkspaceHolderContextValue {
  api: DockviewApi | null
  /** Add a new panel with the specified view type */
  addPanel: (viewType: ViewType, params?: Record<string, unknown>) => void
  /** Close the currently active panel */
  closeActivePanel: () => ClosedTabInfo | null
  /** Activate panel at the specified index (0-based) */
  activatePanelAtIndex: (index: number) => void
  /** Activate the next panel */
  activateNextPanel: () => void
  /** Activate the previous panel */
  activatePreviousPanel: () => void
  /** Get the total number of panels */
  getPanelCount: () => number
  /** Reopen a closed tab */
  reopenTab: (tabInfo: ClosedTabInfo) => void
}
