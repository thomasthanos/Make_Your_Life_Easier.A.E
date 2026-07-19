const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('installer', {
    getMode: () => ipcRenderer.invoke('installer-get-mode'),
    getInfo: () => ipcRenderer.invoke('installer-get-info'),
    install: (options) => ipcRenderer.invoke('installer-install', options),
    launchAndClose: () => ipcRenderer.invoke('installer-launch'),
    uninstall: () => ipcRenderer.invoke('installer-uninstall'),
    close: () => ipcRenderer.invoke('installer-close'),
    minimize: () => ipcRenderer.invoke('installer-minimize'),
    onProgress: (callback) => {
        const listener = (_e, data) => callback(data);
        ipcRenderer.on('installer-progress', listener);
        return () => ipcRenderer.removeListener('installer-progress', listener);
    }
});
