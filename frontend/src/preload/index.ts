import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  persistRestifyState: (jsonString: string) => ipcRenderer.invoke('persist-restify-state', jsonString),
  loadRestifyState: () => ipcRenderer.invoke('load-restify-state'),
  flushRestifyState: (jsonString: string) => ipcRenderer.sendSync('flush-restify-state', jsonString),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onUpdateStatus: (callback: (payload: any) => void) => {
    ipcRenderer.on('update-status', (_e, payload) => callback(payload))
  }
})
