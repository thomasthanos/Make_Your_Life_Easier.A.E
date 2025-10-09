const { app, dialog, shell, ipcMain, net } = require('electron');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class SimpleUpdater {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.owner = 'thomasthanos';
        this.repo = 'Make_Your_Life_Easier.A.E';
        this.downloadsDir = app.getPath('downloads');
        this.currentDownload = null;
        
        // Αυτόματος εντοπισμός τύπου εγκατάστασης
        this.installationType = this.detectInstallationType();
        console.log('Installation type detected:', this.installationType);
    }

    // Μέθοδος για αυτόματο εντοπισμό τύπου εγκατάστασης
    detectInstallationType() {
        try {
            const exePath = app.getPath('exe');
            const appPath = app.getAppPath();
            
            console.log('EXE Path:', exePath);
            console.log('App Path:', appPath);
            
            // Έλεγχος 1: Αν το appPath περιέχει "MakeYourLifeEasier" (Portable unpack directory)
            if (appPath.toLowerCase().includes('makeyourlifeeasier') && 
                appPath.toLowerCase().includes('temp')) {
                console.log('Detected: Portable version (MakeYourLifeEasier in TEMP)');
                return 'portable';
            }
            
            // Έλεγχος 2: Αν βρισκόμαστε στο AppData/Local/Programs (Installed via installer)
            if (exePath.toLowerCase().includes('appdata\\local\\programs')) {
                console.log('Detected: Installed version (AppData/Local/Programs)');
                return 'installed';
            }
            
            // Έλεγχος 3: Αν βρισκόμαστε σε Program Files (Installed)
            if (exePath.toLowerCase().includes('program files')) {
                console.log('Detected: Installed version (Program Files)');
                return 'installed';
            }
            
            // Έλεγχος 4: Αν το εκτελέσιμο έχει "Portable" στο όνομα
            const exeName = path.basename(exePath).toLowerCase();
            if (exeName.includes('portable')) {
                console.log('Detected: Portable version (by executable name)');
                return 'portable';
            }
            
            // Έλεγχος 5: Αν το app είναι στον ίδιο φάκελο με το exe (Portable)
            const exeDir = path.dirname(exePath);
            const appDir = path.dirname(appPath);
            
            if (exeDir === appDir && !exeDir.toLowerCase().includes('program files')) {
                console.log('Detected: Portable version (same directory, not Program Files)');
                return 'portable';
            }
            
            // Default: Θεωρούμε installed
            console.log('Detected: Installed version (default)');
            return 'installed';
            
        } catch (error) {
            console.error('Error detecting installation type:', error);
            return 'installed'; // Fallback
        }
    }

    // Μέθοδος για εύρεση του σωστού asset
    findCorrectAsset(assets) {
        console.log('Looking for asset for installation type:', this.installationType);
        console.log('Available assets:', assets.map(a => a.name));
        
        // Πρώτα ψάχνουμε για ακριβή match βασισμένο στον τύπο εγκατάστασης
        if (this.installationType === 'portable') {
            // Ψάχνει για portable version
            const portableAsset = assets.find(asset => 
                asset.name.toLowerCase().includes('portable') && 
                asset.name.endsWith('.exe')
            );
            
            if (portableAsset) {
                console.log('Found portable asset:', portableAsset.name);
                return portableAsset;
            }
            
            console.log('No portable asset found, falling back to installer');
        }
        
        // Για installed - ψάχνει για installer
        const installerAsset = assets.find(asset => 
            (asset.name.toLowerCase().includes('installer') || 
             asset.name.toLowerCase().includes('setup')) && 
            asset.name.endsWith('.exe')
        );
        
        if (installerAsset) {
            console.log('Found installer asset:', installerAsset.name);
            return installerAsset;
        }
        
        // Fallback: οποιοδήποτε exe αρχείο που περιέχει το όνομα της εφαρμογής
        const appNameAsset = assets.find(asset => 
            asset.name.toLowerCase().includes('makeyourlifeeasier') && 
            asset.name.endsWith('.exe')
        );
        
        if (appNameAsset) {
            console.log('Found app name asset:', appNameAsset.name);
            return appNameAsset;
        }
        
        // Ultimate fallback: οποιοδήποτε exe αρχείο
        const anyExe = assets.find(asset => asset.name.endsWith('.exe'));
        if (anyExe) {
            console.log('Found fallback asset:', anyExe.name);
            return anyExe;
        }
        
        return null;
    }

    async downloadAndInstall(releaseInfo) {
        if (this.currentDownload) {
            this.currentDownload.cancel();
        }

        try {
            this.sendStatusToWindow('📦 Εύρεση κατάλληλου αρχείου...');
            
            // Εμφάνιση τύπου εγκατάστασης
            const installTypeText = this.installationType === 'portable' ? 'Portable' : 'Εγκατεστημένη';
            this.sendStatusToWindow(`🔍 Τύπος εγκατάστασης: ${installTypeText}`);
            
            // Βρες το σωστό αρχείο
            const asset = this.findCorrectAsset(releaseInfo.assets);
            
            if (!asset) {
                console.log('Available assets:', releaseInfo.assets.map(a => a.name));
                throw new Error('Δεν βρέθηκε κατάλληλο αρχείο εγκατάστασης');
            }

            this.sendStatusToWindow(`📥 Κατέβασμα: ${asset.name}...`);
            
            // Χρησιμοποίησε το direct download URL από το GitHub
            const directUrl = asset.browser_download_url;
            
            if (!directUrl) {
                throw new Error('Δεν βρέθηκε URL λήψης για το αρχείο');
            }

            console.log('Downloading from:', directUrl);
            
            // Κατέβασμα του αρχείου
            const filePath = await this.downloadFileWithProgress(directUrl, asset.name);
            
            // Έλεγχος του αρχείου
            await this.verifyDownloadedFile(filePath);
            
            this.sendStatusToWindow('✅ Κατέβασμα ολοκληρώθηκε!');
            
            await this.delay(1500);
            
            // Προσαρμοσμένο μήνυμα βασισμένο στον τύπο
            const isPortableAsset = asset.name.toLowerCase().includes('portable');
            const isPortableInstallation = this.installationType === 'portable';
            
            let detailMessage;
            let customButtons = ['Εκτέλεση Τώρα', 'Άνοιγμα Φακέλου', 'Ακύρωση'];

            if (isPortableAsset && isPortableInstallation) {
                detailMessage = `Το portable αρχείο ${asset.name} κατεβήκε. Θέλετε να το ανοίξετε τώρα για να αντικαταστήσετε την τρέχουσα έκδοση;`;
            } else if (!isPortableAsset && isPortableInstallation) {
                detailMessage = `Το installer ${asset.name} κατεβήκε. Προσοχή: Είστε σε portable έκδοση αλλά κατεβάσατε installer. Θέλετε να το εκτελέσετε για εγκατάσταση;`;
            } else if (isPortableAsset && !isPortableInstallation) {
                detailMessage = `Το portable αρχείο ${asset.name} κατεβήκε. Προσοχή: Είστε σε εγκατεστημένη έκδοση αλλά κατεβάσατε portable. Θέλετε να το εκτελέσετε;`;
            } else {
                detailMessage = `Το installer ${asset.name} κατεβήκε. Θέλετε να ανοίξει τώρα ο installer για να εγκαταστήσετε την νέα έκδοση;`;
            }

            const installResult = await dialog.showMessageBox(this.mainWindow, {
                type: 'question',
                title: 'Ενημέρωση Έτοιμη',
                message: 'Η λήψη ολοκληρώθηκε!',
                detail: detailMessage,
                buttons: customButtons,
                defaultId: 0,
                cancelId: 2
            });

            if (installResult.response === 0) {
                await this.runInstaller(filePath, asset.name);
            } else if (installResult.response === 1) {
                shell.showItemInFolder(filePath);
                this.sendStatusToWindow('📂 Άνοιξε ο φάκελος Downloads');
            }

        } catch (error) {
            this.currentDownload = null;
            this.sendStatusToWindow(`❌ Σφάλμα: ${error.message}`);
            
            if (error.message !== 'Download cancelled') {
                dialog.showMessageBox(this.mainWindow, {
                    type: 'error',
                    title: 'Σφάλμα Κατεβάσματος',
                    message: 'Αποτυχία αυτόματης ενημέρωσης',
                    detail: error.message,
                    buttons: ['OK']
                });
            }
        }
    }

    async runInstaller(filePath, assetName) {
        return new Promise((resolve, reject) => {
            this.sendStatusToWindow('🚀 Εκκίνηση ενημέρωσης...');
            
            const isPortableAsset = assetName.toLowerCase().includes('portable');
            const isPortableInstallation = this.installationType === 'portable';
            
            if (isPortableAsset) {
                this.sendStatusToWindow('🔄 Αντικατάσταση portable έκδοσης...');
            } else {
                this.sendStatusToWindow('🔧 Εκκίνηση installer...');
            }
            
            shell.openExternal(filePath)
                .then(() => {
                    if (isPortableAsset) {
                        this.sendStatusToWindow('✅ Portable ενημέρωση εκκινήθηκε! Κλείστε αυτή την εφαρμογή και ανοίξτε την νέα.');
                    } else {
                        if (isPortableInstallation) {
                            this.sendStatusToWindow('✅ Installer εκκινήθηκε! Αυτή η portable έκδοση θα παραμείνει ανοιχτή.');
                        } else {
                            this.sendStatusToWindow('✅ Installer εκκινήθηκε! Η εφαρμογή θα κλείσει για εγκατάσταση.');
                            
                            // Κλείσιμο μόνο για installed versions που χρησιμοποιούν installer
                            setTimeout(() => {
                                app.quit();
                            }, 2000);
                        }
                    }
                    resolve();
                })
                .catch((error) => {
                    this.sendStatusToWindow('❌ Σφάλμα κατά την εκκίνηση');
                    
                    // Fallback με exec
                    exec(`"${filePath}"`, (execError) => {
                        if (execError) {
                            this.sendStatusToWindow('❌ Αποτυχία εκκίνησης. Ανοίξτε το χειροκίνητα.');
                            reject(new Error('Δεν μπορώ να ανοίξω τον installer αυτόματα'));
                        } else {
                            if (isPortableAsset) {
                                this.sendStatusToWindow('✅ Portable ενημέρωση εκκινήθηκε!');
                            } else {
                                if (isPortableInstallation) {
                                    this.sendStatusToWindow('✅ Installer εκκινήθηκε!');
                                } else {
                                    this.sendStatusToWindow('✅ Installer εκκινήθηκε! Η εφαρμογή θα κλείσει για εγκατάσταση.');
                                    setTimeout(() => {
                                        app.quit();
                                    }, 2000);
                                }
                            }
                            resolve();
                        }
                    });
                });
        });
    }

    async verifyDownloadedFile(filePath) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(filePath)) {
                reject(new Error('Το κατεβασμένο αρχείο δεν βρέθηκε'));
                return;
            }

            const stats = fs.statSync(filePath);
            if (stats.size < 1024 * 100) {
                const content = fs.readFileSync(filePath, 'utf8');
                if (content.includes('<html') || content.includes('<!DOCTYPE')) {
                    fs.unlinkSync(filePath);
                    reject(new Error('Το κατεβασμένο αρχείο είναι HTML (πιθανόν error page)'));
                    return;
                }
                reject(new Error(`Το κατεβασμένο αρχείο είναι πολύ μικρό (${stats.size} bytes)`));
                return;
            }

            console.log(`File verified: ${filePath}, Size: ${stats.size} bytes`);
            resolve();
        });
    }

    downloadFileWithProgress(url, fileName) {
        return new Promise((resolve, reject) => {
            const filePath = path.join(this.downloadsDir, fileName);
            const file = fs.createWriteStream(filePath);
            
            let receivedBytes = 0;
            let totalBytes = 0;
            let lastUpdateTime = 0;
            let isCancelled = false;

            console.log('Starting download from:', url);

            const request = net.request({
                method: 'GET',
                url: url,
                redirect: 'follow'
            });

            request.setHeader('User-Agent', 'MakeYourLifeEasier-Updater');
            request.setHeader('Accept', 'application/octet-stream');

            this.currentDownload = {
                cancel: () => {
                    isCancelled = true;
                    request.abort();
                    file.destroy();
                    fs.unlink(filePath, () => {});
                    reject(new Error('Download cancelled'));
                }
            };

            request.on('response', (response) => {
                if (isCancelled) return;

                console.log('Response status:', response.statusCode);

                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }

                totalBytes = parseInt(response.headers['content-length'], 10) || 0;
                console.log('Total bytes to download:', totalBytes);
                
                response.on('data', (chunk) => {
                    if (isCancelled) return;

                    receivedBytes += chunk.length;
                    
                    const currentTime = Date.now();
                    if (currentTime - lastUpdateTime > 200) {
                        if (totalBytes > 0) {
                            const percent = Math.round((receivedBytes / totalBytes) * 100);
                            this.sendStatusToWindow(`📥 Κατέβασμα: ${percent}% (${this.formatBytes(receivedBytes)} / ${this.formatBytes(totalBytes)})`);
                        } else {
                            this.sendStatusToWindow(`📥 Κατέβασμα: ${this.formatBytes(receivedBytes)}`);
                        }
                        lastUpdateTime = currentTime;
                    }
                });

                response.on('error', (error) => {
                    if (isCancelled) return;
                    console.error('Response error:', error);
                    file.destroy();
                    fs.unlink(filePath, () => {});
                    reject(error);
                });

                response.pipe(file);
            });

            request.on('error', (error) => {
                if (isCancelled) return;
                console.error('Request error:', error);
                file.destroy();
                fs.unlink(filePath, () => {});
                reject(error);
            });

            request.on('finish', () => {
                if (isCancelled) return;
                file.close((err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    console.log('Download finished, file saved to:', filePath);
                    resolve(filePath);
                });
            });

            request.end();
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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
        const installTypeText = this.installationType === 'portable' ? 'Portable' : 'Εγκατεστημένη';
        
        dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: 'Νέα Έκδοση Διαθέσιμη!',
            message: `Βρέθηκε νέα έκδοση: ${releaseInfo.tag_name}`,
            detail: `Τρέχουσα έκδοση: v${app.getVersion()}\nΤύπος: ${installTypeText}\n\n${releaseInfo.body || 'Νέες λειτουργίες και βελτιώσεις.'}\n\nΘέλετε να κατεβάσετε και να εγκαταστήσετε αυτόματα;`,
            buttons: ['Αυτόματη Εγκατάσταση', 'Άνοιγμα Σελίδας', 'Άκυρο'],
            defaultId: 0,
            cancelId: 2
        }).then((result) => {
            if (result.response === 0) {
                this.downloadAndInstall(releaseInfo);
            } else if (result.response === 1) {
                this.sendStatusToWindow('🌐 Ανοίγει η σελίδα λήψης...');
                shell.openExternal(releaseInfo.html_url);
            }
        });
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

            const https = require('https');
            const req = https.request(options, (res) => {
                let data = '';

                console.log('GitHub API response status:', res.statusCode);

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        if (res.statusCode === 200) {
                            const releaseInfo = JSON.parse(data);
                            console.log('Latest release:', releaseInfo.tag_name);
                            console.log('Assets:', releaseInfo.assets.map(a => a.name));
                            resolve(releaseInfo);
                        } else if (res.statusCode === 404) {
                            reject(new Error('Repository or release not found'));
                        } else {
                            reject(new Error(`GitHub API error: ${res.statusCode} - ${data}`));
                        }
                    } catch (error) {
                        console.error('Parse error:', error);
                        reject(new Error('Failed to parse release info'));
                    }
                });
            });

            req.on('error', (error) => {
                console.error('Request error:', error);
                reject(new Error(`Network error: ${error.message}`));
            });

            req.setTimeout(15000, () => {
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
        console.log('Updater:', message);
    }
    // Προσθήκη μετά την fetchLatestRelease()
getAssetDownloadUrl(releaseInfo) {
  // Προτεραιότητα: installer αρχείο
  const preferredAssets = [
    'MakeYourLifeEasier-installer.exe',
    'MakeYourLifeEasier-Portable.exe',
    '.exe' // Fallback για οποιοδήποτε exe
  ];

  if (releaseInfo.assets && releaseInfo.assets.length > 0) {
    for (const pattern of preferredAssets) {
      const asset = releaseInfo.assets.find(a => 
        a.name.includes(pattern)
      );
      if (asset) {
        return asset.browser_download_url;
      }
    }
    
    // Fallback στο πρώτο asset
    return releaseInfo.assets[0].browser_download_url;
  }
  
  return null;
}

// Ανανέωση της showUpdateDialog()
async showUpdateDialog(releaseInfo) {
  const downloadUrl = this.getAssetDownloadUrl(releaseInfo);
  
  if (!downloadUrl) {
    this.sendStatusToWindow('❌ Δεν βρέθηκαν αρχεία λήψης στο release');
    return;
  }

  const result = await dialog.showMessageBox(this.mainWindow, {
    type: 'info',
    title: 'Νέα Έκδοση Διαθέσιμη!',
    message: `Βρέθηκε νέα έκδοση: ${releaseInfo.tag_name}`,
    detail: `Τρέχουσα έκδοση: v${app.getVersion()}\n\n${releaseInfo.body || 'Νέες λειτουργίες και βελτιώσεις.'}\n\nΘέλετε να κατεβάσετε και να εγκαταστήσετε την ενημέρωση;`,
    buttons: ['Κατέβασμα & Εγκατάσταση', 'Άκυρο'],
    defaultId: 0,
    cancelId: 1
  });

  if (result.response === 0) {
    await this.downloadAndInstallUpdate(downloadUrl, releaseInfo.tag_name);
  }
}

// Νέα συνάρτηση για κατέβασμα και εγκατάσταση
async downloadAndInstallUpdate(downloadUrl, version) {
  try {
    this.sendStatusToWindow('📦 Κατέβασμα ενημέρωσης...');
    
    const downloadsPath = require('electron').app.getPath('downloads');
    const fileName = `MakeYourLifeEasier-Update-${version}.exe`;
    const filePath = require('path').join(downloadsPath, fileName);

    // Κατέβασμα του αρχείου
    await this.downloadFile(downloadUrl, filePath);
    
    // Έλεγχος ότι το αρχείο δεν είναι corrupt
    const stats = require('fs').statSync(filePath);
    if (stats.size === 0) {
      throw new Error('Το κατεβασμένο αρχείο είναι κενό (0 bytes)');
    }

    this.sendStatusToWindow('🚀 Εκκίνηση εγκατάστασης...');
    
    // Εκτέλεση του installer
    const { exec } = require('child_process');
    exec(`"${filePath}"`, (error) => {
      if (error) {
        this.sendStatusToWindow(`❌ Σφάλμα εκκίνησης installer: ${error.message}`);
      } else {
        this.sendStatusToWindow('✅ Εγκατάσταση ξεκίνησε! Η εφαρμογή θα κλείσει.');
        setTimeout(() => {
          require('electron').app.quit();
        }, 2000);
      }
    });

  } catch (error) {
    this.sendStatusToWindow(`❌ Σφάλμα: ${error.message}`);
    
    // Fallback: Άνοιγμα GitHub releases page
    const { shell } = require('electron');
    shell.openExternal(`https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/releases`);
  }
}

// Βοηθητική συνάρτηση για κατέβασμα
downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    const https = require('https');
    const file = fs.createWriteStream(filePath);

    const request = https.get(url, (response) => {
      // Ανακατεύθυνση
      if (response.statusCode === 302 || response.statusCode === 301) {
        this.downloadFile(response.headers.location, filePath)
          .then(resolve)
          .catch(reject);
        return;
      }

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
          this.sendStatusToWindow(`📥 Κατέβασμα: ${percent}%`);
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });
    });

    request.on('error', (err) => {
      fs.unlink(filePath, () => reject(err));
    });

    file.on('error', (err) => {
      fs.unlink(filePath, () => reject(err));
    });

    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}
}

module.exports = SimpleUpdater;