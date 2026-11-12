const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  appPid: process.pid,
  triggerUpdate: (version) => ipcRenderer.invoke('clxy-update-app', version)
});
