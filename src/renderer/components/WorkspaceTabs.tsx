import { useState, useCallback } from 'react'
import type { LaunchLayoutNode, LaunchTerminalNode, SplitOrientation, TerminalSessionState, WorkspaceTab } from '../../shared/contracts'
import { SplitLayout } from './split-layout'
import { termidiuApi } from '../lib/termidiu-api'

type WorkspaceTabsProps = {
  tab: WorkspaceTab
  sessions: Record<string, TerminalSessionState>
}

function filterLayout(node: LaunchLayoutNode, closed: Set<string>): LaunchLayoutNode | null {
  if (node.kind === 'terminal') {
    return closed.has(node.sessionId) ? null : node
  }
  const children = node.children
    .map(c => filterLayout(c, closed))
    .filter((c): c is LaunchLayoutNode => c !== null)
  if (children.length === 0) return null
  if (children.length === 1) return children[0]
  return { ...node, children }
}

function insertSplit(
  layout: LaunchLayoutNode,
  sessionId: string,
  newNode: LaunchTerminalNode,
  orientation: SplitOrientation
): LaunchLayoutNode {
  if (layout.kind === 'terminal') {
    if (layout.sessionId === sessionId) {
      return { kind: 'split', orientation, children: [layout, newNode] }
    }
    return layout
  }
  return { ...layout, children: layout.children.map(c => insertSplit(c, sessionId, newNode, orientation)) }
}

function findTerminalNode(layout: LaunchLayoutNode, sessionId: string): LaunchTerminalNode | null {
  if (layout.kind === 'terminal') return layout.sessionId === sessionId ? layout : null
  for (const child of layout.children) {
    const found = findTerminalNode(child, sessionId)
    if (found) return found
  }
  return null
}

export function WorkspaceTabs({ tab, sessions }: WorkspaceTabsProps) {
  const [closedSessions, setClosedSessions] = useState<Set<string>>(new Set())
  const [layoutOverride, setLayoutOverride] = useState<LaunchLayoutNode>(tab.layout)

  const handleClose = useCallback((sessionId: string) => {
    void termidiuApi.stopSession(sessionId)
    setClosedSessions(prev => new Set([...prev, sessionId]))
  }, [])

  const handleSplit = useCallback((sessionId: string, direction: 'right' | 'down') => {
    const original = findTerminalNode(layoutOverride, sessionId)
    if (!original) return
    const newId = crypto.randomUUID()
    const newNode: LaunchTerminalNode = {
      kind: 'terminal',
      sessionId: newId,
      title: original.title,
      cwd: original.cwd,
      launch: original.launch
    }
    void termidiuApi.createSession({ id: newId, tabId: tab.id, title: original.title, cwd: original.cwd, launch: original.launch })
    const orientation: SplitOrientation = direction === 'right' ? 'horizontal' : 'vertical'
    setLayoutOverride(prev => insertSplit(prev, sessionId, newNode, orientation))
  }, [layoutOverride, tab.id])

  const layout = filterLayout(layoutOverride, closedSessions)
  if (!layout) return null

  return (
    <div className="tab-content">
      <SplitLayout node={layout} sessions={sessions} onClose={handleClose} onSplit={handleSplit} />
    </div>
  )
}
