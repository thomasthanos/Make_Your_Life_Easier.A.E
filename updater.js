const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');

class AppUpdater {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.setupAutoUpdater();
  }

  setupAutoUpdater() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('checking-for-update', () => {
  this.sendStatusToWindow('checking');
});

autoUpdater.on('update-available', (info) => {
  this.sendStatusToWindow('available', {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: info.releaseNotes
  });
});

autoUpdater.on('update-not-available', (info) => {
  this.sendStatusToWindow('not-available', {
    version: info?.version
  });
});
autoUpdater.on('error', (err) => {
  this.sendStatusToWindow('error', {
    message: err.message
  });
});

autoUpdater.on('download-progress', (progressObj) => {
  this.sendStatusToWindow('downloading', {
    percent: progressObj.percent,
    bytesPerSecond: progressObj.bytesPerSecond,
    transferred: progressObj.transferred,
    total: progressObj.total
  });
});

autoUpdater.on('update-downloaded', (info) => {
  this.sendStatusToWindow('downloaded', {
    version: info.version,
    releaseDate: info.releaseDate
  });
});
  }

sendStatusToWindow(status, data = {}) {
  console.log('Updater:', status, data);
  if (this.mainWindow && this.mainWindow.webContents) {
    this.mainWindow.webContents.send('update-status', {
      status: status,
      ...data
    });
  }
}

  checkForUpdates() {
    autoUpdater.checkForUpdates();
  }
}

module.exports = AppUpdater;