/**
 * Make Your Life Easier - Main Process Entry Point
 * Refactored version using modular architecture
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Set userData path to AppData\Roaming\ThomasThanos\MakeYourLifeEasier
// Must be done before any module imports that call app.getPath('userData')
const _roamingBase = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
app.setPath('userData', path.join(_roamingBase, 'ThomasThanos', 'MakeYourLifeEasier'));

// ============================================================================
// Module Imports
// ============================================================================

// Main process modules
const windowManager = require('./window-manager');
const ipcHandlers = require('./ipc-handlers');
const updater = require('./updater');
const security = require('./security');
const certificate = require('./certificate');
const selfInstaller = require('./self-installer');

// Shared modules
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

// ============================================================================
// Configuration
// ============================================================================

// Configure app security settings
security.configureAppSecurity();

// Determine whether the updater should be bypassed
const skipUpdater = security.shouldSkipUpdater();

// Configure auto-updater
updater.configureAutoUpdater();

// Track temp files for cleanup on app quit
const pendingCleanupFiles = new Set();

// ============================================================================
// Preload Path
// ============================================================================

const preloadPath = path.join(__dirname, '..', 'preload', 'index.js');
const installerPreloadPath = path.join(__dirname, '..', 'installer-ui', 'preload.js');

// Whether this launch is acting as the Setup installer / uninstaller
const installerMode = selfInstaller.isInstallerMode() || selfInstaller.isUninstallMode();

// When launched from the Setup "Launch now" button, signal the installer once our
// first window is visible so it can close without leaving a blank gap.
function signalInstallerWhenReady() {
    const signalPath = process.env.MYLE_LAUNCH_SIGNAL;
    if (!signalPath) return;
    let done = false;
    const write = () => {
        if (done) return;
        done = true;
        try { fs.writeFileSync(signalPath, '1'); } catch { /* installer may be gone */ }
    };
    app.on('browser-window-created', (_event, win) => {
        win.once('ready-to-show', write);
        win.once('show', write);
    });
    setTimeout(write, 10000);
}

if (!installerMode) signalInstallerWhenReady();

// ============================================================================
// Window Creation Wrappers
// ============================================================================

function createMainWindow(showWindow = true) {
    return windowManager.createMainWindow(showWindow, preloadPath);
}

function createUpdateWindow() {
    return windowManager.createUpdateWindow(preloadPath, () => {
        updater.checkForUpdates(debug);
    });
}


// ============================================================================
// Setup Updater Events
// ============================================================================

updater.setupUpdaterEvents({
    getUpdateWindow: windowManager.getUpdateWindow,
    getMainWindow: windowManager.getMainWindow,
    createMainWindow,
    debug
});

// ============================================================================
// Setup IPC Handlers
// ============================================================================

// Window controls
ipcHandlers.setupWindowHandlers(windowManager.getMainWindow);

// System info
ipcHandlers.setupSystemInfoHandlers();

// OAuth and user profile
ipcHandlers.setupOAuthHandlers(oauth, userProfile, windowManager.getMainWindow, supabase, settingsStore);
ipcHandlers.setupSettingsHandlers(settingsStore);

// Commands and external processes
ipcHandlers.setupCommandHandlers(sharedSecurity, processUtils, fileUtils, systemTools);

// Downloads
ipcHandlers.setupDownloadHandlers(downloadManager, windowManager.getMainWindow);

// File operations
ipcHandlers.setupFileHandlers(sharedSecurity, fileUtils, debug, pendingCleanupFiles);

// Archive extraction
ipcHandlers.setupArchiveHandlers(sharedSecurity, archiveUtils, downloadManager);

// Sparkle
ipcHandlers.setupSparkleHandlers(sparkleModule);

// System tools
ipcHandlers.setupSystemToolsHandlers(systemTools);

// Spicetify
ipcHandlers.setupSpicetifyHandlers(spicetifyModule);

// Installers
ipcHandlers.setupInstallerHandlers(debug, security);


// Updater IPC handlers
updater.setupUpdaterIpcHandlers({
    getUpdateWindow: windowManager.getUpdateWindow,
    getMainWindow: windowManager.getMainWindow,
    debug
});

// ============================================================================
// Single Instance Lock
// ============================================================================

const gotTheLock = installerMode ? true : app.requestSingleInstanceLock();

if (!gotTheLock) {
    debug('warn', 'Another instance is already running, quitting...');
    app.quit();
} else if (!installerMode) {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, focus our window instead
        const mainWindow = windowManager.getMainWindow();
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

// ============================================================================
// Cleanup Stale Lock Files on Startup
// ============================================================================

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

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(async () => {
    // Installer / uninstaller mode: show only the themed Setup window and stop here
    if (installerMode) {
        ipcHandlers.setupInstallerModeHandlers(selfInstaller, windowManager.getInstallerWindow, debug);
        windowManager.createInstallerWindow(installerPreloadPath);
        return;
    }

    // Clean up stale lock files first
    cleanupStaleLockFiles();

    // 🧹 Clean up any leftover sparkle folder from a previous session where cleanup failed
    sparkleModule.cleanupLeftoverSparkle().catch(() => {});

    downloadManager.cleanupLeftoverDownloads(debug);

    // Clean up any leftover update files from previous updates
    updater.cleanupUpdaterCache(debug);

    try {
        supabase.initialize(app.getPath('userData'));
    } catch (err) {
        debug('warn', 'Failed to initialize Supabase:', err.message);
    }

    // Initialize user profile
    try {
        userProfile.initialize(app.getPath('userData'));
        const sessionUser = await supabase.getSessionUser();
        if (userProfile.get() && !sessionUser) {
            debug('warn', 'Clearing cached user profile because the Supabase session is missing.');
            userProfile.clear();
        } else if (!userProfile.get() && sessionUser) {
            userProfile.set(profileFromUser(sessionUser));
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

    // Skip the update check on the first launch right after an update was installed
    let justUpdated = false;
    const justUpdatedFlag = path.join(app.getPath('userData'), '.just-updated');
    try {
        if (fs.existsSync(justUpdatedFlag)) {
            justUpdated = true;
            fs.unlinkSync(justUpdatedFlag);
        }
    } catch { /* ignore */ }

    if (skipUpdater || justUpdated) {
        certificate.ensureCertificateTrusted().catch(() => {});
        createMainWindow(false); // start hidden and show when renderer signals ready
    } else {
        await certificate.ensureCertificateTrusted();
        createUpdateWindow();
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            if (skipUpdater) {
                createMainWindow(false); // start hidden on activate too
            } else {
                createUpdateWindow();
            }
        }
    });
});

app.on('window-all-closed', () => {
    if (updater.isQuittingForInstall()) return;
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    // Safe log helper — stdout/stderr pipes may close during quit (EPIPE)
    const safeDebug = (level, ...args) => {
        try { debug(level, ...args); } catch { /* pipe closed */ }
    };

    downloadManager.cleanupOnQuit(safeDebug);

    // Stop the elevated cleaner admin worker, if one is running
    try { systemTools.stopCleanerAdminSession(); } catch { }

    // Cleanup sparkle files
    sparkleModule.cleanupSparkle();

    // Cleanup any pending temp files
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
    try { debug('info', '👋 Application shutting down gracefully'); } catch { /* pipe closed */ }
});
