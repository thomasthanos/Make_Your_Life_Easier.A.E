const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    getReleases: (path) => ipcRenderer.invoke('get-releases', path),
    createRelease: (data) => ipcRenderer.invoke('create-release', data),
    deleteRelease: (data) => ipcRenderer.invoke('delete-release', data),

    triggerBuild: (path) => ipcRenderer.invoke('trigger-build', path),
    onBuildLog: (callback) => ipcRenderer.on('build-log', (_event, value) => callback(value)),
    removeBuildLogListener: () => ipcRenderer.removeAllListeners('build-log'),

    // Προσθήκη: Window control functions
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    toggleMaximize: () => ipcRenderer.send('window-toggle-maximize')
});