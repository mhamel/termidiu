import { CodeEditor } from './CodeEditor'

export type OpenFile = {
  path: string
  title: string
  content: string
  isDirty: boolean
}

type FileEditorPanelProps = {
  file: OpenFile
  onChange: (content: string) => void
  onSave: (content: string) => Promise<void>
}

export function FileEditorPanel({ file, onChange, onSave }: FileEditorPanelProps) {
  return (
    <CodeEditor
      key={file.path}
      path={file.path}
      content={file.content}
      onChange={onChange}
      onSave={onSave}
    />
  )
}
