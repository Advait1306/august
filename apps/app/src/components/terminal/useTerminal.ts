import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";

interface UseTerminalOptions {
  cwd?: string;
  env?: Record<string, string>;
  theme?: "light" | "dark";
}

const TERMINAL_THEMES = {
  dark: {
    background: "#1e1e1e",
    foreground: "#d4d4d4",
    cursor: "#d4d4d4",
  },
  light: {
    background: "#ffffff",
    foreground: "#1e1e1e",
    cursor: "#1e1e1e",
  },
};

interface UseTerminalReturn {
  terminalRef: React.RefObject<HTMLDivElement | null>;
  isConnected: boolean;
  error: string | null;
  focus: () => void;
}

export function useTerminal(
  options: UseTerminalOptions = {}
): UseTerminalReturn {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  // Store initial options in refs so they don't cause re-renders
  const initialOptionsRef = useRef(options);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    mountedRef.current = true;

    const terminalTheme =
      TERMINAL_THEMES[initialOptionsRef.current.theme || "dark"];
    const xterm = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      theme: terminalTheme,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon((_event, uri) => {
      window.api.browser.openUrl(uri);
    });
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    xterm.open(terminalRef.current);
    fitAddon.fit();

    // Enable Shift+Enter to insert a newline using bracketed paste
    xterm.attachCustomKeyEventHandler((event) => {
      if (event.key === "Enter" && event.shiftKey) {
        if (event.type === "keydown" && terminalIdRef.current) {
          console.log("Shift + Enter triggered");
          // xterm.input('\x1b[200~\x00\x1b[201~', true)
          xterm.input("\u001b\r", false);
        }
        return false;
      }
      return true;
    });

    const initPty = async () => {
      try {
        const { cols, rows } = xterm;
        const response = await window.api.terminal.create({
          cols,
          rows,
          cwd: initialOptionsRef.current.cwd,
          env: initialOptionsRef.current.env,
        });

        // Check if component unmounted while we were waiting for the async call
        if (!mountedRef.current) {
          // Component unmounted during async operation - destroy the PTY to prevent leak
          if (response.success && response.terminalId) {
            window.api.terminal.destroy(response.terminalId);
          }
          return;
        }

        if (!response.success || !response.terminalId) {
          setError(response.error || "Failed to create terminal");
          return;
        }

        terminalIdRef.current = response.terminalId;
        setIsConnected(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create terminal"
        );
      }
    };

    initPty();

    const inputDisposable = xterm.onData((data) => {
      if (terminalIdRef.current) {
        window.api.terminal.write(terminalIdRef.current, data);
      }
    });

    const unsubscribeData = window.api.terminal.onData((event) => {
      if (event.terminalId === terminalIdRef.current) {
        xterm.write(event.data);
      }
    });

    const unsubscribeExit = window.api.terminal.onExit((event) => {
      if (event.terminalId === terminalIdRef.current) {
        xterm.write(`\r\n[Process exited with code ${event.exitCode}]\r\n`);
        setIsConnected(false);
        terminalIdRef.current = null;
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && terminalIdRef.current) {
        fitAddonRef.current.fit();
        const { cols, rows } = xterm;
        window.api.terminal.resize(terminalIdRef.current, cols, rows);
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      mountedRef.current = false;

      inputDisposable.dispose();
      unsubscribeData();
      unsubscribeExit();
      resizeObserver.disconnect();

      if (terminalIdRef.current) {
        window.api.terminal.destroy(terminalIdRef.current);
        terminalIdRef.current = null;
      }

      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
    // Terminal should only initialize once on mount - options are captured in initialOptionsRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update terminal theme when it changes
  useEffect(() => {
    if (xtermRef.current && options.theme) {
      xtermRef.current.options.theme = TERMINAL_THEMES[options.theme];
    }
  }, [options.theme]);

  const focus = useCallback(() => {
    xtermRef.current?.focus();
  }, []);

  return {
    terminalRef,
    isConnected,
    error,
    focus,
  };
}
