const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    getProjectInfo: (path) => ipcRenderer.invoke('get-project-info', path),
    checkGhStatus: () => ipcRenderer.invoke('check-gh-status'),
    getReleases: (path) => ipcRenderer.invoke('get-releases', path),
    createRelease: (data) => ipcRenderer.invoke('create-release', data),
    deleteRelease: (data) => ipcRenderer.invoke('delete-release', data),

    triggerBuild: (data) => ipcRenderer.invoke('trigger-build', data),
    onBuildLog: (callback) => ipcRenderer.on('build-log', (_event, value) => callback(value)),
    removeBuildLogListener: () => ipcRenderer.removeAllListeners('build-log'),

    // Build completion event
    onBuildComplete: (callback) => ipcRenderer.on('build-complete', () => callback()),
    removeBuildCompleteListener: () => ipcRenderer.removeAllListeners('build-complete'),

    // Προσθήκη: Window control functions
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    toggleMaximize: () => ipcRenderer.send('window-toggle-maximize')
});