import { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import { FontSizesContext, useFontSizesState } from './hooks/use-font-sizes'
import { EmptyState } from './components/EmptyState'
import { FileEditorPanel, type OpenFile } from './components/FileEditorPanel'
import { MenuBar } from './components/MenuBar'
import { ProjectTree, NewFileIcon, NewFolderIcon, type ProjectTreeHandle } from './components/ProjectTree'
import { SettingsModal } from './components/SettingsModal'
import { WorkspaceTabs } from './components/WorkspaceTabs'
import { useTermidiuSnapshot } from './hooks/use-termidiu-snapshot'
import { termidiuApi } from './lib/termidiu-api'
import type { AiAgentConfig, AiAgentId, LayoutDescriptor, ScriptDescriptor, TerminalSessionState } from '../shared/contracts'

const AI_META: Record<AiAgentId, { name: string; color: string }> = {
  claude:     { name: 'Claude',     color: '#d4915c' },
  gemini:     { name: 'Gemini',     color: '#4285f4' },
  codex:      { name: 'Codex',      color: '#10a37f' },
  perplexity: { name: 'Perplexity', color: '#20b2aa' },
}

const WEB_AGENT_URLS: Partial<Record<AiAgentId, string>> = {
  perplexity: 'https://www.perplexity.ai',
}

const SIDEBAR_MIN = 150
const SIDEBAR_MAX = 600
const SIDEBAR_DEFAULT = 240

type ActivePane =
  | { type: 'file'; path: string }
  | { type: 'terminal'; tabId: string }
  | { type: 'web'; agentId: AiAgentId }
  | null

export function App() {
  const snapshot = useTermidiuSnapshot()
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLElement | null>(null)
  const treeRef = useRef<ProjectTreeHandle | null>(null)

  const [openFiles, setOpenFiles] = useState<Map<string, OpenFile>>(new Map())
  const [activePane, setActivePane] = useState<ActivePane>(null)
  const [scriptsOnly, setScriptsOnly] = useState(() => localStorage.getItem('scriptsOnly') === 'true')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [openWebTabs, setOpenWebTabs] = useState<Set<AiAgentId>>(new Set())
  const { sizes: fontSizes, update: updateFontSize } = useFontSizesState()

  useEffect(() => {
    document.documentElement.style.setProperty('--fs-tree', `${fontSizes.tree}px`)
  }, [fontSizes.tree])
  const [tabOrder, setTabOrder] = useState<string[]>([])
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const dragSrcKey = useRef<string | null>(null)

  // Keep tabOrder in sync: preserve manual ordering, append new tabs, remove closed ones
  useEffect(() => {
    setTabOrder(prev => {
      const fileKeys = [...openFiles.keys()].map(p => 'file:' + p)
      const tabKeys = snapshot.tabs.map(t => 'tab:' + t.id)
      const webKeys = [...openWebTabs].map(id => 'web:' + id)
      const allKeys = new Set([...fileKeys, ...tabKeys, ...webKeys])
      const kept = prev.filter(k => allKeys.has(k))
      const existing = new Set(kept)
      const newOnes = [...fileKeys, ...tabKeys, ...webKeys].filter(k => !existing.has(k))
      return [...kept, ...newOnes]
    })
  }, [openFiles, snapshot.tabs, openWebTabs])

  function handleDragStart(key: string, e: React.DragEvent) {
    dragSrcKey.current = key
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(key: string, e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverKey !== key) setDragOverKey(key)
  }

  function handleDrop(key: string, e: React.DragEvent) {
    e.preventDefault()
    const src = dragSrcKey.current
    if (!src || src === key) { dragSrcKey.current = null; setDragOverKey(null); return }
    setTabOrder(prev => {
      const srcIdx = prev.indexOf(src)
      const dstIdx = prev.indexOf(key)
      if (srcIdx === -1 || dstIdx === -1) return prev
      const next = [...prev]
      next.splice(srcIdx, 1)
      next.splice(dstIdx, 0, src)
      return next
    })
    dragSrcKey.current = null
    setDragOverKey(null)
  }

  function handleDragEnd() {
    dragSrcKey.current = null
    setDragOverKey(null)
  }

  const handleLaunchAgent = useCallback((id: AiAgentId) => {
    const url = WEB_AGENT_URLS[id]
    if (url) {
      setOpenWebTabs(prev => new Set([...prev, id]))
      setActivePane({ type: 'web', agentId: id })
    } else {
      void termidiuApi.launchAiAgent(id)
    }
  }, [])

  // Auto-switch to a terminal tab when the main process activates one (play pressed)
  const prevActiveTabId = useRef(snapshot.activeTabId)
  useEffect(() => {
    if (snapshot.activeTabId && snapshot.activeTabId !== prevActiveTabId.current) {
      setActivePane({ type: 'terminal', tabId: snapshot.activeTabId })
    }
    prevActiveTabId.current = snapshot.activeTabId
  }, [snapshot.activeTabId])

  // If active terminal tab is closed, fall back
  useEffect(() => {
    if (activePane?.type === 'terminal') {
      const stillExists = snapshot.tabs.some(t => t.id === activePane.tabId)
      if (!stillExists) {
        const fallback = snapshot.tabs.at(-1)
        setActivePane(fallback ? { type: 'terminal', tabId: fallback.id } : null)
      }
    }
  }, [snapshot.tabs, activePane])

  const activeTab = useMemo(() => {
    if (activePane?.type === 'terminal') {
      return snapshot.tabs.find(t => t.id === activePane.tabId) ?? null
    }
    return null
  }, [activePane, snapshot.tabs])

  const activeFile = useMemo(() => {
    if (activePane?.type === 'file') {
      return openFiles.get(activePane.path) ?? null
    }
    return null
  }, [activePane, openFiles])

  const projectName = snapshot.currentProjectRoot
    ? snapshot.currentProjectRoot.replace(/\\/g, '/').split('/').filter(Boolean).pop()
    : null

  // ── Sidebar resize ────────────────────────────────────────

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault()
    setIsResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const startX = e.clientX
    const startWidth = sidebarRef.current?.offsetWidth ?? SIDEBAR_DEFAULT

    function onMouseMove(ev: MouseEvent) {
      setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth + ev.clientX - startX)))
    }
    function onMouseUp() {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  // ── File editor ───────────────────────────────────────────

  const handleScriptClick = useCallback(async (path: string, name: string) => {
    if (openFiles.has(path)) {
      setActivePane({ type: 'file', path })
      return
    }
    try {
      const content = await termidiuApi.readFile(path)
      setOpenFiles(prev => {
        const next = new Map(prev)
        next.set(path, { path, title: name, content, isDirty: false })
        return next
      })
      setActivePane({ type: 'file', path })
    } catch (err) {
      console.error('Failed to read file:', err)
    }
  }, [openFiles])

  const handleFileChange = useCallback((path: string, content: string) => {
    setOpenFiles(prev => {
      const next = new Map(prev)
      const entry = next.get(path)
      if (entry) next.set(path, { ...entry, content, isDirty: true })
      return next
    })
  }, [])

  const handleFileSave = useCallback(async (path: string, content: string) => {
    await termidiuApi.writeFile(path, content)
    setOpenFiles(prev => {
      const next = new Map(prev)
      const entry = next.get(path)
      if (entry) next.set(path, { ...entry, content, isDirty: false })
      return next
    })
  }, [])

  const handleFileClose = useCallback((path: string) => {
    setOpenFiles(prev => {
      const next = new Map(prev)
      next.delete(path)
      return next
    })
    setActivePane(prev => {
      if (prev?.type !== 'file' || prev.path !== path) return prev
      // find another file or terminal to activate
      const otherFiles = [...openFiles.keys()].filter(k => k !== path)
      if (otherFiles.length > 0) return { type: 'file', path: otherFiles.at(-1)! }
      const lastTab = snapshot.tabs.at(-1)
      return lastTab ? { type: 'terminal', tabId: lastTab.id } : null
    })
  }, [openFiles, snapshot.tabs])

  const tabStatus = useCallback((tabId: string) =>
    getTabStatus(tabId, snapshot.sessions), [snapshot.sessions])

  const hasAnything = openFiles.size > 0 || snapshot.tabs.length > 0 || openWebTabs.size > 0

  return (
    <FontSizesContext.Provider value={fontSizes}>
    <div className="app-root">
    <MenuBar
      sidebarCollapsed={sidebarCollapsed}
      onToggleSidebar={() => { const next = !sidebarCollapsed; setSidebarCollapsed(next); localStorage.setItem('sidebarCollapsed', String(next)) }}
      onOpenSettings={() => setSettingsOpen(true)}
    />
    <div className="app-shell">
      <aside className="app-sidebar" ref={sidebarRef} style={{ width: sidebarCollapsed ? 36 : sidebarWidth }}>
        {!sidebarCollapsed && (
          <>
            <div className="sidebar-project-section">
              <div className={`sidebar-section-header ${projectName ? '' : 'no-project'}`}>
                <span className="sidebar-section-header-title">{projectName ?? 'No folder opened'}</span>
                <div className="sidebar-section-actions">
                  {snapshot.currentProjectRoot ? (
                    <>
                      <button
                        className={`icon-button ${scriptsOnly ? 'active' : ''}`}
                        type="button"
                        title={scriptsOnly ? 'Show all files' : 'Show scripts only'}
                        onClick={() => setScriptsOnly(v => { const next = !v; localStorage.setItem('scriptsOnly', String(next)); return next })}
                      >
                        <ScriptsOnlyIcon />
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        title="New File"
                        onClick={() => treeRef.current?.startCreate('file')}
                      >
                        <NewFileIcon />
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        title="New Folder"
                        onClick={() => treeRef.current?.startCreate('folder')}
                      >
                        <NewFolderIcon />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {snapshot.aiAgents.some(a => a.enabled) ? (
              <AiAgentsSection
                agents={snapshot.aiAgents.filter(a => a.enabled)}
                onLaunch={handleLaunchAgent}
              />
            ) : null}

            {(snapshot.pinnedLayouts.length > 0 || snapshot.pinnedScripts.length > 0) ? (
              <PinnedLayoutsSection
                layouts={snapshot.pinnedLayouts}
                scripts={snapshot.pinnedScripts}
                onPlay={(path) => void termidiuApi.playScript(path)}
                onUnpinLayout={(path) => void termidiuApi.unpinLayout(path)}
                onUnpinScript={(path) => void termidiuApi.unpinScript(path)}
              />
            ) : null}

            <ProjectTree
              ref={treeRef}
              items={snapshot.projectTree?.children ?? []}
              projectRoot={snapshot.currentProjectRoot}
              pinnedLayoutPaths={new Set(snapshot.pinnedLayouts.map(l => l.fullPath))}
              pinnedScriptPaths={new Set(snapshot.pinnedScripts.map(s => s.fullPath))}
              scriptsOnly={scriptsOnly}
              onScriptClick={(path, name) => void handleScriptClick(path, name)}
            />
          </>
        )}
      </aside>

      {!sidebarCollapsed && (
        <div
          className={`sidebar-resize-handle ${isResizing ? 'active' : ''}`}
          onMouseDown={handleResizeStart}
        />
      )}

      <main className="app-workspace">
        {snapshot.lastError ? (
          <div className="error-banner" role="alert">{snapshot.lastError}</div>
        ) : null}

        {!hasAnything ? <EmptyState /> : (
          <>
            {/* ── Unified tab bar ── */}
            <div className="tab-bar" role="tablist">
              {tabOrder.map(key => {
                if (key.startsWith('file:')) {
                  const path = key.slice(5)
                  const file = openFiles.get(path)
                  if (!file) return null
                  const isActive = activePane?.type === 'file' && activePane.path === path
                  return (
                    <div
                      key={key}
                      className={`tab-item ${isActive ? 'active' : ''} ${dragOverKey === key ? 'drag-over' : ''}`}
                      role="tab"
                      draggable
                      onDragStart={e => handleDragStart(key, e)}
                      onDragOver={e => handleDragOver(key, e)}
                      onDrop={e => handleDrop(key, e)}
                      onDragEnd={handleDragEnd}
                    >
                      <FileTabIcon />
                      <button
                        className="tab-label"
                        type="button"
                        onClick={() => setActivePane({ type: 'file', path })}
                      >
                        {file.title}
                      </button>
                      {file.isDirty && <span className="tab-dirty-dot" title="Unsaved" />}
                      <div className="tab-item-actions">
                        <button
                          className="tab-icon-btn close"
                          type="button"
                          title="Close"
                          onClick={() => handleFileClose(path)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )
                } else if (key.startsWith('tab:')) {
                  const tabId = key.slice(4)
                  const tab = snapshot.tabs.find(t => t.id === tabId)
                  if (!tab) return null
                  const isActive = activePane?.type === 'terminal' && activePane.tabId === tabId
                  const status = tabStatus(tabId)
                  return (
                    <div
                      key={key}
                      className={`tab-item ${isActive ? 'active' : ''} ${dragOverKey === key ? 'drag-over' : ''}`}
                      role="tab"
                      draggable
                      onDragStart={e => handleDragStart(key, e)}
                      onDragOver={e => handleDragOver(key, e)}
                      onDrop={e => handleDrop(key, e)}
                      onDragEnd={handleDragEnd}
                    >
                      <span className={`tab-status-dot ${status}`} title={status} />
                      <button
                        className="tab-label"
                        type="button"
                        onClick={() => setActivePane({ type: 'terminal', tabId })}
                      >
                        {tab.title}
                      </button>
                      <div className="tab-item-actions">
                        <button
                          className="tab-icon-btn close"
                          type="button"
                          title="Close"
                          onClick={() => void termidiuApi.closeTab(tabId)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )
                } else if (key.startsWith('web:')) {
                  const agentId = key.slice(4) as AiAgentId
                  const meta = AI_META[agentId]
                  const isActive = activePane?.type === 'web' && activePane.agentId === agentId
                  return (
                    <div
                      key={key}
                      className={`tab-item ${isActive ? 'active' : ''} ${dragOverKey === key ? 'drag-over' : ''}`}
                      role="tab"
                      draggable
                      onDragStart={e => handleDragStart(key, e)}
                      onDragOver={e => handleDragOver(key, e)}
                      onDrop={e => handleDrop(key, e)}
                      onDragEnd={handleDragEnd}
                    >
                      <span className="tab-web-dot" style={{ background: meta.color }} />
                      <button
                        className="tab-label"
                        type="button"
                        onClick={() => setActivePane({ type: 'web', agentId })}
                      >
                        {meta.name}
                      </button>
                      <div className="tab-item-actions">
                        <button
                          className="tab-icon-btn close"
                          type="button"
                          title="Close"
                          onClick={() => {
                            setOpenWebTabs(prev => { const s = new Set(prev); s.delete(agentId); return s })
                            setActivePane(prev => prev?.type === 'web' && prev.agentId === agentId ? null : prev)
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )
                }
                return null
              })}
              {snapshot.currentProjectRoot && (
                <button
                  className="tab-bar-action-btn"
                  type="button"
                  title="Open PowerShell here"
                  onClick={() => void termidiuApi.openShell()}
                >
                  <ShellIcon />
                </button>
              )}
            </div>

            {/* ── Context toolbar ── */}
            {activePane?.type === 'file' && activeFile ? (
              <FileContextToolbar
                file={activeFile}
                onSave={() => void handleFileSave(activePane.path, activeFile.content)}
                onRun={() => void termidiuApi.playScript(activePane.path)}
              />
            ) : activePane?.type === 'terminal' && activeTab ? (
              <TerminalContextToolbar
                tabId={activeTab.id}
                title={activeTab.title}
                status={tabStatus(activeTab.id)}
              />
            ) : null}

            {/* ── Content ── */}
            <div className="workspace-content">
              {activePane?.type === 'file' && activeFile ? (
                <FileEditorPanel
                  key={activePane.path}
                  file={activeFile}
                  onChange={content => handleFileChange(activePane.path, content)}
                  onSave={content => handleFileSave(activePane.path, content)}
                />
              ) : activePane?.type === 'terminal' && activeTab ? (
                <WorkspaceTabs
                  key={activeTab.id}
                  tab={activeTab}
                  sessions={snapshot.sessions}
                />
              ) : activePane?.type === 'web' && WEB_AGENT_URLS[activePane.agentId] ? (
                <webview
                  key={activePane.agentId}
                  src={WEB_AGENT_URLS[activePane.agentId]}
                  style={{ position: 'absolute', inset: '0', border: 'none' }}
                />
              ) : (
                <EmptyState />
              )}
            </div>
          </>
        )}
      </main>
      {settingsOpen ? (
        <SettingsModal
          agents={snapshot.aiAgents}
          fontSizes={fontSizes}
          onFontSizeChange={updateFontSize}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
    </div>
    </FontSizesContext.Provider>
  )
}

// ── AI agents section ─────────────────────────────────────────────────────────

function AiAgentsSection({ agents, onLaunch }: {
  agents: AiAgentConfig[]
  onLaunch: (id: AiAgentId) => void
}) {
  return (
    <div className="ai-section">
      <div className="sidebar-section-header no-project" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11, color: 'var(--text-dim)' }}>
        AI
      </div>
      {agents.map(agent => {
        const meta = AI_META[agent.id]
        return (
          <div key={agent.id} className="ai-item">
            <span className="ai-logo-wrap" style={{ color: meta.color }}><AiLogoIcon id={agent.id} /></span>
            <span className="ai-name">{meta.name}</span>
            {agent.yolo && <span className="ai-yolo-badge" title="Yolo mode">⚡</span>}
            <button
              className="ai-launch-btn"
              type="button"
              title={`Launch ${meta.name}${agent.yolo ? ' (yolo)' : ''}`}
              onClick={() => onLaunch(agent.id)}
            >
              <RunIcon />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Context toolbars ──────────────────────────────────────────────────────────

function FileContextToolbar({ file, onSave, onRun }: {
  file: OpenFile
  onSave: () => void
  onRun: () => void
}) {
  const breadcrumbs = file.path.replace(/\\/g, '/').split('/').filter(Boolean).slice(-3)
  return (
    <div className="context-toolbar">
      <div className="ctx-breadcrumb">
        <FileTabIcon className="ctx-icon" />
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="ctx-breadcrumb-item">
            {i > 0 && <span className="ctx-sep">›</span>}
            <span className={`ctx-crumb ${i === breadcrumbs.length - 1 ? 'active' : ''}`}>{crumb}</span>
          </span>
        ))}
      </div>
      <div className="ctx-actions">
        {file.isDirty && (
          <button className="ctx-btn save" type="button" title="Save (Ctrl+S)" onClick={onSave}>
            <SaveIcon />Save
          </button>
        )}
        <button className="ctx-btn run" type="button" title="Run script in terminal" onClick={onRun}>
          <RunIcon />Run
        </button>
      </div>
    </div>
  )
}

function TerminalContextToolbar({ tabId, title, status }: {
  tabId: string
  title: string
  status: string
}) {
  return (
    <div className="context-toolbar">
      <div className="ctx-breadcrumb">
        <TerminalIcon className="ctx-icon" />
        <span className="ctx-crumb active">{title}</span>
        <span className="ctx-sep">›</span>
        <span className={`ctx-status-text ${status}`}>{status}</span>
      </div>
      <div className="ctx-actions">
        <button className="ctx-btn" type="button" title="Restart" onClick={() => void termidiuApi.restartTab(tabId)}>
          <RestartIcon />Restart
        </button>
        <button className="ctx-btn" type="button" title="Stop" onClick={() => void termidiuApi.stopTab(tabId)}>
          <StopIcon />Stop
        </button>
        <button className="ctx-btn danger" type="button" title="Close" onClick={() => void termidiuApi.closeTab(tabId)}>
          <CloseIcon />Close
        </button>
      </div>
    </div>
  )
}

function getTabStatus(tabId: string, sessions: Record<string, TerminalSessionState>): string {
  const items = Object.values(sessions).filter(s => s.tabId === tabId)
  if (items.some(s => s.status === 'running' || s.status === 'starting')) return 'running'
  if (items.some(s => s.status === 'failed')) return 'failed'
  if (items.length === 0) return 'idle'
  return 'stopped'
}

// ── Pinned layouts ────────────────────────────────────────────────────────────

function PinnedLayoutsSection({ layouts, scripts, onPlay, onUnpinLayout, onUnpinScript }: {
  layouts: LayoutDescriptor[]
  scripts: ScriptDescriptor[]
  onPlay: (path: string) => void
  onUnpinLayout: (path: string) => void
  onUnpinScript: (path: string) => void
}) {
  const [open, setOpen] = useState(() => localStorage.getItem('pinnedOpen') !== 'false')
  return (
    <div className="pinned-section">
      <button
        className="sidebar-section-header no-project sidebar-collapsible-header"
        type="button"
        style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11, color: 'var(--text-dim)', width: '100%', display: 'flex', alignItems: 'center', gap: 4 }}
        onClick={() => setOpen(v => { localStorage.setItem('pinnedOpen', String(!v)); return !v })}
      >
        <SectionChevron open={open} />
        Pinned
      </button>
      {open && scripts.map(script => (
        <div key={script.fullPath} className="pinned-item">
          <ScriptIcon />
          <button
            className="pinned-label"
            type="button"
            title={script.fullPath}
            onClick={() => onPlay(script.fullPath)}
          >
            {script.name}
          </button>
          <button
            className="pinned-play"
            type="button"
            title="Run script"
            onClick={() => onPlay(script.fullPath)}
          >
            <RunIcon />
          </button>
          <button
            className="pinned-unpin"
            type="button"
            title="Unpin"
            onClick={() => onUnpinScript(script.fullPath)}
          >
            ×
          </button>
        </div>
      ))}
      {open && layouts.map(layout => (
        <div key={layout.fullPath} className="pinned-item">
          <LayoutIcon />
          <button
            className="pinned-label"
            type="button"
            title={layout.fullPath}
            onClick={() => onPlay(layout.fullPath)}
          >
            {layout.name.replace(/\.layout\.json$/, '')}
          </button>
          <button
            className="pinned-play"
            type="button"
            title="Run layout"
            onClick={() => onPlay(layout.fullPath)}
          >
            <RunIcon />
          </button>
          <button
            className="pinned-unpin"
            type="button"
            title="Unpin"
            onClick={() => onUnpinLayout(layout.fullPath)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

function SectionChevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ width: 12, height: 12, flexShrink: 0, transition: 'transform 150ms', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
      <path d="M5 3l6 5-6 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ width: 12, height: 12 }}>
      <path d="M10 3L4 8l6 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ width: 12, height: 12 }}>
      <path d="M6 3l6 5-6 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LayoutIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ width: 12, height: 12, flexShrink: 0, color: 'var(--accent)', opacity: 0.8 }}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1" />
      <path d="M1.5 6.5h13M6.5 6.5v7" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function ScriptIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ width: 12, height: 12, flexShrink: 0, color: 'var(--accent)', opacity: 0.8 }}>
      <path d="M4 1.5h5.5l3 3V14a.5.5 0 0 1-.5.5H4A.5.5 0 0 1 3.5 14V2A.5.5 0 0 1 4 1.5Z" stroke="currentColor" strokeWidth="1" />
      <path d="M9.5 1.5V4.5H12.5M5.5 8h5M5.5 10.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function AiLogoIcon({ id }: { id: AiAgentId }) {
  if (id === 'perplexity') return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ width: 14, height: 14 }}>
      <path d="M8 2v12M2 8h12M3.8 3.8l8.4 8.4M12.2 3.8l-8.4 8.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
  if (id === 'gemini') return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ width: 14, height: 14 }}>
      <path d="M8 1C8 4.866 11.134 8 15 8C11.134 8 8 11.134 8 15C8 11.134 4.866 8 1 8C4.866 8 8 4.866 8 1Z" />
    </svg>
  )
  if (id === 'claude') return (
    <svg viewBox="0 0 8 9" fill="currentColor" aria-hidden="true" style={{ width: 13, height: 14 }}>
      {/* antennae */}
      <rect x="1" y="0" width="2" height="1" />
      <rect x="5" y="0" width="2" height="1" />
      {/* head full rows */}
      <rect x="0" y="1" width="8" height="1" />
      {/* eye row: leave gaps at col 1-2 and col 5-6 */}
      <rect x="0" y="2" width="1" height="2" />
      <rect x="3" y="2" width="2" height="2" />
      <rect x="7" y="2" width="1" height="2" />
      {/* head bottom */}
      <rect x="0" y="4" width="8" height="1" />
      {/* body */}
      <rect x="0" y="5" width="8" height="1" />
      {/* legs */}
      <rect x="1" y="6" width="2" height="3" />
      <rect x="5" y="6" width="2" height="3" />
    </svg>
  )
  // codex / openai
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ width: 14, height: 14 }}>
      <path d="M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 004.981 4.18a5.985 5.985 0 00-3.998 2.9 6.046 6.046 0 00.743 7.097 5.98 5.98 0 00.51 4.911 6.051 6.051 0 006.515 2.9A5.985 5.985 0 0013.26 24a6.056 6.056 0 005.772-4.206 5.99 5.99 0 003.997-2.9 6.056 6.056 0 00-.747-7.073zM13.26 22.43a4.476 4.476 0 01-2.876-1.04c.146-.082.401-.22.585-.32l4.777-2.76a.775.775 0 00.393-.681v-6.737l2.02 1.168a.071.071 0 01.038.052v5.583a4.504 4.504 0 01-4.485 4.485zm-9.74-4.112a4.47 4.47 0 01-.535-3.014c.142.087.385.238.565.339l4.777 2.76a.774.774 0 00.785 0l5.833-3.369v2.332a.07.07 0 01-.028.061L9.74 19.87a4.5 4.5 0 01-6.22-1.554zm-1.26-9.733a4.473 4.473 0 012.342-1.968V11.7a.77.77 0 00.392.681l5.833 3.369-2.02 1.168a.07.07 0 01-.068.005L3.227 14.003a4.502 4.502 0 01-.967-5.418zm16.61 3.855l-5.833-3.369 2.02-1.168a.071.071 0 01.068-.004l5.726 3.31a4.5 4.5 0 01-.693 8.116V17.09a.77.77 0 00-.287-.55zm2.01-3.023c-.141-.087-.385-.238-.566-.339l-4.777-2.76a.776.776 0 00-.785 0L9.74 10.218V7.886a.07.07 0 01.028-.061l5.169-2.985a4.503 4.503 0 016.826 4.665zm-12.64 4.135l-2.02-1.168a.07.07 0 01-.038-.052V7.38a4.5 4.5 0 017.375-3.453 3.26 3.26 0 00-.142.08l-4.777 2.76a.775.775 0 00-.392.681zm1.097-2.365l2.597-1.5 2.598 1.5v3l-2.598 1.5-2.597-1.5V11.186z" />
    </svg>
  )
}

function ShellIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ width: 12, height: 12 }}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1" />
      <path d="M4 5.5l3 2.5-3 2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 10.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

function ScriptsOnlyIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M13.07 2.93l-1.41 1.41M4.34 11.66l-1.41 1.41" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}




function FileTabIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className ?? 'tab-file-icon'}>
      <path d="M4 1.5h5.5l3 3V14a.5.5 0 0 1-.5.5H4A.5.5 0 0 1 3.5 14V2A.5.5 0 0 1 4 1.5Z" stroke="currentColor" strokeWidth="1" />
      <path d="M9.5 1.5V4.5H12.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className ?? 'ctx-icon'}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1" />
      <path d="M4 5.5l3 2.5-3 2.5M9 10.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RunIcon() {
  return <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="ctx-btn-icon"><path d="M4 3l9 5-9 5V3Z" fill="currentColor" /></svg>
}

function SaveIcon() {
  return <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="ctx-btn-icon"><path d="M3 2h8l3 3v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1" /><path d="M5 2v4h6V2M8 9v4M6 11h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
}

function RestartIcon() {
  return <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="ctx-btn-icon"><path d="M13.5 8A5.5 5.5 0 1 1 8 2.5a5.5 5.5 0 0 1 3.9 1.6M13.5 2.5V5h-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function StopIcon() {
  return <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="ctx-btn-icon"><rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" /></svg>
}

function CloseIcon() {
  return <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="ctx-btn-icon"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
}
