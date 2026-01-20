import { useEffect, useState } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import { TerminalView } from '../../terminal'
import type { TerminalPanelParams } from '../types'

/**
 * Terminal panel component for Dockview
 * Wraps the existing TerminalView component
 */
export function TerminalPanel({
  params,
  api,
}: IDockviewPanelProps<TerminalPanelParams>) {
  const [isActive, setIsActive] = useState(api.isActive)

  useEffect(() => {
    const disposable = api.onDidActiveChange((event) => {
      setIsActive(event.isActive)
    })
    return () => disposable.dispose()
  }, [api])

  return (
    <TerminalView
      cwd={params.cwd}
      env={params.env}
      workspaceId={params.workspaceId}
      workspaceName={params.workspaceName}
      isActive={isActive}
      className="h-full w-full"
    />
  )
}
