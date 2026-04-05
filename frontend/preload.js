const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  persistRestifyState: (jsonString) => ipcRenderer.invoke('persist-restify-state', jsonString),
  loadRestifyState: () => ipcRenderer.invoke('load-restify-state'),
  flushRestifyState: (jsonString) => ipcRenderer.sendSync('flush-restify-state', jsonString),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_e, payload) => callback(payload));
  }
});
