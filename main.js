const { app, BrowserWindow, session, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

function restfyStatePath() {
  return path.join(app.getPath('userData'), 'restfy-state.json');
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

  win.loadFile('app.html');
}

ipcMain.on('window-minimize', () => { if (win) win.minimize(); });
ipcMain.on('window-maximize', () => {
  if (win) {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
});
ipcMain.on('window-close', () => { if (win) win.close(); });

ipcMain.handle('persist-restfy-state', async (_e, jsonString) => {
  try {
    await fs.promises.writeFile(restfyStatePath(), jsonString, 'utf8');
    return true;
  } catch (err) {
    console.error('Restfy persist failed:', err);
    return false;
  }
});

ipcMain.handle('load-restfy-state', async () => {
  try {
    const p = restfyStatePath();
    if (!fs.existsSync(p)) return null;
    return await fs.promises.readFile(p, 'utf8');
  } catch (err) {
    console.error('Restfy load cache failed:', err);
    return null;
  }
});

ipcMain.on('flush-restfy-state', (event, jsonString) => {
  try {
    fs.writeFileSync(restfyStatePath(), jsonString, 'utf8');
    event.returnValue = true;
  } catch (err) {
    console.error('Restfy flush failed:', err);
    event.returnValue = false;
  }
});

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    if (fs.existsSync(iconPath)) {
      const img = nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) app.dock.setIcon(img);
    }
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
