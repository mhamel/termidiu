import type { LaunchLayoutNode, TerminalSessionState } from '../../shared/contracts'
import { TerminalPane } from './terminal-pane'

type SplitLayoutProps = {
  node: LaunchLayoutNode
  sessions: Record<string, TerminalSessionState>
  onClose: (sessionId: string) => void
  onSplit: (sessionId: string, direction: 'right' | 'down') => void
}

export function SplitLayout({ node, sessions, onClose, onSplit }: SplitLayoutProps) {
  if (node.kind === 'terminal') {
    return <TerminalPane node={node} session={sessions[node.sessionId] ?? null} onClose={onClose} onSplit={onSplit} />
  }

  return <SplitContainer node={node} sessions={sessions} onClose={onClose} onSplit={onSplit} />
}

type SplitContainerProps = {
  node: Extract<LaunchLayoutNode, { kind: 'split' }>
  sessions: Record<string, TerminalSessionState>
  onClose: (sessionId: string) => void
  onSplit: (sessionId: string, direction: 'right' | 'down') => void
}

function SplitContainer({ node, sessions, onClose, onSplit }: SplitContainerProps) {
  return (
    <div
      className={`split-layout ${node.orientation}`}
      style={{
        gridTemplateColumns: node.orientation === 'horizontal' ? `repeat(${node.children.length}, minmax(0, 1fr))` : undefined,
        gridTemplateRows: node.orientation === 'vertical' ? `repeat(${node.children.length}, minmax(0, 1fr))` : undefined
      }}
    >
      {node.children.map((child, index) => (
        <section key={`${child.kind}-${index}`} className="split-cell">
          <SplitLayout node={child} sessions={sessions} onClose={onClose} onSplit={onSplit} />
        </section>
      ))}
    </div>
  )
}
