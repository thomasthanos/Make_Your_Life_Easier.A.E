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

// Update info paths
const updateInfoPrimaryPath = path.join(app.getPath('userData'), 'update-info.json');
const updateInfoSecondaryPath = process.platform === 'win32'
    ? path.join(process.env.PROGRAMDATA || path.join('C:\\', 'ProgramData'), 'MakeYourLifeEasier', 'update-info.json')
    : null;

/**
 * Configure auto-updater settings
 */
function configureAutoUpdater() {
    autoUpdater.autoDownload = true;
    autoUpdater.requestHeaders = {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
    };
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.forceRunAfter = true;
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
 * Create a fallback timeout to show the main window
 * Used when waiting for app-ready signal times out
 * @param {Object} options - Configuration options
 * @param {Function} options.getUpdateWindow - Function to get update window
 * @param {Function} options.getMainWindow - Function to get main window
 * @param {Function} options.debug - Debug logging function
 * @param {string} options.message - Warning message for debug
 * @returns {number} Timeout ID
 */
function createAppReadyFallbackTimeout({ getUpdateWindow, getMainWindow, debug, message }) {
    return setTimeout(() => {
        debug('warn', message);
        const updateWin = getUpdateWindow();
        const mainWin = getMainWindow();
        if (updateWin) {
            updateWin.webContents.send('update-status', {
                status: 'downloading',
                message: 'Launching application...',
                percent: 100
            });
            setTimeout(() => {
                if (updateWin) updateWin.close();
                if (mainWin) {
                    mainWin.show();
                    mainWin.focus();
                }
            }, 200);
        }
    }, 8000);
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
        pendingUpdateInfo = {
            version: info.version,
            releaseName: info.releaseName,
            releaseNotes: info.releaseNotes
        };

        const title = info.releaseName || '';
        const version = info.version || '';
        const message = title ? `${title} (v${version})` : `New version available: v${version}`;
        const releaseNotes = info.releaseNotes || '';

        const payload = { status: 'available', message, version, releaseName: title, releaseNotes };

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
                message: 'Initializing application...',
                percent: 10
            });

            setTimeout(() => {
                const mainWindow = getMainWindow();
                if (!mainWindow) {
                    createMainWindow(false);
                }

                const fallbackTimeout = createAppReadyFallbackTimeout({
                    getUpdateWindow,
                    getMainWindow,
                    debug,
                    message: 'App ready signal timeout - showing window anyway'
                });

                global.appReadyFallbackTimeout = fallbackTimeout;
            }, 100);
        }
    });

    autoUpdater.on('download-progress', (progressObj) => {
        debug('info', 'Download progress:', progressObj);
        const statusPayload = {
            status: 'downloading',
            message: `Downloading update: ${Math.round(progressObj.percent)}%`,
            percent: progressObj.percent
        };

        const updateWindow = getUpdateWindow();
        const mainWindow = getMainWindow();

        if (updateWindow) updateWindow.webContents.send('update-status', statusPayload);
        if (mainWindow) mainWindow.webContents.send('update-status', statusPayload);
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

        // Give UI time to show "Installing update..." message
        setTimeout(() => {
            try {
                const updateWin = getUpdateWindow();
                const mainWin = getMainWindow();

                if (updateWin) {
                    updateWin.close();
                }
                if (mainWin) {
                    mainWin.close();
                }

                setTimeout(() => {
                    autoUpdater.quitAndInstall(false, true);
                }, 100);
            } catch (e) {
                debug('error', 'Failed to install update automatically:', e);
                app.quit();
            }
        }, 300);
    });

    autoUpdater.on('error', (err) => {
        debug('error', 'Update error:', err);

        const updateWindow = getUpdateWindow();
        const mainWindow = getMainWindow();

        if (updateWindow && !mainWindow) {
            updateWindow.webContents.send('update-status', {
                status: 'downloading',
                message: 'Initializing application...',
                percent: 10
            });

            setTimeout(() => {
                createMainWindow(false);

                const fallbackTimeout = createAppReadyFallbackTimeout({
                    getUpdateWindow,
                    getMainWindow,
                    debug,
                    message: 'App ready signal timeout after error - showing window anyway'
                });

                global.appReadyFallbackTimeout = fallbackTimeout;
            }, 100);
            return;
        }

        const payload = { status: 'error', message: `Update error: ${err.message}` };
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
            await autoUpdater.checkForUpdates();
            return { success: true };
        } catch (error) {
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

            if (updateWindow) {
                updateWindow.close();
            }
            if (mainWindow) {
                mainWindow.close();
            }

            setTimeout(() => autoUpdater.quitAndInstall(false, true), 100);
            return { success: true };
        }
        return { success: false, error: 'No update downloaded' };
    });

    ipcMain.handle('app-ready', async () => {
        debug('success', 'Application ready signal received from renderer');

        if (global.appReadyFallbackTimeout) {
            clearTimeout(global.appReadyFallbackTimeout);
            global.appReadyFallbackTimeout = null;
        }

        const updateWindow = getUpdateWindow();
        const mainWindow = getMainWindow();

        if (updateWindow) {
            updateWindow.webContents.send('update-status', {
                status: 'downloading',
                message: 'Launching application...',
                percent: 100
            });

            setTimeout(() => {
                if (updateWindow) {
                    updateWindow.close();
                }
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }, 150);
        } else if (mainWindow && !mainWindow.isVisible()) {
            mainWindow.show();
            mainWindow.focus();
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
        pendingUpdateInfo
    };
}

module.exports = {
    configureAutoUpdater,
    cleanupUpdaterCache,
    setupUpdaterEvents,
    setupUpdaterIpcHandlers,
    checkForUpdates,
    getUpdateState,
    autoUpdater
};
