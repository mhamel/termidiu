import { useEffect, useRef, useState } from 'react'
import { termidiuApi } from '../lib/termidiu-api'

type MenuItem =
  | { type: 'action'; label: string; shortcut?: string; action: () => void }
  | { type: 'separator' }

type MenuDef = { label: string; items: MenuItem[] }

function buildMenus(onOpenSettings: () => void): MenuDef[] {
  return [
    {
      label: 'File',
      items: [
        { type: 'action', label: 'Open Folder...', shortcut: 'Ctrl+O', action: () => { void termidiuApi.openProject() } },
        { type: 'separator' },
        { type: 'action', label: 'Quit', action: () => { void termidiuApi.menuAction('quit') } },
      ]
    },
    {
      label: 'Edit',
      items: [
        { type: 'action', label: 'Undo', shortcut: 'Ctrl+Z', action: () => { void termidiuApi.menuAction('undo') } },
        { type: 'action', label: 'Redo', shortcut: 'Ctrl+Y', action: () => { void termidiuApi.menuAction('redo') } },
        { type: 'separator' },
        { type: 'action', label: 'Cut', shortcut: 'Ctrl+X', action: () => { void termidiuApi.menuAction('cut') } },
        { type: 'action', label: 'Copy', shortcut: 'Ctrl+C', action: () => { void termidiuApi.menuAction('copy') } },
        { type: 'action', label: 'Paste', shortcut: 'Ctrl+V', action: () => { void termidiuApi.menuAction('paste') } },
        { type: 'action', label: 'Select All', shortcut: 'Ctrl+A', action: () => { void termidiuApi.menuAction('selectAll') } },
      ]
    },
    {
      label: 'View',
      items: [
        { type: 'action', label: 'Reload', shortcut: 'Ctrl+R', action: () => { void termidiuApi.menuAction('reload') } },
        { type: 'action', label: 'Toggle Dev Tools', shortcut: 'F12', action: () => { void termidiuApi.menuAction('toggleDevTools') } },
        { type: 'separator' },
        { type: 'action', label: 'Toggle Fullscreen', shortcut: 'F11', action: () => { void termidiuApi.menuAction('toggleFullscreen') } },
        { type: 'separator' },
        { type: 'action', label: 'Settings', action: onOpenSettings },
      ]
    },
  ]
}

type MenuBarProps = {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  onOpenSettings: () => void
}

export function MenuBar({ sidebarCollapsed, onToggleSidebar, onOpenSettings }: MenuBarProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  const MENUS = buildMenus(onOpenSettings)

  useEffect(() => {
    if (openIndex === null) return
    function onMouseDown(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenIndex(null)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenIndex(null)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openIndex])

  function handleMenuClick(i: number) {
    setOpenIndex(prev => prev === i ? null : i)
  }

  function handleItemClick(item: MenuItem) {
    if (item.type === 'action') {
      setOpenIndex(null)
      item.action()
    }
  }

  function handleMenuMouseEnter(i: number) {
    if (openIndex !== null) setOpenIndex(i)
  }

  return (
    <div className="menu-bar" ref={barRef}>
      <button
        className={`menu-sidebar-toggle ${sidebarCollapsed ? 'collapsed' : ''}`}
        type="button"
        title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        onClick={onToggleSidebar}
      >
        <SidebarIcon collapsed={sidebarCollapsed} />
      </button>
      {MENUS.map((menu, i) => (
        <div key={menu.label} className="menu-bar-item">
          <button
            className={`menu-bar-btn ${openIndex === i ? 'open' : ''}`}
            type="button"
            onClick={() => handleMenuClick(i)}
            onMouseEnter={() => handleMenuMouseEnter(i)}
          >
            {menu.label}
          </button>
          {openIndex === i && (
            <div className="menu-dropdown">
              {menu.items.map((item, j) =>
                item.type === 'separator'
                  ? <div key={j} className="menu-separator" />
                  : (
                    <button
                      key={j}
                      className="menu-dropdown-item"
                      type="button"
                      onClick={() => handleItemClick(item)}
                    >
                      <span className="menu-item-label">{item.label}</span>
                      {item.shortcut && <span className="menu-item-shortcut">{item.shortcut}</span>}
                    </button>
                  )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function SidebarIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ width: 14, height: 14 }}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
      <line x1="5.5" y1="1.5" x2="5.5" y2="14.5" stroke="currentColor" strokeWidth="1.1" />
      {collapsed && <rect x="2" y="2" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.4" />}
    </svg>
  )
}
