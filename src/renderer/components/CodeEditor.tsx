import { useEffect, useRef } from 'react'
import { basicSetup, EditorView } from 'codemirror'
import { EditorState, Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { StreamLanguage } from '@codemirror/language'
import { powerShell } from '@codemirror/legacy-modes/mode/powershell'
import { oneDark } from '@codemirror/theme-one-dark'
import { useFontSizes } from '../hooks/use-font-sizes'

type CodeEditorProps = {
  path: string
  content: string
  onChange: (content: string) => void
  onSave: (content: string) => Promise<void>
}

function makeVsCodeTheme(fontSize: number) { return EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: '#000000',
  },
  '.cm-scroller': {
    fontFamily: "'Cascadia Mono', 'Consolas', 'Courier New', monospace",
    fontSize: `${fontSize}px`,
    lineHeight: '1.6',
    overflow: 'auto',
  },
  '.cm-gutters': {
    backgroundColor: '#000000',
    borderRight: '1px solid #1a1a1a',
    color: '#555555',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 10px 0 6px',
    minWidth: '36px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#0d0d0d',
    color: '#888888',
  },
  '.cm-activeLine': {
    backgroundColor: '#0d0d0d',
  },
  '.cm-cursor': {
    borderLeftColor: '#aeafad',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: '#3a66914d',
  },
  '.cm-focused .cm-selectionBackground': {
    backgroundColor: '#3a6691',
  },
}) }

function getLanguageExtension(path: string) {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'ps1' || ext === 'psm1' || ext === 'psd1') {
    return StreamLanguage.define(powerShell)
  }
  return null
}

export function CodeEditor({ path, content, onChange, onSave }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)
  const { editor: fontSize } = useFontSizes()

  onChangeRef.current = onChange
  onSaveRef.current = onSave

  useEffect(() => {
    if (!containerRef.current) return

    const lang = getLanguageExtension(path)

    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        ...(lang ? [lang] : []),
        oneDark,
        makeVsCodeTheme(fontSize),
        Prec.highest(
          keymap.of([
            {
              key: 'Ctrl-s',
              mac: 'Cmd-s',
              run: view => {
                void onSaveRef.current(view.state.doc.toString())
                return true
              },
            },
          ])
        ),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
      ],
    })

    const view = new EditorView({ state, parent: containerRef.current })

    return () => view.destroy()
  }, [path, fontSize]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="code-editor-host" />
}
