import { createContext, useContext, useState, useCallback } from 'react'

export type FontSizes = { tree: number; editor: number; terminal: number }

export const FONT_MIN = 8
export const FONT_MAX = 24
const DEFAULTS: FontSizes = { tree: 13, editor: 13, terminal: 13 }
const STORAGE_KEY = 'termidiu:fontSizes'

function clamp(v: unknown): number | undefined {
  return typeof v === 'number' ? Math.min(FONT_MAX, Math.max(FONT_MIN, v)) : undefined
}

export function loadFontSizes(): FontSizes {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const p = JSON.parse(raw) as Partial<FontSizes>
    return {
      tree:     clamp(p.tree)     ?? DEFAULTS.tree,
      editor:   clamp(p.editor)   ?? DEFAULTS.editor,
      terminal: clamp(p.terminal) ?? DEFAULTS.terminal,
    }
  } catch { return DEFAULTS }
}

function saveFontSizes(sizes: FontSizes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes))
}

export const FontSizesContext = createContext<FontSizes>(DEFAULTS)

export function useFontSizesState() {
  const [sizes, setSizes] = useState<FontSizes>(loadFontSizes)

  const update = useCallback((key: keyof FontSizes, delta: number) => {
    setSizes(prev => {
      const next = { ...prev, [key]: Math.min(FONT_MAX, Math.max(FONT_MIN, prev[key] + delta)) }
      saveFontSizes(next)
      return next
    })
  }, [])

  return { sizes, update }
}

export function useFontSizes(): FontSizes {
  return useContext(FontSizesContext)
}
