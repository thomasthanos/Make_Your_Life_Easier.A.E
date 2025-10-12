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
      this.sendStatusToWindow('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      this.sendStatusToWindow('Update available.');
      
      // Ask user if they want to download the update
      dialog.showMessageBox(this.mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `A new version ${info.version} is available. Do you want to download it now?`,
        buttons: ['Download', 'Later']
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      this.sendStatusToWindow('Update not available.');
    });

    autoUpdater.on('error', (err) => {
      this.sendStatusToWindow('Error in auto-updater: ' + err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      let log_message = "Download speed: " + progressObj.bytesPerSecond;
      log_message = log_message + ' - Downloaded ' + Math.round(progressObj.percent) + '%';
      log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
      this.sendStatusToWindow(log_message);
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.sendStatusToWindow('Update downloaded; will install in 5 seconds');
      
      // Ask user to restart and install update
      dialog.showMessageBox(this.mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded. Restart the application to apply the update?',
        buttons: ['Restart', 'Later']
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });
  }

  sendStatusToWindow(text) {
    console.log('Updater:', text);
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send('updater-message', text);
    }
  }

  checkForUpdates() {
    autoUpdater.checkForUpdates();
  }
}

module.exports = AppUpdater;