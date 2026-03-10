import { spawn } from 'node:child_process';
import { spawn as spawnPty, type IPty } from 'node-pty';
import type { SessionLaunch, TerminalSessionState } from '../../shared/contracts';

export interface SessionStartPayload {
  id: string;
  tabId: string;
  title: string;
  cwd: string;
  launch: SessionLaunch;
}

interface ManagedSession {
  tabId: string;
  pty: IPty;
  state: TerminalSessionState;
}

export class TerminalManager {
  private readonly sessions = new Map<string, ManagedSession>();

  constructor(
    private readonly onOutput: (sessionId: string, data: string) => void,
    private readonly onStateChange: (state: TerminalSessionState) => void
  ) {}

  createSession(payload: SessionStartPayload): TerminalSessionState {
    const args = payload.launch.mode === 'file'
      ? ['-NoLogo', '-NoProfile', '-NoExit', '-File', payload.launch.value]
      : ['-NoLogo', '-NoProfile', '-NoExit', '-Command', payload.launch.value];

    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (key.toUpperCase() !== 'CLAUDECODE' && value !== undefined) {
        env[key] = value;
      }
    }
    env['TERM'] = 'xterm-256color';

    const terminal = spawnPty('pwsh.exe', args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: payload.cwd,
      env
    });

    const state: TerminalSessionState = {
      id: payload.id,
      tabId: payload.tabId,
      title: payload.title,
      cwd: payload.cwd,
      status: 'starting',
      processId: terminal.pid,
      exitCode: null,
      error: null
    };

    this.sessions.set(payload.id, { tabId: payload.tabId, pty: terminal, state });
    this.onStateChange({ ...state, status: 'running' });

    terminal.onData((data: string) => this.onOutput(payload.id, data));
    terminal.onExit((event: { exitCode: number }) => {
      const managed = this.sessions.get(payload.id);
      if (!managed) {
        return;
      }

      const nextState: TerminalSessionState = {
        ...managed.state,
        status: event.exitCode === 0 ? 'exited' : 'failed',
        exitCode: event.exitCode,
        error: event.exitCode === 0 ? null : `Process exited with code ${event.exitCode}.`
      };

      this.sessions.delete(payload.id);
      this.onStateChange(nextState);
    });

    return { ...state, status: 'running' };
  }

  write(sessionId: string, data: string): void {
    this.sessions.get(sessionId)?.pty.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      return;
    }

    managed.pty.resize(Math.max(cols, 20), Math.max(rows, 5));
  }

  async terminate(sessionId: string): Promise<void> {
    const managed = this.sessions.get(sessionId);
    if (!managed) {
      return;
    }

    await killProcessTree(managed.pty.pid);
    this.sessions.delete(sessionId);
    this.onStateChange({
      ...managed.state,
      status: 'exited',
      exitCode: 0,
      error: null
    });
  }

  isRunning(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}

function killProcessTree(processId: number): Promise<void> {
  return new Promise(resolve => {
    const child = spawn('taskkill', ['/PID', String(processId), '/T', '/F'], {
      windowsHide: true
    });

    child.once('exit', () => resolve());
    child.once('error', () => resolve());
  });
}
