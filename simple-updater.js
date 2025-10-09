const { app, dialog, shell, ipcMain } = require('electron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class SimpleUpdater {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.owner = 'thomasthanos';
    this.repo = 'Make_Your_Life_Easier.A.E';
    this.downloadsDir = app.getPath('downloads');
  }

  async checkForUpdates() {
    this.sendStatusToWindow('🔍 Έλεγχος για ενημερώσεις...');
    
    try {
      const releaseInfo = await this.fetchLatestRelease();
      
      if (!releaseInfo) {
        this.sendStatusToWindow('❌ Δεν βρέθηκαν releases');
        return false;
      }

      const latestVersion = releaseInfo.tag_name.replace('v', '');
      const currentVersion = app.getVersion();

      this.sendStatusToWindow(`📊 Τρέχουσα: v${currentVersion}, Τελευταία: ${releaseInfo.tag_name}`);

      if (this.compareVersions(latestVersion, currentVersion) > 0) {
        this.sendStatusToWindow('✅ Βρέθηκε νέα έκδοση!');
        this.showUpdateDialog(releaseInfo);
        return true;
      } else {
        this.sendStatusToWindow('🎉 Έχετε την τελευταία έκδοση!');
        return false;
      }
    } catch (error) {
      this.sendStatusToWindow(`❌ Σφάλμα: ${error.message}`);
      return false;
    }
  }

  showUpdateDialog(releaseInfo) {
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Νέα Έκδοση Διαθέσιμη!',
      message: `Βρέθηκε νέα έκδοση: ${releaseInfo.tag_name}`,
      detail: `Τρέχουσα έκδοση: v${app.getVersion()}\n\n${releaseInfo.body || 'Νέες λειτουργίες και βελτιώσεις.'}\n\nΘέλετε να κατεβάσετε και να εγκαταστήσετε αυτόματα;`,
      buttons: ['Αυτόματη Εγκατάσταση', 'Άνοιγμα Σελίδας', 'Άκυρο'],
      defaultId: 0,
      cancelId: 2
    }).then((result) => {
      if (result.response === 0) {
        // Αυτόματη εγκατάσταση
        this.downloadAndInstall(releaseInfo);
      } else if (result.response === 1) {
        // Άνοιγμα σελίδας
        this.sendStatusToWindow('🌐 Ανοίγει η σελίδα λήψης...');
        shell.openExternal(releaseInfo.html_url);
      }
    });
  }

  async downloadAndInstall(releaseInfo) {
    try {
      this.sendStatusToWindow('📦 Εύρεση αρχείου εγκατάστασης...');
      
      // Βρες το installer αρχείο
      const installerAsset = releaseInfo.assets.find(asset => 
        asset.name.includes('Setup') && asset.name.includes('.exe')
      );

      const portableAsset = releaseInfo.assets.find(asset => 
        asset.name.includes('Portable') && asset.name.includes('.exe')
      );

      const asset = installerAsset || portableAsset;

      if (!asset) {
        throw new Error('Δεν βρέθηκε αρχείο εγκατάστασης');
      }

      this.sendStatusToWindow(`📥 Κατέβασμα: ${asset.name}...`);
      
      // Κατέβασμα του αρχείου
      const filePath = await this.downloadFile(asset.browser_download_url, asset.name);
      
      this.sendStatusToWindow('✅ Κατέβασμα ολοκληρώθηκε!');
      
      // Ερώτηση για άμεση εγκατάσταση
      const installResult = await dialog.showMessageBox(this.mainWindow, {
        type: 'question',
        title: 'Εγκατάσταση Έτοιμη',
        message: 'Η λήψη ολοκληρώθηκε!',
        detail: `Το αρχείο ${asset.name} κατεβήκε. Θέλετε να ανοίξει τώρα ο installer για να ολοκληρωθεί η εγκατάσταση;`,
        buttons: ['Εγκατάσταση Τώρα', 'Άνοιγμα Φακέλου', 'Ακύρωση'],
        defaultId: 0,
        cancelId: 2
      });

      if (installResult.response === 0) {
        // Άνοιγμα installer
        this.sendStatusToWindow('🚀 Εκκίνηση εγκατάστασης...');
        exec(`"${filePath}"`, (error) => {
          if (error) {
            this.sendStatusToWindow('❌ Σφάλμα κατά την εκκίνηση του installer');
          } else {
            this.sendStatusToWindow('✅ Installer εκκινήθηκε! Η εφαρμογή θα κλείσει για εγκατάσταση.');
            // Κλείσιμο της εφαρμογής μετά από 2 δευτερόλεπτα
            setTimeout(() => {
              app.quit();
            }, 2000);
          }
        });
      } else if (installResult.response === 1) {
        // Άνοιγμα φακέλου
        shell.showItemInFolder(filePath);
        this.sendStatusToWindow('📂 Άνοιξε ο φάκελος Downloads');
      }

    } catch (error) {
      this.sendStatusToWindow(`❌ Σφάλμα: ${error.message}`);
      dialog.showMessageBox(this.mainWindow, {
        type: 'error',
        title: 'Σφάλμα Κατεβάσματος',
        message: 'Αποτυχία αυτόματου κατεβάσματος',
        detail: error.message,
        buttons: ['OK']
      });
    }
  }

  downloadFile(url, fileName) {
    return new Promise((resolve, reject) => {
      const filePath = path.join(this.downloadsDir, fileName);
      const file = fs.createWriteStream(filePath);
      
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        let receivedBytes = 0;
        const totalBytes = parseInt(response.headers['content-length'], 10);

        response.on('data', (chunk) => {
          receivedBytes += chunk.length;
          if (totalBytes) {
            const percent = Math.round((receivedBytes / totalBytes) * 100);
            this.sendStatusToWindow(`📥 Κατέβασμα: ${percent}% (${this.formatBytes(receivedBytes)} / ${this.formatBytes(totalBytes)})`);
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve(filePath);
        });

        response.on('error', (error) => {
          fs.unlink(filePath, () => {}); // Διαγραφή αρχείου σε περίπτωση σφάλματος
          reject(error);
        });

      }).on('error', (error) => {
        fs.unlink(filePath, () => {});
        reject(error);
      });
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

  fetchLatestRelease() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${this.owner}/${this.repo}/releases/latest`,
        method: 'GET',
        headers: {
          'User-Agent': 'MakeYourLifeEasier-App',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const releaseInfo = JSON.parse(data);
              resolve(releaseInfo);
            } else {
              reject(new Error(`GitHub API error: ${res.statusCode}`));
            }
          } catch (error) {
            reject(new Error('Failed to parse release info'));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      if (part1 !== part2) {
        return part1 - part2;
      }
    }
    return 0;
  }

  sendStatusToWindow(message) {
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send('update-status', message);
    }
  }
}

module.exports = SimpleUpdater;