// simple-updater.js
// Robust GitHub releases updater for Electron (Windows)
// - Resolves only when the file is fully written (no more 0 bytes)
// - Picks the proper asset (installer|setup first, then portable)
// - Sends human-readable progress lines to renderer via 'update-status'

const { app, dialog, shell, net } = require('electron');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class SimpleUpdater {
  /**
   * @param {Electron.BrowserWindow} mainWindow
   * @param {{owner?:string, repo?:string}} [opts]
   */
  constructor(mainWindow, opts = {}) {
    this.mainWindow = mainWindow;
    this.owner = opts.owner || 'thomasthanos';
    this.repo  = opts.repo  || 'Make_Your_Life_Easier.A.E';
    this.downloadsDir = app.getPath('downloads');

    /** @type {{cancel:()=>void}|null} */
    this.currentDownload = null;
  }

  // ---------- Public API ----------

  async checkForUpdates() {
    this.sendStatusToWindow('🔍 Έλεγχος για ενημερώσεις...');

    try {
      const rel = await this.fetchLatestRelease();
      if (!rel) {
        this.sendStatusToWindow('❌ Δεν βρέθηκαν releases.');
        return false;
      }

      const latestVersion = (rel.tag_name || '').replace(/^v/i, '');
      const currentVersion = app.getVersion();

      this.sendStatusToWindow(`📊 Τρέχουσα: v${currentVersion}, Τελευταία: ${rel.tag_name}`);

      if (this.compareVersions(latestVersion, currentVersion) > 0) {
        this.sendStatusToWindow('✅ Βρέθηκε νέα έκδοση!');
        await this.showUpdateDialog(rel);
        return true;
      } else {
        this.sendStatusToWindow('🎉 Έχετε την τελευταία έκδοση.');
        return false;
      }
    } catch (err) {
      this.sendStatusToWindow(`❌ Σφάλμα: ${err.message}`);
      return false;
    }
  }

  async downloadAndInstall(releaseInfo) {
    // ακύρωσε τυχόν προηγούμενο download
    if (this.currentDownload) {
      try { this.currentDownload.cancel(); } catch {}
    }

    try {
      this.sendStatusToWindow('📦 Εύρεση αρχείου εγκατάστασης...');

      const asset = this.pickAsset(releaseInfo);
      if (!asset) {
        throw new Error('Δεν βρέθηκε κατάλληλο .exe (installer ή portable) στο release.');
      }

      this.sendStatusToWindow(`📥 Κατέβασμα: ${asset.name}...`);

      // Direct URL προς το .exe asset
      const directUrl = `https://github.com/${this.owner}/${this.repo}/releases/download/${releaseInfo.tag_name}/${asset.name}`;

      const filePath = await this.downloadFileWithProgress(directUrl, asset.name);

      this.sendStatusToWindow('✅ Το κατέβασμα ολοκληρώθηκε.');
      await this.delay(800);

      const result = await dialog.showMessageBox(this.mainWindow, {
        type: 'question',
        title: 'Εγκατάσταση Έτοιμη',
        message: 'Η λήψη ολοκληρώθηκε.',
        detail: `Θέλεις να εκκινήσει τώρα ο installer;\n\nΑρχείο:\n${filePath}`,
        buttons: ['Εγκατάσταση Τώρα', 'Άνοιγμα Φακέλου', 'Άκυρο'],
        defaultId: 0,
        cancelId: 2
      });

      if (result.response === 0) {
        this.sendStatusToWindow('🚀 Εκκίνηση installer...');
        exec(`"${filePath}"`, (error) => {
          if (error) {
            this.sendStatusToWindow('❌ Σφάλμα κατά την εκκίνηση του installer.');
          } else {
            this.sendStatusToWindow('✅ Ο installer ξεκίνησε. Η εφαρμογή θα κλείσει για την ενημέρωση.');
            setTimeout(() => app.quit(), 3000);
          }
        });
      } else if (result.response === 1) {
        shell.showItemInFolder(filePath);
        this.sendStatusToWindow('📂 Άνοιξε ο φάκελος Downloads.');
      }

    } catch (err) {
      this.sendStatusToWindow(`❌ Σφάλμα: ${err.message}`);
      if (err.message !== 'Download cancelled') {
        dialog.showMessageBox(this.mainWindow, {
          type: 'error',
          title: 'Σφάλμα Κατεβάσματος',
          message: 'Αποτυχία αυτόματης λήψης',
          detail: err.message,
          buttons: ['OK']
        });
      }
    } finally {
      this.currentDownload = null;
    }
  }

  // ---------- Internals ----------

  /**
   * Επιλογή σωστού asset (.exe). Προτεραιότητα: installer/setup -> portable.
   */
  pickAsset(releaseInfo) {
    if (!releaseInfo || !Array.isArray(releaseInfo.assets)) return null;

    const exes = releaseInfo.assets.filter(a => /\.exe$/i.test(a.name));

    const installer = exes.find(a => /installer|setup/i.test(a.name));
    if (installer) return installer;

    const portable = exes.find(a => /portable/i.test(a.name));
    if (portable) return portable;

    // fallback: πρώτο .exe
    return exes[0] || null;
  }

  /**
   * Κατεβάζει ένα αρχείο και κάνει resolve ΜΟΝΟ όταν έχει γραφτεί στο δίσκο.
   * Προβάλλει progress γραμμές στο renderer.
   */
  downloadFileWithProgress(url, fileName) {
    return new Promise((resolve, reject) => {
      const outPath = path.join(this.downloadsDir, fileName);
      const file = fs.createWriteStream(outPath);

      let received = 0;
      let total = 0;
      let lastUpdate = 0;
      let aborted = false;

      const request = net.request({
        method: 'GET',
        url,
        redirect: 'follow',
        headers: {
          'User-Agent': 'MakeYourLifeEasier-Updater',
          'Accept': 'application/octet-stream'
        }
      });

      this.currentDownload = {
        cancel: () => {
          aborted = true;
          try { request.abort(); } catch {}
          try { file.destroy(); } catch {}
          fs.unlink(outPath, () => {});
          reject(new Error('Download cancelled'));
        }
      };

      request.on('response', (res) => {
        total = parseInt(res.headers['content-length'], 10) || 0;

        res.on('data', (chunk) => {
          if (aborted) return;
          received += chunk.length;

          const now = Date.now();
          if (now - lastUpdate > 200) {
            if (total > 0) {
              const pct = Math.round((received / total) * 100);
              this.sendStatusToWindow(`📥 Λήψη: ${pct}% (${this.formatBytes(received)} / ${this.formatBytes(total)})`);
            } else {
              this.sendStatusToWindow(`📥 Λήψη: ${this.formatBytes(received)}`);
            }
            lastUpdate = now;
          }
        });

        res.on('error', (err) => {
          try { file.destroy(); } catch {}
          fs.unlink(outPath, () => {});
          reject(err);
        });

        // ΣΗΜΑΝΤΙΚΟ: resolve όταν τελειώσει το write stream
        res.pipe(file);
      });

      file.on('finish', () => {
        file.close(() => {
          try {
            const stat = fs.statSync(outPath);
            if (stat.size === 0) {
              fs.unlinkSync(outPath);
              return reject(new Error('Το κατεβασμένο αρχείο είναι πολύ μικρό (0 bytes)'));
            }
            resolve(outPath);
          } catch (e) {
            reject(e);
          }
        });
      });

      request.on('error', (err) => {
        try { file.destroy(); } catch {}
        fs.unlink(outPath, () => {});
        reject(err);
      });

      request.end();
    });
  }

  async showUpdateDialog(releaseInfo) {
    const changelogUrl = `https://github.com/${this.owner}/${this.repo}/compare/prev...${releaseInfo.tag_name}`;
    const msg = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Νέα Έκδοση Διαθέσιμη!',
      message: `Βρέθηκε νέα έκδοση: ${releaseInfo.tag_name}`,
      detail:
        `Τρέχουσα έκδοση: v${app.getVersion()}\n\n` +
        `**Full Changelog**:\n${changelogUrl}\n\n` +
        `Θέλεις να κατεβάσεις και να εγκαταστήσεις αυτόματα;`,
      buttons: ['Αυτόματη Εγκατάσταση', 'Άνοιγμα Σελίδας', 'Άκυρο'],
      defaultId: 0,
      cancelId: 2
    });

    if (msg.response === 0) {
      await this.downloadAndInstall(releaseInfo);
    } else if (msg.response === 1) {
      this.sendStatusToWindow('🌐 Ανοίγει η σελίδα λήψης...');
      shell.openExternal(releaseInfo.html_url);
    }
  }

  fetchLatestRelease() {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${this.owner}/${this.repo}/releases/latest`,
        method: 'GET',
        headers: {
          'User-Agent': 'MakeYourLifeEasier-Updater',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              resolve(JSON.parse(data));
            } else {
              reject(new Error(`GitHub API ${res.statusCode}: ${data}`));
            }
          } catch (e) { reject(e); }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  // ----- helpers -----

  sendStatusToWindow(text) {
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update-status', text);
      }
    } catch {}
  }

  compareVersions(a, b) {
    const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const da = pa[i] || 0, db = pb[i] || 0;
      if (da > db) return 1;
      if (da < db) return -1;
    }
    return 0;
    }

  formatBytes(bytes, decimals = 2) {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes','KB','MB','GB','TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

module.exports = { SimpleUpdater };
