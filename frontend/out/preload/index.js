"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => electron.ipcRenderer.send("window-minimize"),
  maximize: () => electron.ipcRenderer.send("window-maximize"),
  close: () => electron.ipcRenderer.send("window-close"),
  persistRestifyState: (jsonString) => electron.ipcRenderer.invoke("persist-restify-state", jsonString),
  loadRestifyState: () => electron.ipcRenderer.invoke("load-restify-state"),
  flushRestifyState: (jsonString) => electron.ipcRenderer.sendSync("flush-restify-state", jsonString),
  getAppVersion: () => electron.ipcRenderer.invoke("get-app-version"),
  checkForUpdates: () => electron.ipcRenderer.invoke("check-for-updates"),
  quitAndInstall: () => electron.ipcRenderer.invoke("quit-and-install"),
  onUpdateStatus: (callback) => {
    electron.ipcRenderer.on("update-status", (_e, payload) => callback(payload));
  }
});
