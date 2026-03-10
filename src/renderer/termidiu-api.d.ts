export type { AppState, ProjectTreeNode, WorkspaceTab, LaunchLayoutNode, TerminalSessionState } from '../shared/contracts'

// Electron webview tag JSX support
declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        style?: React.CSSProperties
      }
    }
  }
}

