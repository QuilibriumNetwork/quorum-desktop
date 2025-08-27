// electron/preload.cjs
const { contextBridge, ipcRenderer } = require('electron');
console.log('Preload script starting...');
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  windowControls: {
    minimize: () => ipcRenderer.send('minimize-window'),
    maximize: () => ipcRenderer.send('maximize-window'),
    close: () => ipcRenderer.send('close-window'),
  },
  openLogin: () => ipcRenderer.invoke('openLogin'),
});
console.log('Preload script done...');
