import { useTerminal } from './useTerminal'
import { useTheme } from '@/src/components/theme'
import '@xterm/xterm/css/xterm.css'

interface TerminalViewProps {
  cwd?: string
  env?: Record<string, string>
  className?: string
}

export function TerminalView({ cwd, env, className }: TerminalViewProps) {
  const theme = useTheme()
  const { terminalRef, isConnected, error } = useTerminal({ cwd, env, theme })

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
