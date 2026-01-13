import { TerminalSquare, FolderOpen } from 'lucide-react'
import type { ViewType, ViewTypeRegistration } from './types'

/**
 * Registry of all available view types
 */
const viewRegistry = new Map<ViewType, ViewTypeRegistration>()

/**
 * Register a view type
 */
export function registerViewType<T extends ViewType>(
  registration: ViewTypeRegistration<T>
): void {
  viewRegistry.set(registration.type, registration as ViewTypeRegistration)
}

/**
 * Get a registered view type
 */
export function getViewType(type: ViewType): ViewTypeRegistration | undefined {
  return viewRegistry.get(type)
}

/**
 * Get all registered view types
 */
export function getAllViewTypes(): ViewTypeRegistration[] {
  return Array.from(viewRegistry.values())
}

/**
 * Check if a view type is registered
 */
export function isViewTypeRegistered(type: ViewType): boolean {
  return viewRegistry.has(type)
}

// Register built-in Terminal view
registerViewType({
  type: 'terminal',
  displayName: 'Terminal',
  icon: TerminalSquare,
  defaultParams: {
    cwd: undefined,
    env: undefined,
  },
})

// Register File Viewer view
registerViewType({
  type: 'file-viewer',
  displayName: 'File Viewer',
  icon: FolderOpen,
  defaultParams: {
    rootPath: undefined,
    showHidden: false,
  },
})
