const { autoUpdater } = require('electron-updater');
const { dialog, ipcMain } = require('electron');
const log = require('electron-log');

class AppUpdater {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.setupAutoUpdater();
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    
    // Χρησιμοποίησε το σωστό GitHub URL για το repository σου
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'thomasthanos',
      repo: 'Make_Your_Life_Easier.A.E'
    });
  }

  setupAutoUpdater() {
    // Ρυθμίσεις Auto Updater
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;

    // Events του Auto Updater
    autoUpdater.on('checking-for-update', () => {
      this.sendStatusToWindow('🔄 Ελέγχω για ενημερώσεις...');
    });

    autoUpdater.on('update-available', (info) => {
      this.sendStatusToWindow('✅ Βρέθηκε νέα έκδοση!');
      this.showUpdateAvailableDialog(info);
    });

    autoUpdater.on('update-not-available', (info) => {
      this.sendStatusToWindow('🎉 Η εφαρμογή είναι ενημερωμένη!');
      if (this.mainWindow && this.mainWindow.isVisible()) {
        dialog.showMessageBox(this.mainWindow, {
          type: 'info',
          title: 'Ενημέρωση',
          message: 'Δεν βρέθηκαν νέες ενημερώσεις',
          detail: 'Η εφαρμογή σας είναι ήδη στην τελευταία έκδοση.',
          buttons: ['OK']
        });
      }
    });

    autoUpdater.on('error', (err) => {
      this.sendStatusToWindow(`❌ Σφάλμα: ${err.message}`);
      log.error('AutoUpdater error:', err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      this.sendStatusToWindow({
        status: 'downloading',
        percent: Math.round(progressObj.percent),
        transferred: this.formatBytes(progressObj.transferred),
        total: this.formatBytes(progressObj.total),
        bytesPerSecond: this.formatBytes(progressObj.bytesPerSecond) + '/s',
        timeRemaining: this.formatTimeRemaining(progressObj.secondsRemaining)
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.sendStatusToWindow('📦 Η ενημέρωση κατεβήκε και είναι έτοιμη για εγκατάσταση.');
      this.showUpdateReadyDialog(info);
    });
  }

  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  formatTimeRemaining(seconds) {
    if (!seconds || seconds < 0) return '--';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}ω ${minutes}λ ${secs}δ`;
    } else if (minutes > 0) {
      return `${minutes}λ ${secs}δ`;
    } else {
      return `${secs}δ`;
    }
  }

  sendStatusToWindow(message) {
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send('update-status', message);
    }
  }

  showUpdateAvailableDialog(info) {
    if (!this.mainWindow) return;
    
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Διαθέσιμη Ενημέρωση',
      message: 'Βρέθηκε νέα έκδοση της εφαρμογής!',
      detail: `Έκδοση ${info.version} είναι διαθέσιμη.\n\nΘέλετε να την κατεβάσετε τώρα;`,
      buttons: ['Κατέβασμα', 'Άκυρο'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        this.sendStatusToWindow('📥 Ξεκίνησε το κατέβασμα της ενημέρωσης...');
        autoUpdater.downloadUpdate();
      }
    });
  }

  showUpdateReadyDialog(info) {
    if (!this.mainWindow) return;
    
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Ενημέρωση Έτοιμη',
      message: 'Η ενημέρωση κατεβήκε με επιτυχία!',
      detail: `Η έκδοση ${info.version} είναι έτοιμη για εγκατάσταση. Η εφαρμογή θα επανεκκινηθεί αυτόματα.`,
      buttons: ['Επανεκκίνηση Τώρα', 'Αργότερα'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  }

  checkForUpdates() {
    if (process.env.NODE_ENV === 'development') {
      this.sendStatusToWindow('🚧 Λειτουργία development - παράκαμψη ελέγχου ενημερώσεων');
      return;
    }
    
    this.sendStatusToWindow('🔍 Έναρξη ελέγχου για ενημερώσεις...');
    autoUpdater.checkForUpdates().catch(err => {
      this.sendStatusToWindow(`❌ Σφάλμα κατά τον έλεγχο: ${err.message}`);
    });
  }
}

module.exports = AppUpdater;