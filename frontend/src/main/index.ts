import { app, BrowserWindow, session, ipcMain, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync, writeFileSync, copyFileSync } from 'fs'
import { writeFile, readFile } from 'fs/promises'
import { autoUpdater } from 'electron-updater'

let win: BrowserWindow | null = null

const STATE_FILE = 'restify-state.json'
const LEGACY_STATE_FILE = 'restfy-state.json'

function stateFilePath(): string {
  return join(app.getPath('userData'), STATE_FILE)
}

function legacyStateFilePath(): string {
  return join(app.getPath('userData'), LEGACY_STATE_FILE)
}

function migrateLegacyStateFileSync(): void {
  const p = stateFilePath()
  const oldP = legacyStateFilePath()
  if (!existsSync(p) && existsSync(oldP)) {
    try {
      copyFileSync(oldP, p)
    } catch (err) {
      console.error('Restify state file migration failed:', err)
    }
  }
}

function createWindow(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Methods': ['GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS'],
        'Access-Control-Allow-Headers': ['*']
      }
    })
  })

  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a1a',
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: join(__dirname, '../preload/index.js')
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.on('window-minimize', () => { win?.minimize() })
ipcMain.on('window-maximize', () => {
  if (win) {
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  }
})
ipcMain.on('window-close', () => { win?.close() })

ipcMain.handle('persist-restify-state', async (_e, jsonString: string) => {
  try {
    await writeFile(stateFilePath(), jsonString, 'utf8')
    return true
  } catch (err) {
    console.error('Restify persist failed:', err)
    return false
  }
})

ipcMain.handle('load-restify-state', async () => {
  try {
    const p = stateFilePath()
    if (!existsSync(p)) return null
    return await readFile(p, 'utf8')
  } catch (err) {
    console.error('Restify load cache failed:', err)
    return null
  }
})

ipcMain.on('flush-restify-state', (event, jsonString: string) => {
  try {
    writeFileSync(stateFilePath(), jsonString, 'utf8')
    event.returnValue = true
  } catch (err) {
    console.error('Restify flush failed:', err)
    event.returnValue = false
  }
})

ipcMain.handle('get-app-version', () => app.getVersion())

ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) return { ok: false, dev: true }
  try {
    await autoUpdater.checkForUpdates()
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message || String(e) }
  }
})

ipcMain.handle('quit-and-install', () => {
  if (app.isPackaged) autoUpdater.quitAndInstall(false, true)
})

function broadcastUpdateStatus(payload: object): void {
  BrowserWindow.getAllWindows().forEach((w) => {
    try { w.webContents.send('update-status', payload) } catch (_) {}
  })
}

function setupAutoUpdater(): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    broadcastUpdateStatus({ event: 'available', version: info.version })
  })
  autoUpdater.on('update-downloaded', (info) => {
    broadcastUpdateStatus({ event: 'downloaded', version: info.version })
  })
  autoUpdater.on('update-not-available', () => {
    broadcastUpdateStatus({ event: 'none' })
  })
  autoUpdater.on('error', (err) => {
    broadcastUpdateStatus({ event: 'error', message: err.message || String(err) })
  })

  setTimeout(() => { autoUpdater.checkForUpdates().catch(() => {}) }, 5000)
}

app.whenReady().then(() => {
  migrateLegacyStateFileSync()
  if (process.platform === 'darwin') {
    const iconPath = join(__dirname, '../../resources/icon.png')
    if (existsSync(iconPath)) {
      const img = nativeImage.createFromPath(iconPath)
      if (!img.isEmpty()) app.dock.setIcon(img)
    }
  }
  createWindow()
  setupAutoUpdater()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
