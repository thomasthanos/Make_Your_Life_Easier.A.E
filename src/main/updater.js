const { autoUpdater } = require('electron-updater');
const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { saveUpdateInfo, readAndClearUpdateInfo } = require('./update-info');

let updateAvailable = false;
let pendingUpdateInfo = null;
let updateDownloaded = false;
let isChecking = false;
let quittingForInstall = false;
let retryCount = 0;
let downloadStartTime = null;
const MAX_RETRIES = 3;

function isDebugMode() {
    try {
        return process.argv.includes('--updater-debug') ||
            fs.existsSync(path.join(app.getPath('userData'), 'updater-debug.flag'));
    } catch {
        return false;
    }
}

function sendUpdateStatus(window, payload) {
    if (window && !window.isDestroyed() && window.webContents) {
        try {
            window.webContents.send('update-status', payload);
        } catch {
            // window is closing
        }
    }
}

async function launchAppAfterError(getUpdateWindow, getMainWindow, createMainWindow) {
    const updateWin = getUpdateWindow();
    const mainWin = getMainWindow();

    if (updateWin && !mainWin) {
        sendUpdateStatus(updateWin, {
            status: 'downloading',
            message: 'Launching application...',
            percent: 100
        });

        await new Promise(resolve => setTimeout(resolve, 200));

        const newMainWindow = createMainWindow(true);
        newMainWindow.webContents.once('did-finish-load', () => {
            setTimeout(() => {
                if (updateWin && !updateWin.isDestroyed()) {
                    updateWin.destroy();
                }
            }, 100);
        });
    }
}

function performInstall(getUpdateWindow, getMainWindow, debug) {
    if (quittingForInstall) return;
    quittingForInstall = true;

    try {
        fs.writeFileSync(path.join(app.getPath('userData'), '.just-updated'), Date.now().toString());
    } catch {
        // non-fatal: post-install launch will just do a normal update check
    }

    const updateWin = getUpdateWindow();
    const mainWin = getMainWindow();

    sendUpdateStatus(updateWin, { status: 'downloaded', message: 'Installing update...', percent: 100 });

    setTimeout(() => {
        try {
            if (updateWin && !updateWin.isDestroyed()) updateWin.destroy();
            if (mainWin && !mainWin.isDestroyed()) mainWin.destroy();
            debug('info', 'Launching installer...');
            autoUpdater.quitAndInstall(true, true);
        } catch (err) {
            debug('error', 'Failed to install update:', err.message);
            app.quit();
        }
    }, 250);
}

function isQuittingForInstall() {
    return quittingForInstall;
}

function configureAutoUpdater() {
    if (!app.isPackaged && isDebugMode()) {
        autoUpdater.forceDevUpdateConfig = true;
    }

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.disableDifferentialDownload = true;
    autoUpdater.disableWebInstaller = true;

    autoUpdater.requestHeaders = {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
    };

    try {
        const log = require('electron-log');
        autoUpdater.logger = log;
        autoUpdater.logger.transports.file.level = 'info';
    } catch {
        // electron-log not available
    }
}

async function cleanupUpdaterCache(debug) {
    try {
        const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
        const updaterCachePath = path.join(localAppData, 'make-your-life-easier-updater');

        try {
            await fs.promises.access(updaterCachePath);
        } catch {
            return;
        }

        const attemptCleanup = async () => {
            const files = await fs.promises.readdir(updaterCachePath).catch(() => []);
            let cleanedSize = 0;
            const failedFiles = [];

            for (const file of files) {
                const filePath = path.join(updaterCachePath, file);
                try {
                    const stat = await fs.promises.stat(filePath).catch(() => null);
                    if (!stat) continue;

                    if (stat.isDirectory()) {
                        await fs.promises.rm(filePath, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
                    } else {
                        cleanedSize += stat.size;
                        await fs.promises.unlink(filePath);
                    }
                } catch {
                    failedFiles.push(file);
                }
            }

            if (cleanedSize > 0) {
                const sizeMB = (cleanedSize / (1024 * 1024)).toFixed(2);
                debug('success', `Updater cache cleaned: ${sizeMB} MB freed`);
            }

            await fs.promises.rmdir(updaterCachePath).catch(() => {});
            return failedFiles;
        };

        const failedFiles = await attemptCleanup();

        if (failedFiles.length > 0) {
            setTimeout(() => { attemptCleanup().catch(() => {}); }, 5000);
        }
    } catch (err) {
        debug('warn', 'Failed to clean updater cache:', err.message);
    }
}

function setupUpdaterEvents({ getUpdateWindow, getMainWindow, createMainWindow, debug }) {
    const debugMode = isDebugMode();
    let debugResized = false;
    let lastDbgPercent = -1;

    const dbg = (line) => {
        if (!debugMode) return;
        const win = getUpdateWindow();
        if (win && !win.isDestroyed() && !debugResized) {
            debugResized = true;
            try { win.setResizable(true); win.setSize(680, 620); win.center(); } catch { /* ignore */ }
        }
        const ts = new Date().toISOString().slice(11, 23);
        sendUpdateStatus(win, { status: 'debug', line: `[${ts}] ${line}` });
    };

    if (debugMode) {
        dbg(`DEBUG MODE ON — current version v${app.getVersion()} (packaged=${app.isPackaged})`);
        try {
            dbg(`feedURL=${autoUpdater.getFeedURL() || '(github provider; resolved at check time)'}`);
        } catch (e) {
            dbg(`feedURL error: ${e.message}`);
        }
    }

    autoUpdater.on('checking-for-update', () => {
        debug('info', 'Checking for updates...');
        dbg('event: checking-for-update');
        sendUpdateStatus(getUpdateWindow(), {
            status: 'checking',
            message: 'Checking for updates...'
        });
    });

    autoUpdater.on('update-available', (info) => {
        debug('info', `Update available: v${info.version}`);
        dbg(`event: update-available v${info.version} — files: ${Array.isArray(info.files) ? info.files.map(f => f.url).join(', ') : 'n/a'}`);
        updateAvailable = true;
        retryCount = 0;
        downloadStartTime = Date.now();

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

        let totalSize = 0;
        if (Array.isArray(info.files)) {
            totalSize = info.files.reduce((sum, file) => sum + (file.size || 0), 0);
        }
        const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);

        const payload = {
            status: 'available',
            message,
            version,
            releaseName: title,
            releaseNotes: info.releaseNotes || '',
            size: totalSize > 0 ? `${sizeMB} MB` : 'Unknown'
        };

        sendUpdateStatus(getUpdateWindow(), payload);
        sendUpdateStatus(getMainWindow(), payload);
    });

    autoUpdater.on('update-not-available', async () => {
        debug('info', 'No update available');

        if (debugMode) {
            dbg(`event: update-not-available — server says v${app.getVersion()} is the latest. Check reached GitHub OK.`);
            dbg('HOLDING (debug). Press "Continue to app" to proceed.');
            return;
        }

        const updateWindow = getUpdateWindow();
        if (!updateWindow) return;

        sendUpdateStatus(updateWindow, {
            status: 'downloading',
            message: 'Launching application...',
            percent: 100
        });

        await new Promise(resolve => setTimeout(resolve, 200));

        const mainWindow = getMainWindow();
        if (!mainWindow) {
            const newMainWindow = createMainWindow(true);
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
    });

    autoUpdater.on('download-progress', (progressObj) => {
        const now = Date.now();
        if (!downloadStartTime) downloadStartTime = now;

        const bytesReceived = progressObj.transferred || 0;
        const totalBytes = progressObj.total || 0;
        const percent = Math.round(progressObj.percent || 0);

        if (percent >= lastDbgPercent + 10) {
            lastDbgPercent = percent;
            dbg(`event: download-progress ${percent}%`);
        }

        const elapsedSeconds = (now - downloadStartTime) / 1000;
        const speed = elapsedSeconds > 0 ? bytesReceived / elapsedSeconds : 0;
        const remainingBytes = totalBytes - bytesReceived;
        const etaSeconds = speed > 0 ? remainingBytes / speed : 0;

        const speedMB = (speed / (1024 * 1024)).toFixed(2);
        const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
        const receivedMB = (bytesReceived / (1024 * 1024)).toFixed(2);

        const etaMinutes = Math.floor(etaSeconds / 60);
        const etaRemainder = Math.floor(etaSeconds % 60);
        const etaFormatted = etaMinutes > 0 ? `${etaMinutes}m ${etaRemainder}s` : `${etaRemainder}s`;

        const message = speed > 0
            ? `Downloading: ${percent}% (${receivedMB}/${totalMB} MB) • ${speedMB} MB/s • ETA: ${etaFormatted}`
            : `Downloading update: ${percent}%`;

        const payload = {
            status: 'downloading',
            message,
            percent,
            speed: speedMB,
            eta: etaFormatted,
            downloaded: receivedMB,
            total: totalMB,
            bytesPerSecond: speed,
            transferred: bytesReceived,
            totalBytes
        };

        sendUpdateStatus(getUpdateWindow(), payload);
        sendUpdateStatus(getMainWindow(), payload);
    });

    autoUpdater.on('update-downloaded', (info) => {
        debug('success', `Update downloaded: v${info.version}`);
        updateDownloaded = true;

        const title = info.releaseName || '';
        const version = info.version || '';
        const message = title ? `${title} (v${version}) downloaded.` : `v${version} downloaded.`;

        const payload = { status: 'downloaded', message, version, releaseName: title };
        sendUpdateStatus(getUpdateWindow(), payload);
        sendUpdateStatus(getMainWindow(), payload);

        const infoToSave = pendingUpdateInfo || {
            version: info.version,
            releaseName: info.releaseName,
            releaseNotes: info.releaseNotes
        };
        saveUpdateInfo(infoToSave).catch((err) => {
            debug('warn', 'Failed to persist update info:', err.message);
        });

        if (debugMode) {
            dbg(`event: update-downloaded v${info.version} — download + signature verification OK.`);
            dbg('HOLDING (debug). Press "Continue to app" to install now.');
            return;
        }

        performInstall(getUpdateWindow, getMainWindow, debug);
    });

    autoUpdater.on('error', (err) => {
        isChecking = false;
        downloadStartTime = null;

        const msg = (err && err.message) ? err.message : String(err);
        debug('error', 'Update error:', msg);

        if (debugMode) {
            dbg(`event: ERROR — ${msg}`);
            if (err && err.code) dbg(`error code: ${err.code}`);
            if (err && err.stack) {
                err.stack.split('\n').slice(0, 6).forEach(l => dbg(`  ${l.trim()}`));
            }
            dbg('HOLDING (debug). Press "Continue to app" to proceed.');
            return;
        }

        const updateWindow = getUpdateWindow();
        const mainWindow = getMainWindow();

        const isFirewallBlock = msg.includes('ERR_NETWORK_ACCESS_DENIED');
        const isRateLimit = msg.includes('429') || msg.includes('Too Many Requests');
        const isTransientNetwork =
            msg.includes('ECONNRESET') ||
            msg.includes('ETIMEDOUT') ||
            msg.includes('ENOTFOUND') ||
            msg.includes('socket hang up') ||
            msg.includes('ERR_CONNECTION_TIMED_OUT') ||
            msg.includes('ERR_NETWORK_CHANGED') ||
            msg.includes('ERR_INTERNET_DISCONNECTED');

        const finish = (message) => {
            retryCount = 0;
            sendUpdateStatus(updateWindow, { status: 'error', message });
            sendUpdateStatus(mainWindow, { status: 'error', message, canRetry: false });
            launchAppAfterError(getUpdateWindow, getMainWindow, createMainWindow);
        };

        if (isFirewallBlock) {
            finish('Connection blocked by firewall/antivirus. Allow MakeYourLifeEasier.exe through your security software, then try again.');
            return;
        }

        if (isRateLimit) {
            finish('Update server is busy (rate limited). Please try again in a few minutes.');
            return;
        }

        if (isTransientNetwork && retryCount < MAX_RETRIES) {
            retryCount++;
            const retryDelay = Math.min(2000 * Math.pow(2, retryCount - 1), 30000);
            const retryMessage = `Connection lost. Retrying (${retryCount}/${MAX_RETRIES})...`;

            sendUpdateStatus(updateWindow, { status: 'downloading', message: retryMessage, percent: 0 });
            sendUpdateStatus(mainWindow, { status: 'error', message: retryMessage });

            setTimeout(() => {
                checkForUpdates(debug);
            }, retryDelay);
            return;
        }

        finish(`Update error: ${msg}`);
    });
}

function setupUpdaterIpcHandlers({ getUpdateWindow, getMainWindow, createMainWindow, debug }) {
    ipcMain.handle('updater-debug-continue', async () => {
        const updateWin = getUpdateWindow();

        if (updateDownloaded) {
            debug('info', 'Debug continue: installing update...');
            performInstall(getUpdateWindow, getMainWindow, debug);
            return { success: true };
        }

        if (!getMainWindow() && typeof createMainWindow === 'function') {
            const newMain = createMainWindow(true);
            newMain.webContents.once('did-finish-load', () => {
                setTimeout(() => {
                    if (updateWin && !updateWin.isDestroyed()) updateWin.destroy();
                }, 100);
            });
        }
        return { success: true };
    });

    ipcMain.handle('check-for-updates', async () => {
        try {
            retryCount = 0;
            const result = await runUpdateCheck();
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

    ipcMain.handle('download-update', async () => {
        try {
            await autoUpdater.downloadUpdate();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('install-update', async () => {
        if (!updateDownloaded) {
            return { success: false, error: 'No update downloaded' };
        }
        performInstall(getUpdateWindow, getMainWindow, debug);
        return { success: true };
    });

    ipcMain.handle('app-ready', async (event, size) => {
        const mainWindow = getMainWindow();
        try {
            if (mainWindow && size && typeof size.width !== 'undefined' && typeof size.height !== 'undefined') {
                const w = parseInt(size.width, 10);
                const h = parseInt(size.height, 10);
                if (!Number.isNaN(w) && !Number.isNaN(h)) {
                    mainWindow.setSize(w, h);
                }
            }

            const updateWin = getUpdateWindow();
            if (updateWin && !updateWin.isDestroyed()) {
                sendUpdateStatus(updateWin, {
                    status: 'downloading',
                    message: 'Application ready!',
                    percent: 100
                });
                await new Promise(resolve => setTimeout(resolve, 200));
                updateWin.close();
            }

            if (mainWindow && !mainWindow.isVisible()) {
                mainWindow.show();
            }
        } catch (err) {
            debug('warn', 'Error handling app-ready:', err.message);
        }
        return { success: true };
    });

    ipcMain.handle('update-loading-progress', async (event, { progress, message }) => {
        sendUpdateStatus(getUpdateWindow(), {
            status: 'downloading',
            message: message || `Loading application: ${Math.round(progress)}%`,
            percent: progress
        });
        return { success: true };
    });

    ipcMain.handle('save-update-info', async (event, info) => {
        try {
            await saveUpdateInfo(info);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-update-info', async () => {
        try {
            const info = await readAndClearUpdateInfo();
            if (info) return { success: true, info };
            return { success: false, error: 'No update info' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-update-state', async () => {
        return { success: true, state: getUpdateState() };
    });

    ipcMain.handle('cancel-update', async () => {
        return { success: cancelUpdate() };
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
            await runUpdateCheck();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

async function runUpdateCheck() {
    if (isChecking) return null;
    isChecking = true;
    try {
        return await autoUpdater.checkForUpdates();
    } finally {
        isChecking = false;
    }
}

function checkForUpdates(debug) {
    runUpdateCheck().catch((err) => {
        debug('error', 'Check for updates failed:', err.message);
    });
}

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

function cancelUpdate() {
    downloadStartTime = null;
    retryCount = 0;
    return true;
}

function resetUpdateState() {
    updateAvailable = false;
    pendingUpdateInfo = null;
    updateDownloaded = false;
    isChecking = false;
    retryCount = 0;
    downloadStartTime = null;
}

async function forceCheckForUpdates(debug) {
    retryCount = 0;
    debug('info', 'Force checking for updates...');
    return runUpdateCheck();
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
    isQuittingForInstall,
    autoUpdater
};
