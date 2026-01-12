import { useTerminal } from './useTerminal'
import '@xterm/xterm/css/xterm.css'

interface TerminalViewProps {
  cwd?: string
  env?: Record<string, string>
  className?: string
}

export function TerminalView({ cwd, env, className }: TerminalViewProps) {
  const { terminalRef, isConnected, error } = useTerminal({ cwd, env })

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-[#1e1e1e] text-red-400 ${className || ''}`}
      >
        <span>Terminal error: {error}</span>
      </div>
    )
  }

  return (
    <div className={`relative ${className || ''}`}>
      <div ref={terminalRef} className="w-full h-full" style={{ backgroundColor: '#1e1e1e' }} />
      {!isConnected && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]/80">
          <span className="text-gray-400">Connecting...</span>
        </div>
      )}
    </div>
  )
}

export default TerminalView
