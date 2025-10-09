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
            this.sendStatusToWindow('🚀 Προετοιμασία ενημέρωσης...');
            
            const tempDir = require('os').tmpdir();
            const tempFilePath = require('path').join(tempDir, `installer-${Date.now()}-${assetName}`);
            
            console.log('Copying installer to temp location:', tempFilePath);
            
            // Κλείσιμο όλων των resources πρώτα
            this.cleanup();
            
            setTimeout(async () => {
                try {
                    // Αντιγραφή αρχείου σε temp location για να αποφύγουμε locks
                    await this.copyFile(filePath, tempFilePath);
                    console.log('File copied successfully to temp location');
                    
                    // Διαγραφή του αρχικού αρχείου (απελευθερώνει το lock)
                    try {
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                            console.log('Original file deleted');
                        }
                    } catch (unlinkError) {
                        console.warn('Could not delete original file:', unlinkError.message);
                        // Συνεχίζουμε ούτως ή άλλως
                    }
                    
                    // Εκτέλεση από το temp location
                    this.sendStatusToWindow('🎯 Εκκίνηση installer...');
                    
                    const { spawn } = require('child_process');
                    const installerProcess = spawn(tempFilePath, [], {
                        detached: true,
                        stdio: 'ignore',
                        windowsHide: true
                    });
                    
                    installerProcess.unref();
                    
                    console.log('Installer process started, quitting app...');
                    this.sendStatusToWindow('✅ Εγκατάσταση ξεκίνησε! Η εφαρμογή κλείνει...');
                    
                    // Κλείσιμο εφαρμογής μετά από 2 δευτερόλεπτα
                    setTimeout(() => {
                        app.quit();
                    }, 2000);
                    
                    resolve();
                    
                } catch (error) {
                    console.error('Error in installer execution:', error);
                    
                    // Fallback: άνοιγμα με shell (χωρίς spawn)
                    this.sendStatusToWindow('🔄 Δοκιμή εναλλακτικής μεθόδου...');
                    
                    try {
                        await shell.openPath(tempFilePath);
                        this.sendStatusToWindow('✅ Εγκατάσταση ξεκίνησε!');
                        setTimeout(() => app.quit(), 2000);
                        resolve();
                    } catch (shellError) {
                        console.error('Fallback also failed:', shellError);
                        this.sendStatusToWindow('❌ Αποτυχία εκκίνησης installer');
                        reject(shellError);
                    }
                }
            }, 1000); // Μικρή καθυστέρηση για να διασφαλιστεί το κλείσιμο handles
        });
    }

    // Βοηθητική function για αντιγραφή αρχείων
    copyFile(source, target) {
        return new Promise((resolve, reject) => {
            console.log(`Copying from ${source} to ${target}`);
            
            // Έλεγχος ότι το source αρχείο υπάρχει
            if (!fs.existsSync(source)) {
                reject(new Error('Source file does not exist'));
                return;
            }

            const readStream = fs.createReadStream(source);
            const writeStream = fs.createWriteStream(target);
            
            let errorOccurred = false;
            
            readStream.on('error', (error) => {
                if (!errorOccurred) {
                    errorOccurred = true;
                    console.error('Read stream error:', error);
                    reject(error);
                }
            });
            
            writeStream.on('error', (error) => {
                if (!errorOccurred) {
                    errorOccurred = true;
                    console.error('Write stream error:', error);
                    reject(error);
                }
            });
            
            writeStream.on('close', () => {
                if (!errorOccurred) {
                    console.log('File copy completed successfully');
                    resolve();
                }
            });
            
            readStream.pipe(writeStream);
        });
    }

    // Μέθοδος cleanup για κλείσιμο handles
    cleanup() {
        try {
            // Κλείσιμο τυχόν ανοιχτών streams ή handles
            if (this.currentDownload) {
                this.currentDownload.cancel();
                this.currentDownload = null;
            }
            
            // Εξαναγκασμός garbage collection (αν είναι διαθέσιμο)
            if (global.gc) {
                global.gc();
            }
        } catch (error) {
            console.warn('Cleanup warning:', error.message);
        }
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

    // Εναλλακτική μέθοδος με χρήση exec
    async runInstallerExec(filePath, assetName) {
        return new Promise((resolve, reject) => {
            this.sendStatusToWindow('🚀 Εκκίνηση ενημέρωσης...');
            
            const tempDir = require('os').tmpdir();
            const tempFilePath = require('path').join(tempDir, `installer-${Date.now()}.exe`);
            
            this.cleanup();
            
            setTimeout(async () => {
                try {
                    // Αντιγραφή σε temp location
                    await this.copyFile(filePath, tempFilePath);
                    
                    // Χρήση exec αντί για spawn
                    const { exec } = require('child_process');
                    exec(`"${tempFilePath}"`, (error, stdout, stderr) => {
                        if (error) {
                            console.error('Exec error:', error);
                            reject(error);
                        } else {
                            console.log('Installer completed successfully');
                            this.sendStatusToWindow('✅ Εγκατάσταση ολοκληρώθηκε!');
                            setTimeout(() => app.quit(), 1000);
                            resolve();
                        }
                    });
                    
                } catch (error) {
                    console.error('Error:', error);
                    reject(error);
                }
            }, 1500);
        });
    }
}

module.exports = SimpleUpdater;