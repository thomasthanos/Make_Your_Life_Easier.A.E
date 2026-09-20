
const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

const _roamingBase = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
app.setPath('userData', path.join(_roamingBase, 'ThomasThanos', 'MakeYourLifeEasier'));


const windowManager = require('./window-manager');
const ipcHandlers = require('./ipc-handlers');
const updater = require('./updater');
const security = require('./security');
const certificate = require('./certificate');
const selfInstaller = require('./self-installer');

const { debug } = require('../modules/debug');
const fileUtils = require('../modules/file-utils');
const processUtils = require('../modules/process-utils');
const downloadManager = require('../modules/download-manager');
const userProfile = require('../modules/user-profile');
const supabase = require('../modules/supabase');
const settingsStore = require('../modules/settings-store');
const oauth = require('../modules/oauth');
const { profileFromUser } = require('../modules/auth-profile');
const systemTools = require('../modules/system-tools');
const spicetifyModule = require('../modules/spicetify');
const archiveUtils = require('../modules/archive-utils');
const sparkleModule = require('../modules/sparkle');
const sharedSecurity = require('../modules/security');
const gameSaves = require('../modules/game-saves');


security.configureAppSecurity();

const skipUpdater = security.shouldSkipUpdater();

updater.configureAutoUpdater();

const pendingCleanupFiles = new Set();


const preloadPath = path.join(__dirname, '..', 'preload', 'index.js');
const installerPreloadPath = path.join(__dirname, '..', 'installer-ui', 'preload.js');

const installerMode = selfInstaller.isInstallerMode() || selfInstaller.isUninstallMode();

function signalInstallerWhenReady() {
    const signalPath = process.env.MYLE_LAUNCH_SIGNAL;
    if (!signalPath) return;
    let done = false;
    const write = () => {
        if (done) return;
        done = true;
        try { fs.writeFileSync(signalPath, '1'); } catch {  }
    };
    app.on('browser-window-created', (_event, win) => {
        win.once('ready-to-show', write);
        win.once('show', write);
    });
    setTimeout(write, 10000);
}

const backupSavesMode = !installerMode && gameSaves.isBackupSavesLaunch(process.argv);

if (!installerMode) signalInstallerWhenReady();


function createMainWindow(showWindow = true) {
    return windowManager.createMainWindow(showWindow, preloadPath);
}

function createUpdateWindow() {
    return windowManager.createUpdateWindow(preloadPath, () => {
        updater.checkForUpdates(debug);
    });
}



updater.setupUpdaterEvents({
    getUpdateWindow: windowManager.getUpdateWindow,
    getMainWindow: windowManager.getMainWindow,
    createMainWindow,
    debug
});


ipcHandlers.setupWindowHandlers(windowManager.getMainWindow);

ipcHandlers.setupSystemInfoHandlers();

ipcHandlers.setupOAuthHandlers(oauth, userProfile, windowManager.getMainWindow, supabase, settingsStore);
ipcHandlers.setupSettingsHandlers(settingsStore);

ipcHandlers.setupCommandHandlers(sharedSecurity, processUtils, fileUtils, systemTools);

ipcHandlers.setupDownloadHandlers(downloadManager, windowManager.getMainWindow);

ipcHandlers.setupFileHandlers(sharedSecurity, fileUtils, debug, pendingCleanupFiles);

ipcHandlers.setupArchiveHandlers(sharedSecurity, archiveUtils, downloadManager);

ipcHandlers.setupSparkleHandlers(sparkleModule);

ipcHandlers.setupSystemToolsHandlers(systemTools);

ipcHandlers.setupSpicetifyHandlers(spicetifyModule);

ipcHandlers.setupInstallerHandlers(debug, security);

const gameSavesService = gameSaves.createGameSavesService({
    getMainWindow: windowManager.getMainWindow,
    settingsStore
});
ipcHandlers.setupGameSavesHandlers(gameSavesService);


updater.setupUpdaterIpcHandlers({
    getUpdateWindow: windowManager.getUpdateWindow,
    getMainWindow: windowManager.getMainWindow,
    debug
});


const gotTheLock = installerMode ? true : app.requestSingleInstanceLock();

if (!gotTheLock) {
    debug('warn', 'Another instance is already running, quitting...');
    app.quit();
} else if (!installerMode) {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (gameSaves.isBackupSavesLaunch(commandLine)) {
            gameSavesService.runScheduledBackup({ headless: true }).catch(() => {});
            return;
        }
        if (backupSavesMode && !windowManager.getMainWindow()) {
            createMainWindow(false);
            return;
        }
        const mainWindow = windowManager.getMainWindow();
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}


function cleanupStaleLockFiles() {
    try {
        const userDataPath = app.getPath('userData');
        const lockFiles = ['SingletonLock', 'Cookies-lock'];

        for (const lockFile of lockFiles) {
            const lockPath = path.join(userDataPath, lockFile);
            if (fs.existsSync(lockPath)) {
                fs.unlinkSync(lockPath);
                debug('info', `🧹 Removed stale lock file: ${lockFile}`);
            }
        }
    } catch (err) {
        debug('warn', 'Failed to cleanup lock files:', err.message);
    }
}


function applyProfile(user, cached) {
    const preferred = cached?.provider && cached.provider !== 'unknown' ? cached.provider : null;
    const fresh = profileFromUser(user, preferred);
    if (!fresh) return false;
    if (fresh.provider === 'unknown' && cached?.provider) fresh.provider = cached.provider;

    if (cached && cached.id === fresh.id && cached.name === fresh.name
        && cached.avatar === fresh.avatar && cached.avatarFallback === fresh.avatarFallback
        && cached.provider === fresh.provider) {
        return false;
    }
    userProfile.set(fresh);
    return true;
}


async function runHeadlessBackup() {
    try {
        settingsStore.initialize(app.getPath('userData'));
    } catch (err) {
        debug('warn', 'Failed to initialize settings store:', err.message);
    }
    app.setAppUserModelId('com.kolokithes.makeyourlifeeasier');

    const result = await gameSavesService.runScheduledBackup({ headless: true });
    debug(result.success ? 'info' : 'warn', 'Scheduled game saves backup finished:', JSON.stringify(result.lastRun || result));

    setTimeout(() => {
        if (BrowserWindow.getAllWindows().length === 0) app.quit();
    }, 3000);
}

app.whenReady().then(async () => {
    if (installerMode) {
        ipcHandlers.setupInstallerModeHandlers(selfInstaller, windowManager.getInstallerWindow, debug);
        windowManager.createInstallerWindow(installerPreloadPath);
        return;
    }

    if (backupSavesMode) {
        if (gotTheLock) await runHeadlessBackup();
        return;
    }

    cleanupStaleLockFiles();

    sparkleModule.cleanupLeftoverSparkle().catch(() => {});

    if (gotTheLock) downloadManager.cleanupLeftoverDownloads(debug).catch(() => {});

    updater.cleanupUpdaterCache(debug);

    try {
        supabase.initialize(app.getPath('userData'));
    } catch (err) {
        debug('warn', 'Failed to initialize Supabase:', err.message);
    }

    try {
        userProfile.initialize(app.getPath('userData'));
        const cached = userProfile.get();
        const sessionUser = await supabase.getSessionUser();
        if (cached && !sessionUser) {
            debug('warn', 'Clearing cached user profile because the Supabase session is missing.');
            userProfile.clear();
        } else if (sessionUser) {
            applyProfile(sessionUser, cached);
            supabase.getFreshUser()
                .then((freshUser) => {
                    if (!freshUser) return;
                    if (applyProfile(freshUser, userProfile.get())) {
                        const win = windowManager.getMainWindow();
                        if (win && !win.isDestroyed()) {
                            win.webContents.send('user-profile-updated', userProfile.get());
                        }
                    }
                })
                .catch((err) => debug('warn', 'Background profile refresh failed:', err?.message || err));
        }
    } catch (err) {
        debug('warn', 'Failed to initialize user profile:', err.message);
    }

    try {
        settingsStore.initialize(app.getPath('userData'));
        settingsStore.pullFromCloud().catch(() => {});
    } catch (err) {
        debug('warn', 'Failed to initialize settings store:', err.message);
    }

    let justUpdated = false;
    const justUpdatedFlag = path.join(app.getPath('userData'), '.just-updated');
    try {
        if (fs.existsSync(justUpdatedFlag)) {
            justUpdated = true;
            fs.unlinkSync(justUpdatedFlag);
        }
    } catch {  }

    certificate.ensureCertificateTrusted().catch(() => {});

    if (skipUpdater || justUpdated) {
        createMainWindow(false);
    } else {
        createUpdateWindow();
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            if (skipUpdater) {
                createMainWindow(false);
            } else {
                createUpdateWindow();
            }
        }
    });
});

app.on('window-all-closed', () => {
    if (updater.isQuittingForInstall()) return;
    if (backupSavesMode && gameSavesService.isRunningScheduled()) return;
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    const safeDebug = (level, ...args) => {
        try { debug(level, ...args); } catch {  }
    };

    gameSavesService.dispose();

    if (gotTheLock && !installerMode) downloadManager.cleanupOnQuit(safeDebug);

    try { systemTools.stopCleanerAdminSession(); } catch { }

    sparkleModule.cleanupSparkle();

    pendingCleanupFiles.forEach(filePath => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                safeDebug('info', 'Cleaned up temp file:', filePath);
            }
        } catch (err) {
            safeDebug('warn', 'Failed to cleanup temp file:', filePath, err.message);
        }
    });
    pendingCleanupFiles.clear();
});

app.on('will-quit', () => {
    try { debug('info', '👋 Application shutting down gracefully'); } catch {  }
});
