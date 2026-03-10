import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron';
import { buildTabForLayout, buildTabForScript, collectTerminalNodes } from '../shared/layout';
import { flattenLayouts, flattenScripts, scanProject } from '../shared/project-scanner';
import type {
  ActionResult,
  AiAgentId,
  AiLayout,
  AppSettings,
  AppState,
  LaunchLayoutNode,
  LayoutDescriptor,
  ScriptDescriptor,
  StatePayload,
  TerminalOutputEvent,
  WorkspaceTab
} from '../shared/contracts';

const AI_DEFS: Record<AiAgentId, { name: string; cmd: string; yoloCmd: string }> = {
  claude: { name: 'Claude', cmd: '$env:CLAUDECODE = $null; claude --dangerously-skip-permissions', yoloCmd: '$env:CLAUDECODE = $null; claude --dangerously-skip-permissions' },
  gemini: { name: 'Gemini', cmd: 'gemini', yoloCmd: 'gemini --yolo' },
  codex:  { name: 'Codex',  cmd: 'codex',  yoloCmd: 'codex --yolo' },
};

function buildAiLayout(cmd: string, layout: AiLayout, cwd: string): LaunchLayoutNode {
  const t = () => ({
    kind: 'terminal' as const,
    sessionId: randomUUID(),
    title: cmd.split(' ')[0],
    cwd,
    launch: { mode: 'command' as const, value: cmd }
  });
  if (layout === '1') return t();
  if (layout === '1+1') return { kind: 'split', orientation: 'horizontal', children: [t(), t()] };
  if (layout === '1+2') return { kind: 'split', orientation: 'horizontal', children: [t(), { kind: 'split', orientation: 'vertical', children: [t(), t()] }] };
  return { kind: 'split', orientation: 'horizontal', children: [{ kind: 'split', orientation: 'vertical', children: [t(), t()] }, { kind: 'split', orientation: 'vertical', children: [t(), t()] }] };
}
import { ProjectWatcher } from './services/project-watcher';
import { SettingsStore } from './services/settings-store';
import { TerminalManager } from './services/terminal-manager';

export class AppController {
  private readonly settingsStore = new SettingsStore();

  private readonly watcher = new ProjectWatcher();

  private readonly terminalManager = new TerminalManager(
    (sessionId, data) => this.emitTerminalOutput({ sessionId, data }),
    session => this.updateSession(session)
  );

  private window: BrowserWindow | null = null;

  private settings: AppSettings = { lastProjectRoot: null, recentProjectRoots: [], pinnedLayouts: [], pinnedScripts: [], aiAgents: [] };

  private state: AppState = {
    currentProjectRoot: null,
    recentProjectRoots: [],
    projectTree: null,
    pinnedLayouts: [],
    pinnedScripts: [],
    aiAgents: [],
    tabs: [],
    activeTabId: null,
    sessions: {},
    lastError: null
  };

  setWindow(window: BrowserWindow): void {
    this.window = window;
  }

  async initialize(): Promise<void> {
    this.settings = await this.settingsStore.load();
    this.state.recentProjectRoots = this.settings.recentProjectRoots;
    this.state.aiAgents = this.settings.aiAgents;

    const envRoot = process.env.TERMIDIU_PROJECT_ROOT;
    const initialRoot = envRoot && existsSync(envRoot)
      ? envRoot
      : this.settings.lastProjectRoot && existsSync(this.settings.lastProjectRoot)
        ? this.settings.lastProjectRoot
        : null;

    if (initialRoot) {
      await this.loadProject(initialRoot);
    }
  }

  getState(): AppState {
    return structuredClone(this.state);
  }

  async openProject(): Promise<AppState> {
    this.clearError();

    const dialogOptions: OpenDialogOptions = {
      title: 'Open Project Folder',
      buttonLabel: 'Open Project',
      properties: ['openDirectory']
    };

    const result = this.window
      ? await dialog.showOpenDialog(this.window, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || result.filePaths.length === 0) {
      return this.getState();
    }

    try {
      await this.loadProject(result.filePaths[0]);
    } catch (error) {
      this.setError(error instanceof Error ? error.message : String(error));
    }

    return this.getState();
  }

  async reopenProject(rootPath: string): Promise<AppState> {
    this.clearError();

    try {
      await this.loadProject(rootPath);
    } catch (error) {
      this.setError(error instanceof Error ? error.message : String(error));
    }

    return this.getState();
  }

  activateTab(tabId: string): AppState {
    if (this.state.tabs.some(tab => tab.id === tabId)) {
      this.state.activeTabId = tabId;
      this.emitState();
    }

    return this.getState();
  }

  async closeTab(tabId: string): Promise<AppState> {
    await this.stopTab(tabId);
    this.state.tabs = this.state.tabs.filter(tab => tab.id !== tabId);
    for (const session of Object.values(this.state.sessions)) {
      if (session.tabId === tabId) {
        delete this.state.sessions[session.id];
      }
    }

    if (this.state.activeTabId === tabId) {
      this.state.activeTabId = this.state.tabs.at(-1)?.id ?? null;
    }

    this.emitState();
    return this.getState();
  }

  async playScript(path: string): Promise<ActionResult> {
    try {
      this.clearError();

      const isLayout = path.toLowerCase().endsWith('.layout.json');
      const item = isLayout ? this.findLayout(path) : this.findScript(path);

      if (!item) {
        const error = `${isLayout ? 'Layout' : 'Script'} not found: ${path}`;
        this.setError(error);
        return { ok: false, error };
      }

      const existing = this.state.tabs.find(tab =>
        tab.scriptPath === item.fullPath && this.tabHasRunningSession(tab.id));

      if (existing) {
        this.state.activeTabId = existing.id;
        this.emitState();
        return { ok: true };
      }

      const tab = isLayout
        ? buildTabForLayout(item as LayoutDescriptor)
        : buildTabForScript(item as ScriptDescriptor);

      this.state.tabs.push(tab);
      this.state.activeTabId = tab.id;

      for (const node of collectTerminalNodes(tab.layout)) {
        if (node.kind !== 'terminal') continue;
        this.state.sessions[node.sessionId] = this.terminalManager.createSession({
          id: node.sessionId,
          tabId: tab.id,
          title: node.title,
          cwd: node.cwd,
          launch: node.launch
        });
      }

      this.emitState();
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setError(message);
      return { ok: false, error: message };
    }
  }

  async stopTab(tabId: string): Promise<ActionResult> {
    const sessionIds = Object.values(this.state.sessions)
      .filter(session => session.tabId === tabId && this.terminalManager.isRunning(session.id))
      .map(session => session.id);

    await Promise.all(sessionIds.map(sessionId => this.terminalManager.terminate(sessionId)));
    return { ok: true };
  }

  async stopSession(sessionId: string): Promise<ActionResult> {
    await this.terminalManager.terminate(sessionId);
    return { ok: true };
  }

  createSession(params: { id: string; tabId: string; title: string; cwd: string; launch: import('../shared/contracts').SessionLaunch }): ActionResult {
    try {
      this.state.sessions[params.id] = this.terminalManager.createSession(params);
      this.emitState();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async restartTab(tabId: string): Promise<ActionResult> {
    this.clearError();
    const tab = this.state.tabs.find(item => item.id === tabId);
    if (!tab) {
      const error = `Tab not found: ${tabId}`;
      this.setError(error);
      return { ok: false, error };
    }

    await this.stopTab(tabId);
    const result = await this.closeTab(tabId);
    void result;
    return this.playScript(tab.scriptPath);
  }

  writeTerminal(sessionId: string, data: string): void {
    this.terminalManager.write(sessionId, data);
  }

  resizeTerminal(sessionId: string, cols: number, rows: number): void {
    this.terminalManager.resize(sessionId, cols, rows);
  }

  dispose(): void {
    this.watcher.dispose();
  }

  async pinLayout(layoutPath: string): Promise<AppState> {
    this.settings = this.settingsStore.withPinnedLayout(this.settings, layoutPath);
    await this.settingsStore.save(this.settings);
    this.state.pinnedLayouts = this.resolvePinnedLayouts();
    this.emitState();
    return this.getState();
  }

  async unpinLayout(layoutPath: string): Promise<AppState> {
    this.settings = this.settingsStore.withUnpinnedLayout(this.settings, layoutPath);
    await this.settingsStore.save(this.settings);
    this.state.pinnedLayouts = this.resolvePinnedLayouts();
    this.emitState();
    return this.getState();
  }

  async openShell(): Promise<ActionResult> {
    try {
      const cwd = this.state.currentProjectRoot ?? homedir()
      const sessionId = randomUUID()
      const tab: WorkspaceTab = {
        id: randomUUID(),
        scriptPath: `shell:${cwd}`,
        title: 'PowerShell',
        layout: { kind: 'terminal', sessionId, title: 'PowerShell', cwd, launch: { mode: 'command', value: 'powershell' } }
      }
      this.state.tabs.push(tab)
      this.state.activeTabId = tab.id
      this.state.sessions[sessionId] = this.terminalManager.createSession({
        id: sessionId, tabId: tab.id, title: 'PowerShell', cwd, launch: { mode: 'command', value: 'powershell' }
      })
      this.emitState()
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async pinScript(scriptPath: string): Promise<AppState> {
    this.settings = this.settingsStore.withPinnedScript(this.settings, scriptPath);
    await this.settingsStore.save(this.settings);
    this.state.pinnedScripts = this.resolvePinnedScripts();
    this.emitState();
    return this.getState();
  }

  async unpinScript(scriptPath: string): Promise<AppState> {
    this.settings = this.settingsStore.withUnpinnedScript(this.settings, scriptPath);
    await this.settingsStore.save(this.settings);
    this.state.pinnedScripts = this.resolvePinnedScripts();
    this.emitState();
    return this.getState();
  }

  async saveAiAgents(agents: AppSettings['aiAgents']): Promise<AppState> {
    this.settings = { ...this.settings, aiAgents: agents };
    await this.settingsStore.save(this.settings);
    this.state.aiAgents = agents;
    this.emitState();
    return this.getState();
  }

  async launchAiAgent(id: AiAgentId): Promise<ActionResult> {
    try {
      this.clearError();
      const def = AI_DEFS[id];
      const agent = this.state.aiAgents.find(a => a.id === id);
      if (!agent?.enabled) return { ok: false, error: `AI agent '${id}' is not enabled.` };

      const cmd = agent.yolo ? def.yoloCmd : def.cmd;
      const scriptPath = `ai:${id}:${agent.layout}:${agent.yolo ? 'yolo' : 'normal'}`;
      const title = agent.yolo ? `${def.name} ⚡` : def.name;
      const cwd = this.state.currentProjectRoot ?? homedir();

      const existing = this.state.tabs.find(t => t.scriptPath === scriptPath && this.tabHasRunningSession(t.id));
      if (existing) {
        this.state.activeTabId = existing.id;
        this.emitState();
        return { ok: true };
      }

      const layout = buildAiLayout(cmd, agent.layout, cwd);
      const tab: WorkspaceTab = { id: randomUUID(), scriptPath, title, layout };
      this.state.tabs.push(tab);
      this.state.activeTabId = tab.id;

      for (const node of collectTerminalNodes(layout)) {
        if (node.kind !== 'terminal') continue;
        this.state.sessions[node.sessionId] = this.terminalManager.createSession({
          id: node.sessionId, tabId: tab.id, title: node.title, cwd: node.cwd, launch: node.launch
        });
      }

      this.emitState();
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setError(message);
      return { ok: false, error: message };
    }
  }

  private resolvePinnedLayouts() {
    if (!this.state.projectTree) return [];
    const all = flattenLayouts(this.state.projectTree);
    return this.settings.pinnedLayouts
      .map(path => all.find(l => l.fullPath === path))
      .filter((l): l is typeof all[0] => l !== undefined);
  }

  private resolvePinnedScripts() {
    if (!this.state.projectTree) return [];
    const all = flattenScripts(this.state.projectTree);
    return this.settings.pinnedScripts
      .map(path => all.find(s => s.fullPath === path))
      .filter((s): s is typeof all[0] => s !== undefined);
  }

  private async loadProject(rootPath: string): Promise<void> {
    await Promise.all(
      Object.values(this.state.sessions)
        .filter(session => this.terminalManager.isRunning(session.id))
        .map(session => this.terminalManager.terminate(session.id))
    );

    const tree = scanProject(rootPath);
    this.state.currentProjectRoot = rootPath;
    this.state.projectTree = tree;
    this.state.tabs = [];
    this.state.activeTabId = null;
    this.state.sessions = {};

    this.settings = this.settingsStore.withRecentRoot(this.settings, rootPath);
    this.state.recentProjectRoots = this.settings.recentProjectRoots;
    this.state.pinnedLayouts = this.resolvePinnedLayouts();
    this.state.pinnedScripts = this.resolvePinnedScripts();
    await this.settingsStore.save(this.settings);

    if (process.env.TERMIDIU_DISABLE_WATCH !== '1') {
      this.watcher.start(rootPath, () => {
        if (!this.state.currentProjectRoot) {
          return;
        }

        this.state.projectTree = scanProject(this.state.currentProjectRoot);
        this.state.pinnedLayouts = this.resolvePinnedLayouts();
        this.state.pinnedScripts = this.resolvePinnedScripts();
        this.emitState();
      });
    }

    this.emitState();
  }

  private emitState(): void {
    this.window?.webContents.send('termidiu:state', {
      state: this.getState()
    } satisfies StatePayload);
  }

  private emitTerminalOutput(payload: TerminalOutputEvent): void {
    this.window?.webContents.send('termidiu:terminal-output', payload);
  }

  private clearError(): void {
    if (this.state.lastError === null) {
      return;
    }

    this.state.lastError = null;
    this.emitState();
  }

  private setError(message: string): void {
    this.state.lastError = message;
    this.emitState();
  }

  private updateSession(session: AppState['sessions'][string]): void {
    this.state.sessions[session.id] = session;
    this.emitState();
  }

  private findScript(scriptPath: string): ScriptDescriptor | null {
    if (!this.state.projectTree) return null;
    return flattenScripts(this.state.projectTree).find(s => s.fullPath === scriptPath) ?? null;
  }

  private findLayout(layoutPath: string): LayoutDescriptor | null {
    if (!this.state.projectTree) return null;
    return flattenLayouts(this.state.projectTree).find(l => l.fullPath === layoutPath) ?? null;
  }

  private tabHasRunningSession(tabId: string): boolean {
    return Object.values(this.state.sessions).some(
      session => session.tabId === tabId && (session.status === 'starting' || session.status === 'running')
    );
  }
}
