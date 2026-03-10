import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow } from 'electron';
import { AppController } from './app-controller';
import { registerIpc } from './ipc/register-ipc';
import { setApplicationMenu } from './menu/application-menu';

app.setAppUserModelId('com.termidiu')
app.name = 'TERMIDIU'

// Single instance: focus existing window instead of opening a second one
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

const controller = new AppController();
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const iconPath = join(currentDirectory, '../../resources/icon.ico');

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    title: 'TERMIDIU',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#000000',
      symbolColor: '#858585',
      height: 24
    },
    backgroundColor: '#10141f',
    icon: iconPath,
    webPreferences: {
      preload: join(currentDirectory, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // Electron only supports ESM preload files when the renderer sandbox is disabled.
      sandbox: false,
      webviewTag: true
    }
  });

  controller.setWindow(window);

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await window.loadFile(join(currentDirectory, '../renderer/index.html'));
  }
}

app.on('second-instance', () => {
  const existing = BrowserWindow.getAllWindows()[0]
  if (existing) {
    if (existing.isMinimized()) existing.restore()
    existing.focus()
  }
})

app.whenReady().then(async () => {
  await controller.initialize();
  registerIpc(controller);
  setApplicationMenu(controller);
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  controller.dispose();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
