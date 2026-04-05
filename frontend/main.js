const { app, BrowserWindow, session, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let win;

const STATE_FILE = 'restify-state.json';
const LEGACY_STATE_FILE = 'restfy-state.json';

function stateFilePath() {
  return path.join(app.getPath('userData'), STATE_FILE);
}

function legacyStateFilePath() {
  return path.join(app.getPath('userData'), LEGACY_STATE_FILE);
}

function migrateLegacyStateFileSync() {
  const p = stateFilePath();
  const oldP = legacyStateFilePath();
  if (!fs.existsSync(p) && fs.existsSync(oldP)) {
    try {
      fs.copyFileSync(oldP, p);
    } catch (err) {
      console.error('Restify state file migration failed:', err);
    }
  }
}

function createWindow() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Methods': ['GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS'],
        'Access-Control-Allow-Headers': ['*'],
      }
    });
  });

  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a1a',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile(path.join(__dirname, 'app.html'));
}

ipcMain.on('window-minimize', () => { if (win) win.minimize(); });
ipcMain.on('window-maximize', () => {
  if (win) {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
});
ipcMain.on('window-close', () => { if (win) win.close(); });

ipcMain.handle('persist-restify-state', async (_e, jsonString) => {
  try {
    await fs.promises.writeFile(stateFilePath(), jsonString, 'utf8');
    return true;
  } catch (err) {
    console.error('Restify persist failed:', err);
    return false;
  }
});

ipcMain.handle('load-restify-state', async () => {
  try {
    const p = stateFilePath();
    if (!fs.existsSync(p)) return null;
    return await fs.promises.readFile(p, 'utf8');
  } catch (err) {
    console.error('Restify load cache failed:', err);
    return null;
  }
});

ipcMain.on('flush-restify-state', (event, jsonString) => {
  try {
    fs.writeFileSync(stateFilePath(), jsonString, 'utf8');
    event.returnValue = true;
  } catch (err) {
    console.error('Restify flush failed:', err);
    event.returnValue = false;
  }
});

ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) return { ok: false, dev: true };
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
});

ipcMain.handle('quit-and-install', () => {
  if (app.isPackaged) autoUpdater.quitAndInstall(false, true);
});

function broadcastUpdateStatus(payload) {
  BrowserWindow.getAllWindows().forEach((w) => {
    try {
      w.webContents.send('update-status', payload);
    } catch (_) {}
  });
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    broadcastUpdateStatus({ event: 'available', version: info.version });
  });
  autoUpdater.on('update-downloaded', (info) => {
    broadcastUpdateStatus({ event: 'downloaded', version: info.version });
  });
  autoUpdater.on('update-not-available', () => {
    broadcastUpdateStatus({ event: 'none' });
  });
  autoUpdater.on('error', (err) => {
    broadcastUpdateStatus({ event: 'error', message: err.message || String(err) });
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 5000);
}

app.whenReady().then(() => {
  migrateLegacyStateFileSync();
  if (process.platform === 'darwin') {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    if (fs.existsSync(iconPath)) {
      const img = nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) app.dock.setIcon(img);
    }
  }
  createWindow();
  setupAutoUpdater();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
