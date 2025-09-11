import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getApiUrl: () => ipcRenderer.sendSync('get-api-url')
});