const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  syncBiometricManual: () => ipcRenderer.invoke('sync-biometric-manual'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});
