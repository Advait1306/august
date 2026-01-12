import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'

interface UseTerminalOptions {
  cwd?: string
  env?: Record<string, string>
}

interface UseTerminalReturn {
  terminalRef: React.RefObject<HTMLDivElement | null>
  isConnected: boolean
  error: string | null
}

export function useTerminal(options: UseTerminalOptions = {}): UseTerminalReturn {
  const terminalRef = useRef<HTMLDivElement | null>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const terminalIdRef = useRef<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!terminalRef.current) return

    const xterm = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4'
      }
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    xterm.loadAddon(fitAddon)
    xterm.loadAddon(webLinksAddon)

    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

    xterm.open(terminalRef.current)
    fitAddon.fit()

    const initPty = async () => {
      try {
        const { cols, rows } = xterm
        const response = await window.api.terminal.create({
          cols,
          rows,
          cwd: options.cwd,
          env: options.env
        })

        if (!response.success || !response.terminalId) {
          setError(response.error || 'Failed to create terminal')
          return
        }

        terminalIdRef.current = response.terminalId
        setIsConnected(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create terminal')
      }
    }

    initPty()

    const inputDisposable = xterm.onData((data) => {
      if (terminalIdRef.current) {
        window.api.terminal.write(terminalIdRef.current, data)
      }
    })

    const unsubscribeData = window.api.terminal.onData((event) => {
      if (event.terminalId === terminalIdRef.current) {
        xterm.write(event.data)
      }
    })

    const unsubscribeExit = window.api.terminal.onExit((event) => {
      if (event.terminalId === terminalIdRef.current) {
        xterm.write(`\r\n[Process exited with code ${event.exitCode}]\r\n`)
        setIsConnected(false)
        terminalIdRef.current = null
      }
    })

    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && terminalIdRef.current) {
        fitAddonRef.current.fit()
        const { cols, rows } = xterm
        window.api.terminal.resize(terminalIdRef.current, cols, rows)
      }
    })

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current)
    }

    return () => {
      inputDisposable.dispose()
      unsubscribeData()
      unsubscribeExit()
      resizeObserver.disconnect()

      if (terminalIdRef.current) {
        window.api.terminal.destroy(terminalIdRef.current)
        terminalIdRef.current = null
      }

      xterm.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [options.cwd, options.env])

  return {
    terminalRef,
    isConnected,
    error
  }
}
