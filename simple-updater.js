const { app, dialog, shell, ipcMain, net } = require('electron');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const https = require('https');
const http = require('http');

class SimpleUpdater {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.owner = 'thomasthanos';
        this.repo = 'Make_Your_Life_Easier.A.E';
        this.downloadsDir = app.getPath('downloads');
        this.currentDownload = null;
        
        this.installationType = this.detectInstallationType();
        console.log('Installation type detected:', this.installationType);
    }

    detectInstallationType() {
        try {
            const exePath = app.getPath('exe');
            const appPath = app.getAppPath();
            
            console.log('EXE Path:', exePath);
            console.log('App Path:', appPath);
            
            if (appPath.toLowerCase().includes('makeyourlifeeasier') && 
                appPath.toLowerCase().includes('temp')) {
                return 'portable';
            }
            
            if (exePath.toLowerCase().includes('appdata\\local\\programs')) {
                return 'installed';
            }
            
            if (exePath.toLowerCase().includes('program files')) {
                return 'installed';
            }
            
            const exeName = path.basename(exePath).toLowerCase();
            if (exeName.includes('portable')) {
                return 'portable';
            }
            
            const exeDir = path.dirname(exePath);
            const appDir = path.dirname(appPath);
            
            if (exeDir === appDir && !exeDir.toLowerCase().includes('program files')) {
                return 'portable';
            }
            
            return 'installed';
            
        } catch (error) {
            console.error('Error detecting installation type:', error);
            return 'installed';
        }
    }

    // ΒΕΛΤΙΩΜΕΝΗ Μέθοδος για εύρεση asset με προτεραιότητες
    findCorrectAsset(assets) {
        console.log('Looking for asset for installation type:', this.installationType);
        console.log('Available assets:', assets.map(a => a.name));
        
        const assetPriorities = [];
        
        if (this.installationType === 'portable') {
            // Προτεραιότητα για portable
            assetPriorities.push(
                // 1. Ακριβές match για portable
                asset => asset.name.toLowerCase().includes('portable') && asset.name.endsWith('.exe'),
                // 2. Portable με διαφορετικό όνομα
                asset => asset.name.toLowerCase().includes('makeyourlifeeasier') && asset.name.toLowerCase().includes('portable'),
                // 3. Οποιοδήποτε exe με "portable"
                asset => asset.name.toLowerCase().includes('portable') && asset.name.endsWith('.exe')
            );
        } else {
            // Προτεραιότητα για installed
            assetPriorities.push(
                // 1. Installer με setup
                asset => (asset.name.toLowerCase().includes('installer') || asset.name.toLowerCase().includes('setup')) && asset.name.endsWith('.exe'),
                // 2. NSIS installer
                asset => asset.name.toLowerCase().includes('nsis') && asset.name.endsWith('.exe'),
                // 3. Οποιοδήποτε exe με "makeyourlifeeasier"
                asset => asset.name.toLowerCase().includes('makeyourlifeeasier') && asset.name.endsWith('.exe')
            );
        }
        
        // Κοινές προτεραιότητες
        assetPriorities.push(
            // 4. Οποιοδήποτε exe αρχείο
            asset => asset.name.endsWith('.exe'),
            // 5. Οποιοδήποτε αρχείο για Windows
            asset => asset.name.toLowerCase().includes('win') || asset.name.toLowerCase().includes('windows')
        );
        
        for (const priority of assetPriorities) {
            const asset = assets.find(priority);
            if (asset) {
                console.log('Found asset with priority:', asset.name);
                return asset;
            }
        }
        
        console.log('No suitable asset found');
        return null;
    }

    // ΒΕΛΤΙΩΜΕΝΗ Μέθοδος λήψης με redirect handling
    async downloadAndInstall(releaseInfo) {
        if (this.currentDownload) {
            this.currentDownload.cancel();
        }

        try {
            this.sendStatusToWindow('📦 Εύρεση κατάλληλου αρχείου...');
            
            const installTypeText = this.installationType === 'portable' ? 'Portable' : 'Εγκατεστημένη';
            this.sendStatusToWindow(`🔍 Τύπος εγκατάστασης: ${installTypeText}`);
            
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
            
            // Κατέβασμα του αρχείου με βελτιωμένο download
            const filePath = await this.downloadFileWithRetry(directUrl, asset.name);
            
            // Έλεγχος του αρχείου
            await this.verifyDownloadedFile(filePath);
            
            this.sendStatusToWindow('✅ Κατέβασμα ολοκληρώθηκε!');
            
            await this.delay(1000);
            
            // Αυτόματη εγκατάσταση χωρίς dialog
            await this.runInstaller(filePath, asset.name);

        } catch (error) {
            this.currentDownload = null;
            this.sendStatusToWindow(`❌ Σφάλμα: ${error.message}`);
            
            if (error.message !== 'Download cancelled') {
                // Fallback: Άνοιγμα releases page
                this.sendStatusToWindow('🔄 Ανακατεύθυνση σε manual download...');
                shell.openExternal(`https://github.com/${this.owner}/${this.repo}/releases`);
                
                dialog.showMessageBox(this.mainWindow, {
                    type: 'error',
                    title: 'Σφάλμα Αυτόματης Ενημέρωσης',
                    message: 'Αποτυχία αυτόματης ενημέρωσης',
                    detail: `Σφάλμα: ${error.message}\n\nΗ σελίδα λήψης θα ανοίξει για manual download.`,
                    buttons: ['OK']
                });
            }
        }
    }

    // ΝΕΑ Μέθοδος με retry logic
    async downloadFileWithRetry(url, fileName, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.sendStatusToWindow(`📥 Προσπάθεια λήψης ${attempt}/${maxRetries}...`);
                return await this.downloadFileWithProgress(url, fileName);
            } catch (error) {
                lastError = error;
                console.log(`Download attempt ${attempt} failed:`, error.message);
                
                if (attempt < maxRetries) {
                    this.sendStatusToWindow(`🔄 Αποτυχία, νέα προσπάθεια σε 3 δευτερόλεπτα...`);
                    await this.delay(3000);
                }
            }
        }
        
        throw lastError;
    }

    // ΒΕΛΤΙΩΜΕΝΗ Μέθοδος λήψης με redirect handling
    downloadFileWithProgress(url, fileName) {
        return new Promise((resolve, reject) => {
            const filePath = path.join(this.downloadsDir, fileName);
            const file = fs.createWriteStream(filePath);
            
            let receivedBytes = 0;
            let totalBytes = 0;
            let lastUpdateTime = 0;
            let isCancelled = false;
            let redirectCount = 0;
            const MAX_REDIRECTS = 5;

            console.log('Starting download from:', url);

            const makeRequest = (requestUrl) => {
                const isHttps = requestUrl.startsWith('https://');
                const requestModule = isHttps ? https : http;
                
                const urlObj = new URL(requestUrl);
                const options = {
                    hostname: urlObj.hostname,
                    port: urlObj.port,
                    path: urlObj.pathname + urlObj.search,
                    method: 'GET',
                    headers: {
                        'User-Agent': 'MakeYourLifeEasier-Updater/1.0',
                        'Accept': 'application/octet-stream'
                    }
                };

                console.log('Making request to:', options.hostname, options.path);

                const request = requestModule.request(options, (response) => {
                    if (isCancelled) return;

                    console.log('Response status:', response.statusCode);
                    console.log('Response headers:', response.headers);

                    // Handle redirects
                    if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
                        redirectCount++;
                        if (redirectCount > MAX_REDIRECTS) {
                            reject(new Error('Too many redirects'));
                            return;
                        }
                        
                        const redirectUrl = response.headers.location;
                        console.log('Redirecting to:', redirectUrl);
                        
                        // Close current file stream
                        file.destroy();
                        
                        // Retry with new URL
                        setTimeout(() => {
                            makeRequest(redirectUrl);
                        }, 100);
                        return;
                    }

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

                // Set timeout
                request.setTimeout(30000, () => {
                    request.destroy();
                    reject(new Error('Request timeout'));
                });

                request.end();

                // Store for cancellation
                this.currentDownload = {
                    cancel: () => {
                        isCancelled = true;
                        request.destroy();
                        file.destroy();
                        fs.unlink(filePath, () => {});
                        reject(new Error('Download cancelled'));
                    }
                };
            };

            // Start the request
            makeRequest(url);
        });
    }

    // ΒΕΛΤΙΩΜΕΝΗ Μέθοδος εκτέλεσης installer
    async runInstaller(filePath, assetName) {
        return new Promise((resolve, reject) => {
            this.sendStatusToWindow('🚀 Προετοιμασία ενημέρωσης...');
            
            const tempDir = require('os').tmpdir();
            const tempFilePath = path.join(tempDir, `installer-${Date.now()}-${path.basename(assetName)}`);
            
            console.log('Copying installer to temp location:', tempFilePath);
            
            // Κλείσιμο όλων των resources πρώτα
            this.cleanup();
            
            setTimeout(async () => {
                try {
                    // Αντιγραφή αρχείου σε temp location
                    await this.robustCopyFile(filePath, tempFilePath);
                    console.log('File copied successfully to temp location');
                    
                    // Προσπάθεια διαγραφής του αρχικού αρχείου
                    await this.safeUnlink(filePath);
                    
                    // Εκτέλεση από το temp location
                    this.sendStatusToWindow('🎯 Εκκίνηση installer...');
                    
                    // Προσπάθεια 1: Χρήση spawn με detached process
                    try {
                        const { spawn } = require('child_process');
                        const installerProcess = spawn(tempFilePath, [], {
                            detached: true,
                            stdio: 'ignore',
                            windowsHide: true
                        });
                        
                        installerProcess.unref();
                        console.log('Installer process started with spawn');
                    } catch (spawnError) {
                        console.log('Spawn failed, trying exec...', spawnError);
                        
                        // Προσπάθεια 2: Χρήση exec
                        const { exec } = require('child_process');
                        exec(`"${tempFilePath}"`, { windowsHide: true }, (error) => {
                            if (error) {
                                console.error('Exec also failed:', error);
                                throw error;
                            }
                        });
                    }
                    
                    console.log('Installer process started, quitting app...');
                    this.sendStatusToWindow('✅ Εγκατάσταση ξεκίνησε! Η εφαρμογή κλείνει...');
                    
                    // Κλείσιμο εφαρμογής μετά από 2 δευτερόλεπτα
                    setTimeout(() => {
                        app.quit();
                    }, 2000);
                    
                    resolve();
                    
                } catch (error) {
                    console.error('Error in installer execution:', error);
                    
                    // Τελική προσπάθεια: άνοιγμα με shell
                    this.sendStatusToWindow('🔄 Τελική προσπάθεια...');
                    
                    try {
                        shell.openPath(tempFilePath);
                        this.sendStatusToWindow('✅ Εγκατάσταση ξεκίνησε!');
                        setTimeout(() => app.quit(), 2000);
                        resolve();
                    } catch (shellError) {
                        console.error('All methods failed:', shellError);
                        this.sendStatusToWindow('❌ Αποτυχία εκκίνησης installer');
                        
                        // Άνοιγμα του φακέλου για manual installation
                        shell.showItemInFolder(tempFilePath);
                        reject(shellError);
                    }
                }
            }, 1000);
        });
    }

    // ΒΕΛΤΙΩΜΕΝΗ Μέθοδος αντιγραφής αρχείων
    robustCopyFile(source, target) {
        return new Promise((resolve, reject) => {
            console.log(`Copying from ${source} to ${target}`);
            
            if (!fs.existsSync(source)) {
                reject(new Error('Source file does not exist'));
                return;
            }

            // Διάβασμα ολόκληρου του αρχείου στη μνήμη για μικρά αρχεία
            const stats = fs.statSync(source);
            if (stats.size < 50 * 1024 * 1024) { // 50MB
                try {
                    const data = fs.readFileSync(source);
                    fs.writeFileSync(target, data);
                    console.log('File copied synchronously');
                    resolve();
                    return;
                } catch (syncError) {
                    console.log('Sync copy failed, trying stream...', syncError);
                }
            }

            // Stream copy για μεγάλα αρχεία
            const readStream = fs.createReadStream(source);
            const writeStream = fs.createWriteStream(target);
            
            let errorOccurred = false;
            
            const handleError = (error) => {
                if (!errorOccurred) {
                    errorOccurred = true;
                    console.error('Copy error:', error);
                    readStream.destroy();
                    writeStream.destroy();
                    reject(error);
                }
            };
            
            readStream.on('error', handleError);
            writeStream.on('error', handleError);
            
            writeStream.on('close', () => {
                if (!errorOccurred) {
                    console.log('File copy completed successfully');
                    resolve();
                }
            });
            
            readStream.pipe(writeStream);
        });
    }

    // Ασφαλής διαγραφή αρχείου
    async safeUnlink(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('Original file deleted successfully');
            }
        } catch (unlinkError) {
            console.warn('Could not delete original file:', unlinkError.message);
            // Μη απορρίπτουμε το error - συνεχίζουμε
        }
    }

    // Μέθοδος cleanup
    cleanup() {
        try {
            if (this.currentDownload) {
                this.currentDownload.cancel();
                this.currentDownload = null;
            }
            
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
            if (stats.size < 1024 * 100) { // 100KB minimum
                // Έλεγχος αν είναι HTML error page
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    if (content.includes('<html') || content.includes('<!DOCTYPE') || content.includes('error')) {
                        fs.unlinkSync(filePath);
                        reject(new Error('Το κατεβασμένο αρχείο είναι HTML error page'));
                        return;
                    }
                } catch (readError) {
                    // Αγνοούμε read errors για binary files
                }
                reject(new Error(`Το κατεβασμένο αρχείο είναι πολύ μικρό (${stats.size} bytes)`));
                return;
            }

            console.log(`File verified: ${filePath}, Size: ${stats.size} bytes`);
            resolve();
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
}

module.exports = SimpleUpdater;