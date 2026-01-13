import type { IDockviewPanelProps } from 'dockview-react'
import { TerminalView } from '../../terminal'
import type { TerminalPanelParams } from '../types'

/**
 * Terminal panel component for Dockview
 * Wraps the existing TerminalView component
 */
export function TerminalPanel({
  params,
}: IDockviewPanelProps<TerminalPanelParams>) {
  return (
    <TerminalView
      cwd={params.cwd}
      env={params.env}
      className="h-full w-full"
    />
  )
}
