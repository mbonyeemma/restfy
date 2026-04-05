"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const promises = require("fs/promises");
const electronUpdater = require("electron-updater");
let win = null;
const STATE_FILE = "restify-state.json";
const LEGACY_STATE_FILE = "restfy-state.json";
function stateFilePath() {
  return path.join(electron.app.getPath("userData"), STATE_FILE);
}
function legacyStateFilePath() {
  return path.join(electron.app.getPath("userData"), LEGACY_STATE_FILE);
}
function migrateLegacyStateFileSync() {
  const p = stateFilePath();
  const oldP = legacyStateFilePath();
  if (!fs.existsSync(p) && fs.existsSync(oldP)) {
    try {
      fs.copyFileSync(oldP, p);
    } catch (err) {
      console.error("Restify state file migration failed:", err);
    }
  }
}
function createWindow() {
  electron.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Access-Control-Allow-Origin": ["*"],
        "Access-Control-Allow-Methods": ["GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS"],
        "Access-Control-Allow-Headers": ["*"]
      }
    });
  });
  win = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#1a1a1a",
    icon: path.join(__dirname, "../../resources/icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, "../preload/index.js")
    }
  });
  if (process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.ipcMain.on("window-minimize", () => {
  win?.minimize();
});
electron.ipcMain.on("window-maximize", () => {
  if (win) {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
});
electron.ipcMain.on("window-close", () => {
  win?.close();
});
electron.ipcMain.handle("persist-restify-state", async (_e, jsonString) => {
  try {
    await promises.writeFile(stateFilePath(), jsonString, "utf8");
    return true;
  } catch (err) {
    console.error("Restify persist failed:", err);
    return false;
  }
});
electron.ipcMain.handle("load-restify-state", async () => {
  try {
    const p = stateFilePath();
    if (!fs.existsSync(p)) return null;
    return await promises.readFile(p, "utf8");
  } catch (err) {
    console.error("Restify load cache failed:", err);
    return null;
  }
});
electron.ipcMain.on("flush-restify-state", (event, jsonString) => {
  try {
    fs.writeFileSync(stateFilePath(), jsonString, "utf8");
    event.returnValue = true;
  } catch (err) {
    console.error("Restify flush failed:", err);
    event.returnValue = false;
  }
});
electron.ipcMain.handle("get-app-version", () => electron.app.getVersion());
electron.ipcMain.handle("check-for-updates", async () => {
  if (!electron.app.isPackaged) return { ok: false, dev: true };
  try {
    await electronUpdater.autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
});
electron.ipcMain.handle("quit-and-install", () => {
  if (electron.app.isPackaged) electronUpdater.autoUpdater.quitAndInstall(false, true);
});
function broadcastUpdateStatus(payload) {
  electron.BrowserWindow.getAllWindows().forEach((w) => {
    try {
      w.webContents.send("update-status", payload);
    } catch (_) {
    }
  });
}
function setupAutoUpdater() {
  if (!electron.app.isPackaged) return;
  electronUpdater.autoUpdater.autoDownload = true;
  electronUpdater.autoUpdater.autoInstallOnAppQuit = true;
  electronUpdater.autoUpdater.on("update-available", (info) => {
    broadcastUpdateStatus({ event: "available", version: info.version });
  });
  electronUpdater.autoUpdater.on("update-downloaded", (info) => {
    broadcastUpdateStatus({ event: "downloaded", version: info.version });
  });
  electronUpdater.autoUpdater.on("update-not-available", () => {
    broadcastUpdateStatus({ event: "none" });
  });
  electronUpdater.autoUpdater.on("error", (err) => {
    broadcastUpdateStatus({ event: "error", message: err.message || String(err) });
  });
  setTimeout(() => {
    electronUpdater.autoUpdater.checkForUpdates().catch(() => {
    });
  }, 5e3);
}
electron.app.whenReady().then(() => {
  migrateLegacyStateFileSync();
  if (process.platform === "darwin") {
    const iconPath = path.join(__dirname, "../../resources/icon.png");
    if (fs.existsSync(iconPath)) {
      const img = electron.nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) electron.app.dock.setIcon(img);
    }
  }
  createWindow();
  setupAutoUpdater();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
