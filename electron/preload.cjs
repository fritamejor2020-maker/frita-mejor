const { contextBridge, ipcRenderer } = require('electron');

const apiObj = {
  syncBiometricManual: () => ipcRenderer.invoke('sync-biometric-manual'),
  syncBiometric: () => ipcRenderer.invoke('sync-biometric-manual'),
  modifyBiometricUser: (data) => ipcRenderer.invoke('modify-biometric-user', data),
  fetchBiometricUsers: () => ipcRenderer.invoke('fetch-biometric-users'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
};

contextBridge.exposeInMainWorld('electronAPI', apiObj);
contextBridge.exposeInMainWorld('cajeroAPI', apiObj);
