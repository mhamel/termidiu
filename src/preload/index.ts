import { contextBridge, ipcRenderer } from 'electron';
import type {
  ActionResult,
  AiAgentConfig,
  AiAgentId,
  AppState,
  RendererApi,
  StatePayload,
  TerminalOutputEvent
} from '../shared/contracts';

const api: RendererApi = {
  getInitialState: () => ipcRenderer.invoke('termidiu:get-initial-state') as Promise<AppState>,
  openProject: () => ipcRenderer.invoke('termidiu:open-project') as Promise<AppState>,
  reopenProject: (rootPath: string) =>
    ipcRenderer.invoke('termidiu:reopen-project', rootPath) as Promise<AppState>,
  activateTab: (tabId: string) =>
    ipcRenderer.invoke('termidiu:activate-tab', tabId) as Promise<AppState>,
  closeTab: (tabId: string) =>
    ipcRenderer.invoke('termidiu:close-tab', tabId) as Promise<AppState>,
  playScript: (scriptPath: string) =>
    ipcRenderer.invoke('termidiu:play-script', scriptPath) as Promise<ActionResult>,
  stopTab: (tabId: string) =>
    ipcRenderer.invoke('termidiu:stop-tab', tabId) as Promise<ActionResult>,
  stopSession: (sessionId: string) =>
    ipcRenderer.invoke('termidiu:stop-session', sessionId) as Promise<ActionResult>,
  restartTab: (tabId: string) =>
    ipcRenderer.invoke('termidiu:restart-tab', tabId) as Promise<ActionResult>,
  writeTerminal: (sessionId: string, data: string) => {
    ipcRenderer.send('termidiu:write-terminal', sessionId, data);
  },
  readFile: (path: string) =>
    ipcRenderer.invoke('termidiu:read-file', path) as Promise<string>,
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke('termidiu:write-file', path, content) as Promise<ActionResult>,
  deleteFile: (path: string) =>
    ipcRenderer.invoke('termidiu:delete-file', path) as Promise<ActionResult>,
  moveFile: (src: string, dest: string) =>
    ipcRenderer.invoke('termidiu:move-file', src, dest) as Promise<ActionResult>,
  createDir: (path: string) =>
    ipcRenderer.invoke('termidiu:create-dir', path) as Promise<ActionResult>,
  openShell: () =>
    ipcRenderer.invoke('termidiu:open-shell') as Promise<import('../shared/contracts').ActionResult>,
  pinLayout: (path: string) =>
    ipcRenderer.invoke('termidiu:pin-layout', path) as Promise<AppState>,
  unpinLayout: (path: string) =>
    ipcRenderer.invoke('termidiu:unpin-layout', path) as Promise<AppState>,
  pinScript: (path: string) =>
    ipcRenderer.invoke('termidiu:pin-script', path) as Promise<AppState>,
  unpinScript: (path: string) =>
    ipcRenderer.invoke('termidiu:unpin-script', path) as Promise<AppState>,
  saveAiAgents: (agents: AiAgentConfig[]) =>
    ipcRenderer.invoke('termidiu:save-ai-agents', agents) as Promise<AppState>,
  launchAiAgent: (id: AiAgentId) =>
    ipcRenderer.invoke('termidiu:launch-ai-agent', id) as Promise<ActionResult>,
  resizeTerminal: (sessionId: string, cols: number, rows: number) => {
    ipcRenderer.send('termidiu:resize-terminal', sessionId, cols, rows);
  },
  createSession: (params) =>
    ipcRenderer.invoke('termidiu:create-session', params) as Promise<import('../shared/contracts').ActionResult>,
  menuAction: (action: string) =>
    ipcRenderer.invoke('termidiu:menu-action', action) as Promise<void>,
  onStateChanged: listener => bindListener<StatePayload>('termidiu:state', listener),
  onTerminalOutput: listener => bindListener<TerminalOutputEvent>('termidiu:terminal-output', listener)
};

contextBridge.exposeInMainWorld('termidiu', api);

function bindListener<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrapped = (_event: Electron.IpcRendererEvent, payload: T): void => listener(payload);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

