import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from 'xterm'
import { useEffect, useRef, useState } from 'react'
import type { LaunchLayoutNode, TerminalSessionState } from '../../shared/contracts'
import { termidiuApi } from '../lib/termidiu-api'
import { getTerminalBuffer, subscribeToTerminalOutput } from '../lib/terminal-event-bus'
import { useFontSizes } from '../hooks/use-font-sizes'

type TerminalPaneProps = {
  node: Extract<LaunchLayoutNode, { kind: 'terminal' }>
  session: TerminalSessionState | null
  onClose: (sessionId: string) => void
  onSplit: (sessionId: string, direction: 'right' | 'down') => void
}

type CtxMenu = { x: number; y: number } | null

export function TerminalPane({ node, session, onClose, onSplit }: TerminalPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const [status, setStatus] = useState<string>(session?.status ?? 'starting')
  const [ctxMenu, setCtxMenu] = useState<CtxMenu>(null)
  const { terminal: fontSize } = useFontSizes()

  useEffect(() => {
    setStatus(session?.status ?? 'starting')
  }, [session?.status])

  useEffect(() => {
    if (!terminalRef.current) return
    terminalRef.current.options.fontSize = fontSize
    fitRef.current?.fit()
  }, [fontSize])

  useEffect(() => {
    if (!hostRef.current) {
      return undefined
    }

    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: 'Cascadia Mono, Consolas, ui-monospace, monospace',
      fontSize,
      theme: {
        background: '#000000',
        foreground: '#cccccc',
        cursor: '#aeafad',
        selectionBackground: 'rgba(58, 102, 145, 0.5)',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      }
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(hostRef.current)
    fitAddon.fit()
    terminalRef.current = terminal
    fitRef.current = fitAddon

    const initialOutput = getTerminalBuffer(node.sessionId)
    if (initialOutput) {
      terminal.write(initialOutput)
    }

    // Block the browser's native paste event so xterm's internal handler
    // doesn't fire a second time when we handle Ctrl+V ourselves below.
    const pasteBlocker = (e: ClipboardEvent) => { e.preventDefault(); e.stopPropagation() }
    hostRef.current.addEventListener('paste', pasteBlocker, true)

    terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== 'keydown') return true
      if (e.shiftKey && e.key === 'Enter') {
        void termidiuApi.writeTerminal(node.sessionId, '\n')
        return false
      }
      if (e.ctrlKey && e.key === 'c' && terminal.hasSelection()) {
        void navigator.clipboard.writeText(terminal.getSelection())
        return false
      }
      if (e.ctrlKey && e.key === 'v') {
        void navigator.clipboard.readText().then(text => terminal.paste(text))
        return false
      }
      return true
    })

    terminal.onData(data => {
      void termidiuApi.writeTerminal(node.sessionId, data)
    })

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      void termidiuApi.resizeTerminal(node.sessionId, terminal.cols, terminal.rows)
    })

    resizeObserver.observe(hostRef.current)
    void termidiuApi.resizeTerminal(node.sessionId, terminal.cols, terminal.rows)

    const unsubscribeOutput = subscribeToTerminalOutput(node.sessionId, data => {
      terminal.write(data)
    })

    const host = hostRef.current
    return () => {
      host.removeEventListener('paste', pasteBlocker, true)
      unsubscribeOutput()
      resizeObserver.disconnect()
      terminal.dispose()
      terminalRef.current = null
      fitRef.current = null
    }
  }, [node.sessionId])

  return (
    <article
      className="terminal-pane"
      onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
    >
      {ctxMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setCtxMenu(null)} />
          <div className="terminal-ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
            <button className="terminal-ctx-item" type="button" onClick={() => { console.log('[split] right clicked, sessionId=', node.sessionId); setCtxMenu(null); onSplit(node.sessionId, 'right') }}>
              <SplitRightIcon /> Split Right
            </button>
            <button className="terminal-ctx-item" type="button" onClick={() => { console.log('[split] down clicked, sessionId=', node.sessionId); setCtxMenu(null); onSplit(node.sessionId, 'down') }}>
              <SplitDownIcon /> Split Down
            </button>
          </div>
        </>
      )}
      <header className="terminal-header">
        <div className="terminal-header-left">
          <strong>{node.title}</strong>
          <span className={`terminal-status-badge ${status}`}>{status}</span>
        </div>
        <div className="terminal-header-right">
          <span className="terminal-pid">{session?.processId ?? node.sessionId}</span>
          <button
            className="terminal-close-btn"
            type="button"
            title="Close terminal"
            onClick={() => onClose(node.sessionId)}
          >×</button>
        </div>
      </header>
      <div ref={hostRef} className="terminal-host" />
    </article>
  )
}

function SplitRightIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ width: 13, height: 13, flexShrink: 0 }}>
      <rect x="1" y="1" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1" />
      <line x1="8.5" y1="1" x2="8.5" y2="15" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function SplitDownIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ width: 13, height: 13, flexShrink: 0 }}>
      <rect x="1" y="1" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1" />
      <line x1="1" y1="8.5" x2="15" y2="8.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}
