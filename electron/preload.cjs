const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  syncBiometricManual: () => ipcRenderer.invoke('sync-biometric-manual'),
  modifyBiometricUser: (data) => ipcRenderer.invoke('modify-biometric-user', data),
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});
