const { autoUpdater } = require('electron-updater');
const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { saveUpdateInfo, readAndClearUpdateInfo } = require('./update-info');
const externalUpdater = require('./external-updater');

let pendingUpdateInfo = null;
let isChecking = false;
let quittingForInstall = false;
let retryCount = 0;
let eventCtx = null;
const MAX_RETRIES = 3;

function getFeedUrl() {
    if (process.env.UPDATE_FEED_URL) return process.env.UPDATE_FEED_URL;
    try {
        return require('../../package.json').build.publish.url;
    } catch {
        return null;
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

function isRecentUpdateFailure() {
    try {
        const marker = path.join(app.getPath('userData'), '.update-failed');
        const stat = fs.statSync(marker);
        if (Date.now() - stat.mtimeMs < 15 * 60 * 1000) return true;
        fs.unlinkSync(marker);
    } catch {
        // no marker
    }
    return false;
}

async function handOffToExternalUpdater(info, ctx) {
    if (quittingForInstall) return;

    if (isRecentUpdateFailure()) {
        ctx.debug('warn', 'Skipping update handoff: a recent update attempt failed');
        sendUpdateStatus(ctx.getUpdateWindow(), {
            status: 'error',
            message: 'Update postponed after a recent failure. Launching application...'
        });
        launchAppAfterError(ctx.getUpdateWindow, ctx.getMainWindow, ctx.createMainWindow)
            .catch(e => ctx.debug('error', 'launchAppAfterError failed:', e));
        return;
    }

    try {
        await saveUpdateInfo(pendingUpdateInfo || {
            version: info.version,
            releaseName: info.releaseName,
            releaseNotes: info.releaseNotes
        });

        sendUpdateStatus(ctx.getUpdateWindow(), {
            status: 'downloading',
            message: 'Launching updater...',
            percent: 100
        });

        externalUpdater.launchExternalUpdater({ info, feedUrl: getFeedUrl(), debug: ctx.debug });
        quittingForInstall = true;

        setTimeout(() => {
            try {
                const updateWin = ctx.getUpdateWindow();
                const mainWin = ctx.getMainWindow();
                if (updateWin && !updateWin.isDestroyed()) updateWin.destroy();
                if (mainWin && !mainWin.isDestroyed()) mainWin.destroy();
            } catch {
                // windows already closing
            }
            app.quit();
        }, 300);
    } catch (err) {
        ctx.debug('error', 'External updater handoff failed:', err.message);
        sendUpdateStatus(ctx.getUpdateWindow(), {
            status: 'error',
            message: 'Update failed to start. Launching application...'
        });
        sendUpdateStatus(ctx.getMainWindow(), {
            status: 'error',
            message: 'Update failed to start.',
            canRetry: false
        });
        launchAppAfterError(ctx.getUpdateWindow, ctx.getMainWindow, ctx.createMainWindow)
            .catch(e => ctx.debug('error', 'launchAppAfterError failed:', e));
    }
}

function isQuittingForInstall() {
    return quittingForInstall;
}

function configureAutoUpdater() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
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

    if (process.env.UPDATE_FEED_URL) {
        autoUpdater.setFeedURL({ provider: 'generic', url: process.env.UPDATE_FEED_URL });
        try {
            autoUpdater.logger.warn(`UPDATE_FEED_URL override active: ${process.env.UPDATE_FEED_URL}`);
        } catch {
            // logger not available
        }
    }
}

async function cleanupExternalUpdaterLeftovers(debug) {
    if (!app.isPackaged) return;

    const installDir = path.dirname(process.execPath);
    for (const suffix of ['.staging', '.backup']) {
        const target = installDir + suffix;
        try {
            await fs.promises.rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
        } catch (err) {
            debug('warn', `Failed to remove leftover ${target}:`, err.message);
        }
    }

    try {
        const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
        const updaterDir = path.join(localAppData, 'ThomasThanos', 'updater');
        const dayMs = 24 * 60 * 60 * 1000;
        const now = Date.now();

        const staleExes = await fs.promises.readdir(updaterDir).catch(() => []);
        for (const name of staleExes) {
            if (!/^Updater-\d+\.exe$/i.test(name)) continue;
            const filePath = path.join(updaterDir, name);
            const stat = await fs.promises.stat(filePath).catch(() => null);
            if (stat && now - stat.mtimeMs > dayMs) {
                await fs.promises.unlink(filePath).catch(() => {});
            }
        }

        const downloadDir = path.join(updaterDir, 'download');
        const downloads = await fs.promises.readdir(downloadDir).catch(() => []);
        for (const name of downloads) {
            const filePath = path.join(downloadDir, name);
            const stat = await fs.promises.stat(filePath).catch(() => null);
            if (stat && now - stat.mtimeMs > dayMs) {
                await fs.promises.rm(filePath, { recursive: true, force: true }).catch(() => {});
            }
        }
    } catch (err) {
        debug('warn', 'Failed to clean external updater leftovers:', err.message);
    }
}

async function cleanupUpdaterCache(debug) {
    await cleanupExternalUpdaterLeftovers(debug);

    try {
        const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
        const updaterCachePath = path.join(localAppData, 'make-your-life-easier-updater');

        try {
            await fs.promises.access(updaterCachePath);
        } catch {
            return;
        }

        const delay = (ms) => new Promise(r => setTimeout(r, ms));
        let cleanedSize = 0;
        
        for (let retry = 0; retry < 3; retry++) {
            const files = await fs.promises.readdir(updaterCachePath).catch(() => []);
            let failedFiles = 0;

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
                    failedFiles++;
                }
            }

            if (failedFiles === 0) {
                await fs.promises.rmdir(updaterCachePath).catch(() => {});
                break;
            }
            await delay(2000);
        }

        if (cleanedSize > 0) {
            const sizeMB = (cleanedSize / (1024 * 1024)).toFixed(2);
            debug('success', `Updater cache cleaned: ${sizeMB} MB freed`);
        }
    } catch (err) {
        debug('warn', 'Failed to clean updater cache:', err.message);
    }
}

function setupUpdaterEvents({ getUpdateWindow, getMainWindow, createMainWindow, debug }) {
    eventCtx = { getUpdateWindow, getMainWindow, createMainWindow, debug };

    autoUpdater.on('checking-for-update', () => {
        debug('info', 'Checking for updates...');
        sendUpdateStatus(getUpdateWindow(), {
            status: 'checking',
            message: 'Checking for updates...'
        });
    });

    autoUpdater.on('update-available', (info) => {
        debug('info', `Update available: v${info.version}`);
        retryCount = 0;

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

        handOffToExternalUpdater(info, eventCtx);
    });

    autoUpdater.on('update-not-available', async () => {
        debug('info', 'No update available');

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

    autoUpdater.on('error', (err) => {
        isChecking = false;

        const msg = (err && err.message) ? err.message : String(err);
        debug('error', 'Update error:', msg);

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
            launchAppAfterError(getUpdateWindow, getMainWindow, createMainWindow).catch(e => debug('error', 'launchAppAfterError failed:', e));
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

function setupUpdaterIpcHandlers({ getUpdateWindow, getMainWindow, debug }) {
    ipcMain.handle('download-update', async () => {
        try {
            if (!pendingUpdateInfo || !eventCtx) {
                return { success: false, error: 'No pending update' };
            }
            await handOffToExternalUpdater(pendingUpdateInfo, eventCtx);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
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

    ipcMain.handle('get-update-info', async () => {
        try {
            const info = await readAndClearUpdateInfo();
            if (info) return { success: true, info };
            return { success: false, error: 'No update info' };
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

module.exports = {
    configureAutoUpdater,
    cleanupUpdaterCache,
    setupUpdaterEvents,
    setupUpdaterIpcHandlers,
    checkForUpdates,
    isQuittingForInstall,
    autoUpdater
};
