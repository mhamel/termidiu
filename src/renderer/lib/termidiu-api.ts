import type { AppState, RendererApi } from '../../shared/contracts'

export const emptySnapshot: AppState = {
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
}

function createFallbackApi(): RendererApi {
  return {
    async getInitialState() {
      return {
        ...emptySnapshot,
        lastError: 'The preload bridge is missing. TERMIDIU is running without the Electron API.'
      }
    },
    async openProject() {
      return emptySnapshot
    },
    async reopenProject() {
      return emptySnapshot
    },
    async activateTab() {
      return emptySnapshot
    },
    async closeTab() {
      return emptySnapshot
    },
    async playScript() {
      return { ok: false, error: 'The preload bridge is missing.' }
    },
    async stopTab() {
      return { ok: false, error: 'The preload bridge is missing.' }
    },
    async stopSession() {
      return { ok: false, error: 'The preload bridge is missing.' }
    },
    async restartTab() {
      return { ok: false, error: 'The preload bridge is missing.' }
    },
    writeTerminal() {},
    resizeTerminal() {},
    async readFile() { return '' },
    async writeFile() { return { ok: false, error: 'No preload bridge.' } },
    async deleteFile() { return { ok: false, error: 'No preload bridge.' } },
    async moveFile() { return { ok: false, error: 'No preload bridge.' } },
    async createDir() { return { ok: false, error: 'No preload bridge.' } },
    async openShell() { return { ok: false, error: 'No preload bridge.' } },
    async pinLayout() { return emptySnapshot },
    async unpinLayout() { return emptySnapshot },
    async pinScript() { return emptySnapshot },
    async unpinScript() { return emptySnapshot },
    async saveAiAgents() { return emptySnapshot },
    async createSession() { return { ok: false, error: 'No preload bridge.' } },
    async launchAiAgent() { return { ok: false, error: 'No preload bridge.' } },
    async menuAction() {},
    onStateChanged() {
      return () => undefined
    },
    onTerminalOutput() {
      return () => undefined
    }
  }
}

export const termidiuApi: RendererApi = window.termidiu ?? createFallbackApi()
