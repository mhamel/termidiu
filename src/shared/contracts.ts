export type SplitOrientation = 'horizontal' | 'vertical';

export type AiAgentId = 'claude' | 'gemini' | 'codex' | 'perplexity'
export type AiLayout = '1' | '1+1' | '1+2' | '2+2'

export interface AiAgentConfig {
  id: AiAgentId
  enabled: boolean
  layout: AiLayout
  yolo: boolean
}
export type SessionStatus = 'starting' | 'running' | 'exited' | 'failed';

export interface ScriptDescriptor {
  kind: 'script';
  id: string;
  name: string;
  fullPath: string;
  relativePath: string;
  workingDirectory: string;
}

export interface FolderNode {
  kind: 'folder';
  id: string;
  name: string;
  relativePath: string;
  children: ProjectTreeNode[];
}

export interface LayoutDescriptor {
  kind: 'layout';
  id: string;
  name: string;
  fullPath: string;
  relativePath: string;
  children: ScriptDescriptor[];
}

export type ProjectTreeNode = FolderNode | ScriptDescriptor | LayoutDescriptor;

export interface LaunchTerminalNode {
  kind: 'terminal';
  sessionId: string;
  title: string;
  cwd: string;
  launch: SessionLaunch;
}

export interface LaunchSplitNode {
  kind: 'split';
  orientation: SplitOrientation;
  children: LaunchLayoutNode[];
}

export type LaunchLayoutNode = LaunchTerminalNode | LaunchSplitNode;

export interface SessionLaunch {
  mode: 'file' | 'command';
  value: string;
}

export interface WorkspaceTab {
  id: string;
  scriptPath: string;
  title: string;
  layout: LaunchLayoutNode;
}

export interface TerminalSessionState {
  id: string;
  tabId: string;
  title: string;
  cwd: string;
  status: SessionStatus;
  processId: number | null;
  exitCode: number | null;
  error: string | null;
}

export interface AppState {
  currentProjectRoot: string | null;
  recentProjectRoots: string[];
  projectTree: FolderNode | null;
  pinnedLayouts: LayoutDescriptor[];
  pinnedScripts: ScriptDescriptor[];
  aiAgents: AiAgentConfig[];
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  sessions: Record<string, TerminalSessionState>;
  lastError: string | null;
}

export interface AppSettings {
  lastProjectRoot: string | null;
  recentProjectRoots: string[];
  pinnedLayouts: string[];
  pinnedScripts: string[];
  aiAgents: AiAgentConfig[];
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface TerminalOutputEvent {
  sessionId: string;
  data: string;
}

export interface StatePayload {
  state: AppState;
}

export interface RendererApi {
  getInitialState(): Promise<AppState>;
  openProject(): Promise<AppState>;
  reopenProject(rootPath: string): Promise<AppState>;
  activateTab(tabId: string): Promise<AppState>;
  closeTab(tabId: string): Promise<AppState>;
  playScript(scriptPath: string): Promise<ActionResult>;
  stopTab(tabId: string): Promise<ActionResult>;
  stopSession(sessionId: string): Promise<ActionResult>;
  restartTab(tabId: string): Promise<ActionResult>;
  writeTerminal(sessionId: string, data: string): void;
  resizeTerminal(sessionId: string, cols: number, rows: number): void;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<ActionResult>;
  deleteFile(path: string): Promise<ActionResult>;
  moveFile(src: string, dest: string): Promise<ActionResult>;
  createDir(path: string): Promise<ActionResult>;
  createSession(params: { id: string; tabId: string; title: string; cwd: string; launch: SessionLaunch }): Promise<ActionResult>;
  pinLayout(path: string): Promise<AppState>;
  unpinLayout(path: string): Promise<AppState>;
  openShell(): Promise<ActionResult>;
  pinScript(path: string): Promise<AppState>;
  unpinScript(path: string): Promise<AppState>;
  saveAiAgents(agents: AiAgentConfig[]): Promise<AppState>;
  launchAiAgent(id: AiAgentId): Promise<ActionResult>;
  menuAction(action: string): Promise<void>;
  onStateChanged(listener: (payload: StatePayload) => void): () => void;
  onTerminalOutput(listener: (payload: TerminalOutputEvent) => void): () => void;
}
