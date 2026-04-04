const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  persistRestfyState: (jsonString) => ipcRenderer.invoke('persist-restfy-state', jsonString),
  loadRestfyState: () => ipcRenderer.invoke('load-restfy-state'),
  flushRestfyState: (jsonString) => ipcRenderer.sendSync('flush-restfy-state', jsonString)
});
