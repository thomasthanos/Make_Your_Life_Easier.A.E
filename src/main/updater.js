/**
 * Auto-Updater Module
 * Handles application updates and update UI communication
 */

const { autoUpdater } = require('electron-updater');
const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Update state
let updateAvailable = false;
let pendingUpdateInfo = null;
let updateDownloaded = false;
let retryCount = 0;
const MAX_RETRIES = 3;
let downloadStartTime = null;
let lastBytesReceived = 0;

// Update info paths
const updateInfoPrimaryPath = path.join(app.getPath('userData'), 'update-info.json');
const updateInfoSecondaryPath = process.platform === 'win32'
    ? path.join(process.env.PROGRAMDATA || path.join('C:\\', 'ProgramData'), 'MakeYourLifeEasier', 'update-info.json')
    : null;

/**
 * Configure auto-updater settings
 */
function configureAutoUpdater() {
    // Enable differential downloads for faster updates (80% smaller)
    // GitHub Actions workflow automatically uploads .blockmap files
    autoUpdater.disableDifferentialDownload = false;
    
    // Automatic download and installation
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    
    // Request headers for cache busting
    autoUpdater.requestHeaders = {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
    };
    
    // Enable checksum verification for security
    autoUpdater.disableWebInstaller = false;
    
    // Allow prerelease versions if needed (set to false for production)
    autoUpdater.allowPrerelease = false;
    
    // Set update check interval (4 hours)
    autoUpdater.allowDowngrade = false;
    
    // Configure logger for better debugging
    try {
        const log = require('electron-log');
        autoUpdater.logger = log;
        autoUpdater.logger.transports.file.level = 'info';
        
        // Log file location for troubleshooting
        if (process.env.NODE_ENV === 'development') {
            debug('info', `Update logs: ${log.transports.file.getFile().path}`);
        }
    } catch (err) {
        // electron-log not available, continue without logging
    }
}

/**
 * Clean up the updater cache directory
 * Removes downloaded installers and temp files after successful update
 * @param {Function} debug - Debug logging function
 */
async function cleanupUpdaterCache(debug) {
    try {
        const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
        const updaterCachePath = path.join(localAppData, 'make-your-life-easier-updater');

        try {
            await fs.promises.access(updaterCachePath);
        } catch {
            return;
        }

        const files = await fs.promises.readdir(updaterCachePath).catch(() => []);
        let cleanedSize = 0;

        for (const file of files) {
            const filePath = path.join(updaterCachePath, file);
            try {
                const stat = await fs.promises.stat(filePath).catch(() => null);
                if (!stat) continue;

                if (stat.isDirectory()) {
                    await fs.promises.rm(filePath, { recursive: true, force: true, maxRetries: 2 });
                    debug('info', `Cleaned updater cache directory: ${file}`);
                } else {
                    cleanedSize += stat.size;
                    await fs.promises.unlink(filePath).catch(() => { });
                    debug('info', `Cleaned updater cache file: ${file}`);
                }
            } catch (err) {
                debug('warn', `Could not clean ${file}: ${err.code || err.message}`);
            }
        }

        if (cleanedSize > 0) {
            const sizeMB = (cleanedSize / (1024 * 1024)).toFixed(2);
            debug('success', `Updater cache cleaned: ${sizeMB} MB freed`);
        }

        await fs.promises.rmdir(updaterCachePath).catch(() => { });
    } catch (err) {
        debug('warn', 'Failed to clean updater cache:', err.message);
    }
}

/**
 * Setup auto-updater event handlers
 * @param {Object} options - Configuration options
 * @param {Function} options.getUpdateWindow - Function to get update window
 * @param {Function} options.getMainWindow - Function to get main window
 * @param {Function} options.createMainWindow - Function to create main window
 * @param {Function} options.debug - Debug logging function
 */
function setupUpdaterEvents({ getUpdateWindow, getMainWindow, createMainWindow, debug }) {
    autoUpdater.on('checking-for-update', () => {
        debug('info', 'Checking for updates...');
        const updateWindow = getUpdateWindow();
        if (updateWindow) {
            updateWindow.webContents.send('update-status', {
                status: 'checking',
                message: 'Checking for updates...'
            });
        }
    });

    autoUpdater.on('update-available', async (info) => {
        debug('info', 'Update available:', info);
        updateAvailable = true;
        retryCount = 0; // Reset retry count on successful update check
        downloadStartTime = Date.now(); // Start tracking download time
        
        pendingUpdateInfo = {
            version: info.version,
            releaseName: info.releaseName,
            releaseNotes: info.releaseNotes,
            releaseDate: info.releaseDate,
            files: info.files
        };

        const title = info.releaseName || '';
        const version = info.version || '';
        const message = title ? `${title} (v${version})` : `New version available: v${version}`;
        const releaseNotes = info.releaseNotes || '';
        
        // Calculate update size if available
        let totalSize = 0;
        if (info.files && Array.isArray(info.files)) {
            totalSize = info.files.reduce((sum, file) => sum + (file.size || 0), 0);
        }
        const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);

        const payload = { 
            status: 'available', 
            message, 
            version, 
            releaseName: title, 
            releaseNotes,
            size: sizeMB > 0 ? `${sizeMB} MB` : 'Unknown'
        };

        const updateWindow = getUpdateWindow();
        const mainWindow = getMainWindow();

        if (updateWindow) updateWindow.webContents.send('update-status', payload);
        if (mainWindow) mainWindow.webContents.send('update-status', payload);
    });

    autoUpdater.on('update-not-available', (info) => {
        debug('info', 'Update not available:', info);

        const updateWindow = getUpdateWindow();
        if (updateWindow) {
            updateWindow.webContents.send('update-status', {
                status: 'downloading',
                message: 'Launching application...',
                percent: 100
            });

            // Create main window and show it after a brief delay
            const mainWindow = getMainWindow();
            if (!mainWindow) {
                const newMainWindow = createMainWindow(true);  // show: true
                // Close update window after main window loads
                newMainWindow.webContents.once('did-finish-load', () => {
                    setTimeout(() => {
                        if (updateWindow && !updateWindow.isDestroyed()) {
                            updateWindow.destroy();
                        }
                    }, 100);
                });
            } else {
                setTimeout(() => {
                    if (updateWindow && !updateWindow.isDestroyed()) {
                        updateWindow.destroy();
                    }
                }, 100);
            }
        }
    });

    autoUpdater.on('download-progress', (progressObj) => {
        // Calculate download speed and ETA
        const now = Date.now();
        if (!downloadStartTime) {
            downloadStartTime = now;
        }
        
        const bytesReceived = progressObj.transferred || 0;
        const totalBytes = progressObj.total || 0;
        const percent = Math.round(progressObj.percent || 0);
        
        // Calculate speed (bytes per second)
        const elapsedSeconds = (now - downloadStartTime) / 1000;
        const speed = elapsedSeconds > 0 ? bytesReceived / elapsedSeconds : 0;
        
        // Calculate ETA
        const remainingBytes = totalBytes - bytesReceived;
        const etaSeconds = speed > 0 ? remainingBytes / speed : 0;
        
        // Format speed
        const speedMB = (speed / (1024 * 1024)).toFixed(2);
        const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
        const receivedMB = (bytesReceived / (1024 * 1024)).toFixed(2);
        
        // Format ETA
        const etaMinutes = Math.floor(etaSeconds / 60);
        const etaSecondsRemainder = Math.floor(etaSeconds % 60);
        const etaFormatted = etaMinutes > 0 
            ? `${etaMinutes}m ${etaSecondsRemainder}s` 
            : `${etaSecondsRemainder}s`;
        
        const message = speed > 0 
            ? `Downloading: ${percent}% (${receivedMB}/${totalMB} MB) • ${speedMB} MB/s • ETA: ${etaFormatted}`
            : `Downloading update: ${percent}%`;
        
        debug('info', message);
        
        const statusPayload = {
            status: 'downloading',
            message,
            percent,
            speed: speedMB,
            eta: etaFormatted,
            downloaded: receivedMB,
            total: totalMB,
            // Raw values for detailed UI
            bytesPerSecond: speed,
            transferred: bytesReceived,
            totalBytes: totalBytes
        };

        const updateWindow = getUpdateWindow();
        const mainWindow = getMainWindow();

        if (updateWindow) updateWindow.webContents.send('update-status', statusPayload);
        if (mainWindow) mainWindow.webContents.send('update-status', statusPayload);
        
        lastBytesReceived = bytesReceived;
    });

    autoUpdater.on('update-downloaded', (info) => {
        debug('success', 'Update downloaded:', info);
        updateDownloaded = true;

        const title = info.releaseName || '';
        const version = info.version || '';
        const message = title ? `${title} (v${version}) downloaded.` : `v${version} downloaded.`;
        const payload = { status: 'downloaded', message, version, releaseName: title };

        const updateWindow = getUpdateWindow();
        const mainWindow = getMainWindow();

        if (updateWindow) updateWindow.webContents.send('update-status', payload);
        if (mainWindow) mainWindow.webContents.send('update-status', payload);

        // Persist update metadata
        try {
            const updateInfoToSave = pendingUpdateInfo || {
                version: info.version,
                releaseName: info.releaseName,
                releaseNotes: info.releaseNotes
            };
            updateInfoToSave.timestamp = Date.now();
            fs.writeFileSync(updateInfoPrimaryPath, JSON.stringify(updateInfoToSave));

            if (updateInfoSecondaryPath) {
                try {
                    const secondaryDir = path.dirname(updateInfoSecondaryPath);
                    if (!fs.existsSync(secondaryDir)) {
                        fs.mkdirSync(secondaryDir, { recursive: true });
                    }
                    fs.writeFileSync(updateInfoSecondaryPath, JSON.stringify(updateInfoToSave));
                } catch (secErr) {
                    debug('warn', 'Failed to write secondary update info:', secErr);
                }
            }
        } catch (err) {
            debug('warn', 'Failed to persist update info:', err);
        }

        // Use async approach to handle window closure properly
        (async () => {
            try {
                const updateWin = getUpdateWindow();
                const mainWin = getMainWindow();

                // Send final status
                if (updateWin) {
                    updateWin.webContents.send('update-status', {
                        status: 'downloaded',
                        message: 'Installing update...',
                        percent: 100
                    });
                }

                // Create promise to wait for windows to close
                const closePromises = [];
                
                if (updateWin && !updateWin.isDestroyed()) {
                    closePromises.push(new Promise(resolve => {
                        updateWin.once('closed', resolve);
                        updateWin.destroy();
                    }));
                }
                
                if (mainWin && !mainWin.isDestroyed()) {
                    closePromises.push(new Promise(resolve => {
                        mainWin.once('closed', resolve);
                        mainWin.destroy();
                    }));
                }

                // Wait for all windows to close
                await Promise.all(closePromises);

                // Install immediately after windows are closed
                debug('info', 'Launching installer...');
                autoUpdater.quitAndInstall(false, true);
            } catch (e) {
                debug('error', 'Failed to install update automatically:', e);
                app.quit();
            }
        })();
    });

    autoUpdater.on('error', (err) => {
        debug('error', 'Update error:', err);
        
        // Reset download tracking
        downloadStartTime = null;
        lastBytesReceived = 0;

        const updateWindow = getUpdateWindow();
        const mainWindow = getMainWindow();

        // Retry logic for network errors
        const isNetworkError = err.message && (
            err.message.includes('ECONNRESET') ||
            err.message.includes('ETIMEDOUT') ||
            err.message.includes('ENOTFOUND') ||
            err.message.includes('socket hang up') ||
            err.message.includes('net::')
        );

        if (isNetworkError && retryCount < MAX_RETRIES) {
            retryCount++;
            const retryDelay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000); // Exponential backoff, max 5s
            
            debug('warn', `Network error detected. Retry ${retryCount}/${MAX_RETRIES} in ${retryDelay}ms...`);
            
            const retryMessage = `Connection lost. Retrying (${retryCount}/${MAX_RETRIES})...`;
            if (updateWindow) {
                updateWindow.webContents.send('update-status', {
                    status: 'downloading',
                    message: retryMessage,
                    percent: 0
                });
            }
            if (mainWindow) {
                mainWindow.webContents.send('update-status', {
                    status: 'error',
                    message: retryMessage
                });
            }
            
            // Use promise-based delay for cleaner async handling
            (async () => {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                debug('info', `Retrying update check (attempt ${retryCount})...`);
                try {
                    await autoUpdater.checkForUpdates();
                } catch (retryErr) {
                    debug('error', 'Retry failed:', retryErr);
                }
            })();
            return;
        }

        // Reset retry count after max retries
        if (retryCount >= MAX_RETRIES) {
            debug('error', `Max retries (${MAX_RETRIES}) reached. Giving up.`);
            retryCount = 0;
        }

        if (updateWindow && !mainWindow) {
            updateWindow.webContents.send('update-status', {
                status: 'downloading',
                message: 'Launching application...',
                percent: 100
            });

            // Create main window and show it
            const newMainWindow = createMainWindow(true);  // show: true
            newMainWindow.webContents.once('did-finish-load', () => {
                setTimeout(() => {
                    if (updateWindow && !updateWindow.isDestroyed()) {
                        updateWindow.destroy();
                    }
                }, 100);
            });
            return;
        }

        const payload = { 
            status: 'error', 
            message: `Update error: ${err.message}`,
            canRetry: isNetworkError && retryCount < MAX_RETRIES
        };
        if (updateWindow) updateWindow.webContents.send('update-status', payload);
        if (mainWindow) mainWindow.webContents.send('update-status', payload);
    });
}

/**
 * Setup updater IPC handlers
 * @param {Object} options - Configuration options
 * @param {Function} options.getUpdateWindow - Function to get update window
 * @param {Function} options.getMainWindow - Function to get main window
 * @param {Function} options.debug - Debug logging function
 */
function setupUpdaterIpcHandlers({ getUpdateWindow, getMainWindow, debug }) {
    ipcMain.handle('check-for-updates', async () => {
        try {
            retryCount = 0; // Reset retry count on manual check
            const result = await autoUpdater.checkForUpdates();
            return { 
                success: true, 
                updateInfo: result ? {
                    version: result.updateInfo?.version,
                    releaseDate: result.updateInfo?.releaseDate,
                    currentVersion: app.getVersion()
                } : null
            };
        } catch (error) {
            debug('error', 'Manual update check failed:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('download-update', async () => {
        try {
            await autoUpdater.downloadUpdate();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('install-update', async () => {
        if (updateDownloaded) {
            const updateWindow = getUpdateWindow();
            const mainWindow = getMainWindow();

            debug('info', 'Manual install triggered');

            // Send preparing message
            if (updateWindow) {
                updateWindow.webContents.send('update-status', {
                    status: 'downloaded',
                    message: 'Preparing installation...',
                    percent: 100
                });
            }

            // Use promises to ensure windows are closed before installing
            (async () => {
                const closePromises = [];
                
                if (updateWindow && !updateWindow.isDestroyed()) {
                    closePromises.push(new Promise(resolve => {
                        updateWindow.once('closed', resolve);
                        updateWindow.destroy();
                    }));
                }
                
                if (mainWindow && !mainWindow.isDestroyed()) {
                    closePromises.push(new Promise(resolve => {
                        mainWindow.once('closed', resolve);
                        mainWindow.destroy();
                    }));
                }

                await Promise.all(closePromises);
                
                debug('info', 'Launching installer...');
                autoUpdater.quitAndInstall(false, true);
            })();

            return { success: true };
        }
        return { success: false, error: 'No update downloaded' };
    });

    ipcMain.handle('app-ready', async (event, size) => {
        debug('info', 'Application ready signal received from renderer');
        const mainWindow = getMainWindow();
        try {
            // If renderer sent a target size, apply it
            if (mainWindow && size && typeof size.width !== 'undefined' && typeof size.height !== 'undefined') {
                const w = parseInt(size.width, 10);
                const h = parseInt(size.height, 10);
                if (!Number.isNaN(w) && !Number.isNaN(h)) {
                    mainWindow.setSize(w, h);
                }
            }

            // Close the update window if present (smooth transition)
            const updateWin = getUpdateWindow();
            if (updateWin && !updateWin.isDestroyed()) {
                updateWin.close();
            }

            // Finally show the main window (it may have been created hidden)
            if (mainWindow && !mainWindow.isVisible()) {
                mainWindow.show();
            }
        } catch (err) {
            debug('warn', 'Error handling app-ready:', err && err.message);
        }

        return { success: true };
    });

    ipcMain.handle('update-loading-progress', async (event, { progress, message }) => {
        const updateWindow = getUpdateWindow();
        if (updateWindow) {
            updateWindow.webContents.send('update-status', {
                status: 'downloading',
                message: message || `Loading application: ${Math.round(progress)}%`,
                percent: progress
            });
        }
        return { success: true };
    });

    ipcMain.handle('save-update-info', async (event, info) => {
        try {
            const payload = JSON.stringify(info);
            await fs.promises.writeFile(updateInfoPrimaryPath, payload);
            if (updateInfoSecondaryPath) {
                try {
                    fs.mkdirSync(path.dirname(updateInfoSecondaryPath), { recursive: true });
                    await fs.promises.writeFile(updateInfoSecondaryPath, payload);
                } catch (secondaryErr) {
                    debug('warn', 'Failed to persist update info to ProgramData (secondary):', secondaryErr.message);
                }
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-update-info', async () => {
        try {
            const pathToRead = fs.existsSync(updateInfoPrimaryPath)
                ? updateInfoPrimaryPath
                : (updateInfoSecondaryPath && fs.existsSync(updateInfoSecondaryPath)
                    ? updateInfoSecondaryPath
                    : null);

            if (pathToRead) {
                const content = await fs.promises.readFile(pathToRead, 'utf-8');
                try {
                    await fs.promises.unlink(pathToRead);
                } catch { }

                try { if (fs.existsSync(updateInfoPrimaryPath)) await fs.promises.unlink(updateInfoPrimaryPath); } catch { }
                try { if (fs.existsSync(updateInfoSecondaryPath)) await fs.promises.unlink(updateInfoSecondaryPath); } catch { }

                return { success: true, info: JSON.parse(content) };
            }

            return { success: false, error: 'No update info' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-update-state', async () => {
        return { success: true, state: getUpdateState() };
    });

    ipcMain.handle('cancel-update', async () => {
        const result = cancelUpdate();
        return { success: result };
    });

    ipcMain.handle('force-check-updates', async () => {
        try {
            const result = await forceCheckForUpdates(debug);
            return { 
                success: true, 
                updateInfo: result ? {
                    version: result.updateInfo?.version,
                    releaseDate: result.updateInfo?.releaseDate,
                    currentVersion: app.getVersion()
                } : null
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('retry-update', async () => {
        try {
            resetUpdateState();
            await autoUpdater.checkForUpdates();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

/**
 * Check for updates
 * @param {Function} debug - Debug logging function
 */
function checkForUpdates(debug) {
    autoUpdater.checkForUpdates().catch((err) => {
        debug('error', 'Check for updates failed:', err);
    });
}

/**
 * Get update state
 * @returns {Object} Update state
 */
function getUpdateState() {
    return {
        updateAvailable,
        updateDownloaded,
        pendingUpdateInfo,
        retryCount,
        maxRetries: MAX_RETRIES,
        isDownloading: downloadStartTime !== null && !updateDownloaded
    };
}

/**
 * Cancel ongoing update download
 * @returns {boolean} Success status
 */
function cancelUpdate() {
    try {
        downloadStartTime = null;
        lastBytesReceived = 0;
        retryCount = 0;
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * Reset update state
 */
function resetUpdateState() {
    updateAvailable = false;
    pendingUpdateInfo = null;
    updateDownloaded = false;
    retryCount = 0;
    downloadStartTime = null;
    lastBytesReceived = 0;
}

/**
 * Force check for updates (bypasses cache)
 * @param {Function} debug - Debug logging function
 * @returns {Promise} Update check promise
 */
async function forceCheckForUpdates(debug) {
    try {
        retryCount = 0;
        debug('info', 'Force checking for updates...');
        return await autoUpdater.checkForUpdates();
    } catch (err) {
        debug('error', 'Force check failed:', err);
        throw err;
    }
}

module.exports = {
    configureAutoUpdater,
    cleanupUpdaterCache,
    setupUpdaterEvents,
    setupUpdaterIpcHandlers,
    checkForUpdates,
    getUpdateState,
    cancelUpdate,
    resetUpdateState,
    forceCheckForUpdates,
    autoUpdater
};
