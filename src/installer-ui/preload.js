const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('installer', {
    copyText: (text) => clipboard.writeText(String(text)),
    getMode: () => ipcRenderer.invoke('installer-get-mode'),
    getInfo: () => ipcRenderer.invoke('installer-get-info'),
    install: (options) => ipcRenderer.invoke('installer-install', options),
    launchAndClose: () => ipcRenderer.invoke('installer-launch'),
    uninstall: () => ipcRenderer.invoke('installer-uninstall'),
    setHeight: (height) => ipcRenderer.invoke('installer-set-height', height),
    close: () => ipcRenderer.invoke('installer-close'),
    minimize: () => ipcRenderer.invoke('installer-minimize'),
    onProgress: (callback) => {
        const listener = (_e, data) => callback(data);
        ipcRenderer.on('installer-progress', listener);
        return () => ipcRenderer.removeListener('installer-progress', listener);
    }
});
