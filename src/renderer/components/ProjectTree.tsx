import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import type { LayoutDescriptor, ProjectTreeNode as TreeNode, ScriptDescriptor } from '../../shared/contracts'
import { termidiuApi } from '../lib/termidiu-api'

type DragDropHandlers = {
  dragSrc: React.MutableRefObject<{ path: string; name: string } | null>
  dropTarget: string | null
  onItemDragStart: (path: string, name: string, e: React.DragEvent) => void
  onFolderDragOver: (folderPath: string, e: React.DragEvent) => void
  onFolderDrop: (destFolderPath: string, e: React.DragEvent) => void
  onDragEnd: () => void
}

function joinPaths(base: string, name: string): string {
  return base.replace(/[/\\]+$/, '') + '\\' + name
}

type InlineCreating = { folderFullPath: string; type: 'file' | 'folder' } | null

type ContextMenuState = {
  x: number
  y: number
  fullPath: string
  relativePath: string
  kind: 'folder' | 'script' | 'layout'
} | null

export type ProjectTreeHandle = {
  startCreate: (type: 'file' | 'folder') => void
}

type ProjectTreeProps = {
  items: TreeNode[]
  projectRoot: string | null
  pinnedLayoutPaths: Set<string>
  pinnedScriptPaths: Set<string>
  scriptsOnly: boolean
  onScriptClick: (path: string, name: string) => void
}

function filterScriptsOnly(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap(node => {
    if (node.kind === 'script' || node.kind === 'layout') return [node]
    const filteredChildren = filterScriptsOnly(node.children)
    if (filteredChildren.length === 0) return []
    return [{ ...node, children: filteredChildren }]
  })
}

export const ProjectTree = forwardRef<ProjectTreeHandle, ProjectTreeProps>(
  function ProjectTree({ items, projectRoot, pinnedLayoutPaths, pinnedScriptPaths, scriptsOnly, onScriptClick }, ref) {
    const displayItems = scriptsOnly ? filterScriptsOnly(items) : items
    const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
    const [inlineCreating, setInlineCreating] = useState<InlineCreating>(null)
    const dragSrc = useRef<{ path: string; name: string } | null>(null)
    const [dropTarget, setDropTarget] = useState<string | null>(null)

    const dnd: DragDropHandlers = {
      dragSrc,
      dropTarget,
      onItemDragStart(path, name, e) {
        dragSrc.current = { path, name }
        e.dataTransfer.effectAllowed = 'move'
      },
      onFolderDragOver(folderPath, e) {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        if (dropTarget !== folderPath) setDropTarget(folderPath)
      },
      onFolderDrop(destFolderPath, e) {
        e.preventDefault()
        e.stopPropagation()
        setDropTarget(null)
        const src = dragSrc.current
        dragSrc.current = null
        if (!src) return
        const srcNorm = src.path.replace(/\//g, '\\')
        const destNorm = destFolderPath.replace(/\//g, '\\')
        const srcParent = srcNorm.split('\\').slice(0, -1).join('\\')
        if (srcParent === destNorm) return
        if (destNorm.startsWith(srcNorm + '\\')) return
        const destPath = joinPaths(destFolderPath, src.name)
        void termidiuApi.moveFile(src.path, destPath).then(result => {
          if (!result.ok) window.alert(`Failed to move: ${result.error}`)
        })
      },
      onDragEnd() {
        dragSrc.current = null
        setDropTarget(null)
      }
    }

    const closeMenu = useCallback(() => setContextMenu(null), [])

    useImperativeHandle(ref, () => ({
      startCreate(type: 'file' | 'folder') {
        if (projectRoot) setInlineCreating({ folderFullPath: projectRoot, type })
      }
    }), [projectRoot])

    useEffect(() => {
      if (!contextMenu) return
      const handleClick = () => closeMenu()
      const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu() }
      document.addEventListener('click', handleClick)
      document.addEventListener('keydown', handleEsc)
      return () => {
        document.removeEventListener('click', handleClick)
        document.removeEventListener('keydown', handleEsc)
      }
    }, [contextMenu, closeMenu])

    async function handleConfirmCreate(folderFullPath: string, name: string, type: 'file' | 'folder') {
      setInlineCreating(null)
      if (!name.trim()) return
      const fullPath = joinPaths(folderFullPath, name.trim())
      if (type === 'file') {
        const result = await termidiuApi.writeFile(fullPath, '')
        if (result.ok) onScriptClick(fullPath, name.trim())
      } else {
        await termidiuApi.createDir(fullPath)
      }
    }

    function handleStartCreate(folderFullPath: string, type: 'file' | 'folder') {
      setContextMenu(null)
      setInlineCreating({ folderFullPath, type })
    }

    if (displayItems.length === 0 && !inlineCreating) {
      return (
        <section className="project-tree empty">
          <p>No scripts detected yet.</p>
        </section>
      )
    }

    return (
      <section className="project-tree">
        <div
          className={`tree-scroll ${dropTarget === projectRoot ? 'drop-target' : ''}`}
          onDragOver={e => { if (projectRoot) dnd.onFolderDragOver(projectRoot, e) }}
          onDrop={e => { if (projectRoot) dnd.onFolderDrop(projectRoot, e) }}
        >
          {inlineCreating?.folderFullPath === projectRoot ? (
            <InlineInput
              type={inlineCreating.type}
              depth={0}
              onConfirm={(name) => void handleConfirmCreate(projectRoot!, name, inlineCreating.type)}
              onCancel={() => setInlineCreating(null)}
            />
          ) : null}

          {displayItems.map(item => (
            <ProjectTreeNodeEl
              key={item.id}
              item={item}
              depth={0}
              projectRoot={projectRoot}
              onScriptClick={onScriptClick}
              onContextMenu={setContextMenu}
              inlineCreating={inlineCreating}
              onStartCreate={handleStartCreate}
              onConfirmCreate={handleConfirmCreate}
              onCancelCreate={() => setInlineCreating(null)}
              dnd={dnd}
            />
          ))}
        </div>

        {contextMenu ? (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            fullPath={contextMenu.fullPath}
            relativePath={contextMenu.relativePath}
            kind={contextMenu.kind}
            isPinned={contextMenu.kind === 'layout' ? pinnedLayoutPaths.has(contextMenu.fullPath) : pinnedScriptPaths.has(contextMenu.fullPath)}
            onClose={closeMenu}
            onStartCreate={handleStartCreate}
          />
        ) : null}
      </section>
    )
  }
)

// ── Shared create props ────────────────────────────────────────────────────────

type SharedCreateProps = {
  inlineCreating: InlineCreating
  onStartCreate: (folderFullPath: string, type: 'file' | 'folder') => void
  onConfirmCreate: (folderFullPath: string, name: string, type: 'file' | 'folder') => void
  onCancelCreate: () => void
}

// ── Tree node dispatcher ───────────────────────────────────────────────────────

type ProjectTreeNodeElProps = {
  item: TreeNode
  depth: number
  projectRoot: string | null
  onScriptClick: (path: string, name: string) => void
  onContextMenu: (state: ContextMenuState) => void
  dnd: DragDropHandlers
} & SharedCreateProps

function ProjectTreeNodeEl({ item, depth, projectRoot, onScriptClick, onContextMenu, inlineCreating, onStartCreate, onConfirmCreate, onCancelCreate, dnd }: ProjectTreeNodeElProps) {
  const [expanded, setExpanded] = useState(false)

  if (item.kind === 'layout') {
    return (
      <LayoutTreeNode
        item={item}
        depth={depth}
        onScriptClick={onScriptClick}
        onContextMenu={onContextMenu}
        expanded={expanded}
        onToggle={() => setExpanded(v => !v)}
        dnd={dnd}
      />
    )
  }

  if (item.kind === 'folder') {
    const folderFullPath = projectRoot
      ? (item.relativePath ? joinPaths(projectRoot, item.relativePath) : projectRoot)
      : item.relativePath

    function handleContextMenu(e: React.MouseEvent) {
      e.preventDefault()
      e.stopPropagation()
      onContextMenu({ x: e.clientX, y: e.clientY, fullPath: folderFullPath, relativePath: item.relativePath, kind: 'folder' })
    }

    const isCreatingHere = inlineCreating?.folderFullPath === folderFullPath

    return (
      <div className="tree-node">
        <div
          className={`tree-row ${dnd.dropTarget === folderFullPath ? 'drop-target' : ''}`}
          style={{ paddingLeft: `${depth * 18 + 8}px` }}
          onContextMenu={handleContextMenu}
          draggable
          onDragStart={e => dnd.onItemDragStart(folderFullPath, item.name, e)}
          onDragOver={e => dnd.onFolderDragOver(folderFullPath, e)}
          onDrop={e => dnd.onFolderDrop(folderFullPath, e)}
          onDragEnd={dnd.onDragEnd}
        >
          <button
            className="tree-toggle"
            type="button"
            onClick={() => setExpanded(v => !v)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▾' : '▸'}
          </button>
          <span className="tree-label folder">{item.name}</span>
          <div className="folder-actions">
            <button
              className="folder-action-btn"
              type="button"
              title="New File"
              onClick={(e) => { e.stopPropagation(); setExpanded(true); onStartCreate(folderFullPath, 'file') }}
            >
              <NewFileIcon />
            </button>
            <button
              className="folder-action-btn"
              type="button"
              title="New Folder"
              onClick={(e) => { e.stopPropagation(); setExpanded(true); onStartCreate(folderFullPath, 'folder') }}
            >
              <NewFolderIcon />
            </button>
          </div>
        </div>

        {expanded ? (
          <div className="tree-children">
            {isCreatingHere ? (
              <InlineInput
                type={inlineCreating!.type}
                depth={depth + 1}
                onConfirm={(name) => void onConfirmCreate(folderFullPath, name, inlineCreating!.type)}
                onCancel={onCancelCreate}
              />
            ) : null}
            {item.children.map(child => (
              <ProjectTreeNodeEl
                key={child.id}
                item={child}
                depth={depth + 1}
                projectRoot={projectRoot}
                onScriptClick={onScriptClick}
                onContextMenu={onContextMenu}
                inlineCreating={inlineCreating}
                onStartCreate={onStartCreate}
                onConfirmCreate={onConfirmCreate}
                onCancelCreate={onCancelCreate}
                dnd={dnd}
              />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  // Script
  function handleScriptContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onContextMenu({ x: e.clientX, y: e.clientY, fullPath: item.fullPath, relativePath: item.relativePath, kind: 'script' })
  }

  return (
    <div className="tree-node">
      <div
        className="tree-row"
        style={{ paddingLeft: `${depth * 18 + 8}px` }}
        onContextMenu={handleScriptContextMenu}
        draggable
        onDragStart={e => dnd.onItemDragStart(item.fullPath, item.name, e)}
        onDragEnd={dnd.onDragEnd}
      >
        <span className="tree-toggle placeholder">·</span>
        <button
          className="tree-label script"
          type="button"
          title={`Open ${item.name}`}
          onClick={() => onScriptClick(item.fullPath, item.name)}
        >
          {item.name}
        </button>
        <button
          className="play-button"
          type="button"
          aria-label={`Run ${item.name}`}
          title={`Run ${item.name}`}
          onClick={() => void termidiuApi.playScript(item.fullPath)}
        >
          <PlayIcon />
        </button>
      </div>
    </div>
  )
}

// ── Layout tree node ───────────────────────────────────────────────────────────

type LayoutTreeNodeProps = {
  item: LayoutDescriptor
  depth: number
  onScriptClick: (path: string, name: string) => void
  onContextMenu: (state: ContextMenuState) => void
  expanded: boolean
  onToggle: () => void
  dnd: DragDropHandlers
}

function LayoutTreeNode({ item, depth, onScriptClick, onContextMenu, expanded, onToggle, dnd }: LayoutTreeNodeProps) {
  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onContextMenu({ x: e.clientX, y: e.clientY, fullPath: item.fullPath, relativePath: item.relativePath, kind: 'layout' })
  }

  return (
    <div className="tree-node">
      <div
        className="tree-row"
        style={{ paddingLeft: `${depth * 18 + 8}px` }}
        onContextMenu={handleContextMenu}
        draggable
        onDragStart={e => dnd.onItemDragStart(item.fullPath, item.name, e)}
        onDragEnd={dnd.onDragEnd}
      >
        <button className="tree-toggle" type="button" onClick={onToggle} aria-label={expanded ? 'Collapse' : 'Expand'}>
          {expanded ? '▾' : '▸'}
        </button>
        <button
          className="tree-label layout-file"
          type="button"
          title={`Open ${item.name}`}
          onClick={() => onScriptClick(item.fullPath, item.name)}
        >
          <LayoutIcon />
          {item.name}
        </button>
        <button
          className="play-button"
          type="button"
          aria-label={`Run ${item.name}`}
          title="Run layout"
          onClick={() => void termidiuApi.playScript(item.fullPath)}
        >
          <PlayIcon />
        </button>
      </div>

      {expanded && item.children.length > 0 ? (
        <div className="tree-children">
          {item.children.map(child => (
            <LayoutChildScript
              key={child.id}
              item={child}
              depth={depth + 1}
              onScriptClick={onScriptClick}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

type LayoutChildScriptProps = {
  item: ScriptDescriptor
  depth: number
  onScriptClick: (path: string, name: string) => void
  onContextMenu: (state: ContextMenuState) => void
}

function LayoutChildScript({ item, depth, onScriptClick, onContextMenu }: LayoutChildScriptProps) {
  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onContextMenu({ x: e.clientX, y: e.clientY, fullPath: item.fullPath, relativePath: item.relativePath, kind: 'script' })
  }

  return (
    <div className="tree-node">
      <div
        className="tree-row"
        style={{ paddingLeft: `${depth * 18 + 8}px` }}
        onContextMenu={handleContextMenu}
      >
        <span className="tree-toggle placeholder">·</span>
        <button
          className="tree-label script"
          type="button"
          title={`Open ${item.name}`}
          onClick={() => onScriptClick(item.fullPath, item.name)}
        >
          {item.name}
        </button>
      </div>
    </div>
  )
}

// ── Inline creation input ──────────────────────────────────────────────────────

function InlineInput({ type, depth, onConfirm, onCancel }: {
  type: 'file' | 'folder'
  depth: number
  onConfirm: (name: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const committed = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      committed.current = true
      if (value.trim()) onConfirm(value.trim())
      else onCancel()
    } else if (e.key === 'Escape') {
      committed.current = true
      onCancel()
    }
  }

  function handleBlur() {
    if (!committed.current) onCancel()
  }

  return (
    <div className="inline-create-row" style={{ paddingLeft: `${depth * 18 + 8}px` }}>
      <span className="tree-toggle placeholder">·</span>
      {type === 'folder' ? <FolderIcon /> : <FileIcon />}
      <input
        ref={inputRef}
        className="inline-create-input"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={type === 'file' ? 'filename.ps1' : 'folder-name'}
        spellCheck={false}
        autoComplete="off"
      />
    </div>
  )
}

// ── Context menu ───────────────────────────────────────────────────────────────

type ContextMenuProps = {
  x: number
  y: number
  fullPath: string
  relativePath: string
  kind: 'folder' | 'script' | 'layout'
  isPinned: boolean
  onClose: () => void
  onStartCreate: (folderFullPath: string, type: 'file' | 'folder') => void
}

function ContextMenu({ x, y, fullPath, relativePath, kind, isPinned, onClose, onStartCreate }: ContextMenuProps) {
  function copyAndClose(text: string) {
    void navigator.clipboard.writeText(text)
    onClose()
  }

  async function handleDelete() {
    onClose()
    const name = fullPath.replace(/\\/g, '/').split('/').pop() ?? fullPath
    if (!window.confirm(`Delete "${name}"?\n\nThis cannot be undone.`)) return
    const result = await termidiuApi.deleteFile(fullPath)
    if (!result.ok) window.alert(`Failed to delete: ${result.error}`)
  }

  async function handlePin() {
    onClose()
    if (kind === 'layout') await termidiuApi.pinLayout(fullPath)
    else await termidiuApi.pinScript(fullPath)
  }

  async function handleUnpin() {
    onClose()
    if (kind === 'layout') await termidiuApi.unpinLayout(fullPath)
    else await termidiuApi.unpinScript(fullPath)
  }

  return (
    <div
      className="ctx-menu"
      style={{ position: 'fixed', top: y, left: x, zIndex: 9999 }}
      onClick={e => e.stopPropagation()}
    >
      {(kind === 'layout' || kind === 'script') ? (
        <>
          {isPinned ? (
            <button className="ctx-menu-item" type="button" onClick={() => void handleUnpin()}>
              <PinIcon />Unpin
            </button>
          ) : (
            <button className="ctx-menu-item" type="button" onClick={() => void handlePin()}>
              <PinIcon />Pin to top
            </button>
          )}
          <div className="ctx-menu-separator" />
        </>
      ) : null}
      {kind === 'folder' ? (
        <>
          <button className="ctx-menu-item" type="button" onClick={() => { onClose(); onStartCreate(fullPath, 'file') }}>
            <NewFileIcon small />New File
          </button>
          <button className="ctx-menu-item" type="button" onClick={() => { onClose(); onStartCreate(fullPath, 'folder') }}>
            <NewFolderIcon small />New Folder
          </button>
          <div className="ctx-menu-separator" />
        </>
      ) : null}
      <button className="ctx-menu-item" type="button" onClick={() => copyAndClose(fullPath)}>
        <CopyIcon />Copy Path
      </button>
      {kind !== 'folder' ? (
        <button className="ctx-menu-item" type="button" onClick={() => copyAndClose(relativePath)}>
          <CopyIcon />Copy Relative Path
        </button>
      ) : null}
      <div className="ctx-menu-separator" />
      <button className="ctx-menu-item danger" type="button" onClick={() => void handleDelete()}>
        <TrashIcon />{kind === 'folder' ? 'Delete Folder' : 'Delete'}
      </button>
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function LayoutIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="tree-layout-icon">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1" />
      <path d="M1.5 6.5h13M6.5 6.5v7" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="M4 3.5v9l8-4.5-8-4.5Z" fill="currentColor" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="ctx-menu-icon">
      <rect x="5.5" y="5.5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1" />
      <path d="M3.5 10.5H2a.5.5 0 0 1-.5-.5V2A.5.5 0 0 1 2 1.5h8a.5.5 0 0 1 .5.5v1.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="ctx-menu-icon">
      <path d="M2.5 4.5h11M6 4.5V3a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1.5M4.5 4.5l.75 8a.5.5 0 0 0 .5.5h5.5a.5.5 0 0 0 .5-.5l.75-8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

export function NewFileIcon({ small }: { small?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="ctx-menu-icon" style={{ width: small ? 13 : 14, height: small ? 13 : 14 }}>
      <path d="M4 1.5h5.5l3 3V14a.5.5 0 0 1-.5.5H4A.5.5 0 0 1 3.5 14V2A.5.5 0 0 1 4 1.5Z" stroke="currentColor" strokeWidth="1" />
      <path d="M9.5 1.5V4.5H12.5" stroke="currentColor" strokeWidth="1" />
      <path d="M8 7.5v3M6.5 9h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

export function NewFolderIcon({ small }: { small?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="ctx-menu-icon" style={{ width: small ? 13 : 14, height: small ? 13 : 14 }}>
      <path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3.172a1.5 1.5 0 0 1 1.06.44l.829.828A1.5 1.5 0 0 0 9.12 4.3H13A1.5 1.5 0 0 1 14.5 5.8v6.2A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12V4Z" stroke="currentColor" strokeWidth="1" />
      <path d="M8 7v3M6.5 8.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="ctx-menu-icon">
      <path d="M9.5 2.5L13.5 6.5L10 8.5L9 13L7 11L3 15M6.5 9L4 6.5L8 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ width: 12, height: 12, flexShrink: 0, color: 'var(--text-dim)' }}>
      <path d="M4 1.5h5.5l3 3V14a.5.5 0 0 1-.5.5H4A.5.5 0 0 1 3.5 14V2A.5.5 0 0 1 4 1.5Z" stroke="currentColor" strokeWidth="1" />
      <path d="M9.5 1.5V4.5H12.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ width: 12, height: 12, flexShrink: 0, color: 'var(--text-dim)' }}>
      <path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3.172a1.5 1.5 0 0 1 1.06.44l.829.828A1.5 1.5 0 0 0 9.12 4.3H13A1.5 1.5 0 0 1 14.5 5.8v6.2A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12V4Z" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}
