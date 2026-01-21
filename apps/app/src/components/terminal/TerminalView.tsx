import { useEffect } from 'react'
import { useTerminal } from './useTerminal'
import { useTheme } from '@/src/components/theme'
import '@xterm/xterm/css/xterm.css'

interface TerminalViewProps {
  cwd?: string
  env?: Record<string, string>
  workspaceId?: string
  workspaceName?: string
  className?: string
  isActive?: boolean
}

export function TerminalView({ cwd, env, workspaceId, workspaceName, className, isActive }: TerminalViewProps) {
  const theme = useTheme()
  const { terminalRef, isConnected, error, focus } = useTerminal({ cwd, env, theme, workspaceId, workspaceName })

  // Focus terminal when it becomes active
  useEffect(() => {
    if (isActive && isConnected) {
      focus()
    }
  }, [isActive, isConnected, focus])

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-background text-destructive ${className || ''}`}
      >
        <span>Terminal error: {error}</span>
      </div>
    )
  }

  return (
    <div className={`relative ${className || ''}`}>
      <div ref={terminalRef} className="w-full h-full bg-background" />
      {!isConnected && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <span className="text-muted-foreground">Connecting...</span>
        </div>
      )}
    </div>
  )
}

export default TerminalView
