// Preload script — runs in renderer process with Node access disabled.
// Exposes only safe APIs to the renderer via contextBridge.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  isOnline: () => ipcRenderer.invoke('is-online'),
  platform: process.platform,
});
