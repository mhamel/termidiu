import { ipcMain, BrowserWindow, app } from 'electron';
import { readFile, writeFile, rm, mkdir, rename } from 'fs/promises';
import { AppController } from '../app-controller';

export function registerIpc(controller: AppController): void {
  ipcMain.handle('termidiu:get-initial-state', () => controller.getState());
  ipcMain.handle('termidiu:open-project', () => controller.openProject());
  ipcMain.handle('termidiu:reopen-project', (_event, rootPath: string) => controller.reopenProject(rootPath));
  ipcMain.handle('termidiu:activate-tab', (_event, tabId: string) => controller.activateTab(tabId));
  ipcMain.handle('termidiu:close-tab', (_event, tabId: string) => controller.closeTab(tabId));
  ipcMain.handle('termidiu:play-script', (_event, scriptPath: string) => controller.playScript(scriptPath));
  ipcMain.handle('termidiu:stop-tab', (_event, tabId: string) => controller.stopTab(tabId));
  ipcMain.handle('termidiu:stop-session', (_event, sessionId: string) => controller.stopSession(sessionId));
  ipcMain.handle('termidiu:create-session', (_event, params) => controller.createSession(params));
  ipcMain.handle('termidiu:restart-tab', (_event, tabId: string) => controller.restartTab(tabId));

  ipcMain.handle('termidiu:read-file', (_event, path: string) => readFile(path, 'utf8'));

  ipcMain.handle('termidiu:delete-file', async (_event, path: string) => {
    try {
      await rm(path, { recursive: true, force: true });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('termidiu:open-shell', () => controller.openShell());
  ipcMain.handle('termidiu:pin-layout', (_event, path: string) => controller.pinLayout(path));
  ipcMain.handle('termidiu:unpin-layout', (_event, path: string) => controller.unpinLayout(path));
  ipcMain.handle('termidiu:pin-script', (_event, path: string) => controller.pinScript(path));
  ipcMain.handle('termidiu:unpin-script', (_event, path: string) => controller.unpinScript(path));
  ipcMain.handle('termidiu:save-ai-agents', (_event, agents) => controller.saveAiAgents(agents));
  ipcMain.handle('termidiu:launch-ai-agent', (_event, id: string) => controller.launchAiAgent(id as import('../../shared/contracts').AiAgentId));

  ipcMain.handle('termidiu:move-file', async (_event, src: string, dest: string) => {
    try {
      await rename(src, dest);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('termidiu:create-dir', async (_event, path: string) => {
    try {
      await mkdir(path, { recursive: true });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('termidiu:write-file', async (_event, path: string, content: string) => {
    try {
      await writeFile(path, content, 'utf8');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('termidiu:menu-action', (_event, action: string) => {
    const win = BrowserWindow.getFocusedWindow();
    const wc = win?.webContents;
    switch (action) {
      case 'undo':             wc?.undo(); break;
      case 'redo':             wc?.redo(); break;
      case 'cut':              wc?.cut(); break;
      case 'copy':             wc?.copy(); break;
      case 'paste':            wc?.paste(); break;
      case 'selectAll':        wc?.selectAll(); break;
      case 'reload':           wc?.reload(); break;
      case 'toggleDevTools':   wc?.toggleDevTools(); break;
      case 'toggleFullscreen': win?.setFullScreen(!win.isFullScreen()); break;
      case 'quit':             app.quit(); break;
    }
  });

  ipcMain.on('termidiu:write-terminal', (_event, sessionId: string, data: string) => {
    controller.writeTerminal(sessionId, data);
  });

  ipcMain.on('termidiu:resize-terminal', (_event, sessionId: string, cols: number, rows: number) => {
    controller.resizeTerminal(sessionId, cols, rows);
  });
}

