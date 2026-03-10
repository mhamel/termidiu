import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { app } from 'electron';
import type { AiAgentConfig, AppSettings } from '../../shared/contracts';

const DEFAULT_AI_AGENTS: AiAgentConfig[] = [
  { id: 'claude',     enabled: false, layout: '1+1', yolo: true },
  { id: 'gemini',     enabled: false, layout: '1+1', yolo: false },
  { id: 'codex',      enabled: false, layout: '1+1', yolo: false },
  { id: 'perplexity', enabled: false, layout: '1',   yolo: false },
];

const DEFAULT_SETTINGS: AppSettings = {
  lastProjectRoot: null,
  recentProjectRoots: [],
  pinnedLayouts: [],
  pinnedScripts: [],
  aiAgents: DEFAULT_AI_AGENTS
};

export class SettingsStore {
  private get settingsPath(): string {
    return join(app.getPath('userData'), 'settings.json');
  }

  async load(): Promise<AppSettings> {
    try {
      const content = await readFile(this.settingsPath, 'utf8');
      const parsed = JSON.parse(content) as Partial<AppSettings>;
      const savedAgents = Array.isArray(parsed.aiAgents) ? parsed.aiAgents : [];
      const aiAgents: AiAgentConfig[] = DEFAULT_AI_AGENTS.map(def => {
        const saved = savedAgents.find((a: AiAgentConfig) => a.id === def.id);
        if (!saved) return def;
        return {
          id: def.id,
          enabled: typeof saved.enabled === 'boolean' ? saved.enabled : false,
          layout: (['1', '1+1', '1+2', '2+2'] as import('../../shared/contracts').AiLayout[]).includes(saved.layout) ? saved.layout : '1+1',
          yolo: typeof saved.yolo === 'boolean' ? saved.yolo : def.yolo,
        };
      });
      return {
        lastProjectRoot: parsed.lastProjectRoot ?? null,
        recentProjectRoots: Array.isArray(parsed.recentProjectRoots)
          ? parsed.recentProjectRoots.filter(value => typeof value === 'string')
          : [],
        pinnedLayouts: Array.isArray(parsed.pinnedLayouts)
          ? parsed.pinnedLayouts.filter(value => typeof value === 'string')
          : [],
        pinnedScripts: Array.isArray(parsed.pinnedScripts)
          ? parsed.pinnedScripts.filter(value => typeof value === 'string')
          : [],
        aiAgents
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async save(settings: AppSettings): Promise<void> {
    await mkdir(dirname(this.settingsPath), { recursive: true });
    await writeFile(this.settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  }

  withRecentRoot(settings: AppSettings, rootPath: string): AppSettings {
    const recentProjectRoots = [rootPath, ...settings.recentProjectRoots.filter(path => path !== rootPath)]
      .slice(0, 10);

    return {
      ...settings,
      lastProjectRoot: rootPath,
      recentProjectRoots
    };
  }

  withPinnedLayout(settings: AppSettings, layoutPath: string): AppSettings {
    if (settings.pinnedLayouts.includes(layoutPath)) return settings;
    return { ...settings, pinnedLayouts: [...settings.pinnedLayouts, layoutPath] };
  }

  withUnpinnedLayout(settings: AppSettings, layoutPath: string): AppSettings {
    return { ...settings, pinnedLayouts: settings.pinnedLayouts.filter(p => p !== layoutPath) };
  }

  withPinnedScript(settings: AppSettings, scriptPath: string): AppSettings {
    if (settings.pinnedScripts.includes(scriptPath)) return settings;
    return { ...settings, pinnedScripts: [...settings.pinnedScripts, scriptPath] };
  }

  withUnpinnedScript(settings: AppSettings, scriptPath: string): AppSettings {
    return { ...settings, pinnedScripts: settings.pinnedScripts.filter(p => p !== scriptPath) };
  }
}
