const { app, dialog, shell } = require('electron');
const https = require('https');

class SimpleUpdater {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.owner = 'thomasthanos';
    this.repo = 'Make_Your_Life_Easier.A.E';
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

  showUpdateDialog(releaseInfo) {
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Νέα Έκδοση Διαθέσιμη!',
      message: `Βρέθηκε νέα έκδοση: ${releaseInfo.tag_name}`,
      detail: `Τρέχουσα έκδοση: v${app.getVersion()}\n\n${releaseInfo.body || 'Νέες λειτουργίες και βελτιώσεις.'}\n\nΘέλετε να ανοίξει η σελίδα λήψης;`,
      buttons: ['Άνοιγμα Σελίδας', 'Άκυρο'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        this.sendStatusToWindow('🌐 Ανοίγει η σελίδα λήψης...');
        shell.openExternal(releaseInfo.html_url);
      }
    });
  }

  sendStatusToWindow(message) {
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send('update-status', message);
    }
  }
}

module.exports = SimpleUpdater;