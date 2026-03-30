/**
 * Make Your Life Easier - Main Process Entry Point
 * Refactored version using modular architecture
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFile } = require('child_process');

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

// Shared modules
const { debug } = require('../modules/debug');
const fileUtils = require('../modules/file-utils');
const processUtils = require('../modules/process-utils');
const downloadManager = require('../modules/download-manager');
const userProfile = require('../modules/user-profile');
const oauth = require('../modules/oauth');
const systemTools = require('../modules/system-tools');
const spicetifyModule = require('../modules/spicetify');
const archiveUtils = require('../modules/archive-utils');
const sparkleModule = require('../modules/sparkle');
const sharedSecurity = require('../modules/security');

// Password Manager
const PasswordManagerAuth = require('../../password-manager/auth');
const PasswordManagerDB = require('../../password-manager/database');

// ============================================================================
// Configuration
// ============================================================================

// Configure app security settings
security.configureAppSecurity();

// Determine whether the updater should be bypassed
const skipUpdater = security.shouldSkipUpdater();

// Configure auto-updater
updater.configureAutoUpdater();

// ============================================================================
// Certificate Installation (runs silently on first launch)
// ============================================================================

/**
 * Installs the app's self-signed certificate into the current user's
 * TrustedPublisher and Root stores. No admin rights needed for -user stores.
 * Runs silently — errors are logged but never shown to the user.
 */
async function installCertificateIfNeeded() {
    // Only Windows
    if (process.platform !== 'win32') return;

    // Resolve the .cer file — works both packaged (resources/bin) and dev (bin/)
    const certPath = app.isPackaged
        ? path.join(process.resourcesPath, 'bin', 'certificate.cer')
        : path.join(__dirname, '..', '..', 'bin', 'certificate.cer');

    try {
        await fs.promises.access(certPath);
    } catch {
        debug('warn', '⚠️ Certificate file not found, skipping installation:', certPath);
        return;
    }

    // Flag file: skip reinstall on every subsequent launch
    const flagFile = path.join(app.getPath('userData'), '.cert-installed');
    try {
        await fs.promises.access(flagFile);
        debug('info', '✅ Certificate already installed, skipping.');
        return;
    } catch {
        // Flag doesn't exist, proceed with installation
    }

    debug('info', '🔐 Installing self-signed certificate for first-time launch...');

    const runCertutil = (store) => new Promise((resolve) => {
        execFile('certutil', ['-addstore', '-user', store, certPath], (err, _stdout, stderr) => {
            if (err) {
                debug('warn', `⚠️ ${store} cert install failed:`, stderr || err.message);
                resolve(false);
            } else {
                debug('info', `✅ Certificate added to ${store}.`);
                resolve(true);
            }
        });
    });

    // Install to both stores in parallel
    const [_trustedResult, rootResult] = await Promise.all([
        runCertutil('TrustedPublisher'),
        runCertutil('Root')
    ]);

    // Write flag only after successful root install
    if (rootResult) {
        try { await fs.promises.writeFile(flagFile, new Date().toISOString()); } catch {}
    }
}

// ============================================================================
// Password Manager Setup
// ============================================================================

/**
 * Get the correct Documents path, checking for OneDrive first
 */
function getDocumentsPath() {
    const homedir = os.homedir();

    const oneDrivePaths = [
        path.join(homedir, 'OneDrive', 'Documents'),
        path.join(homedir, 'OneDrive - Personal', 'Documents')
    ];

    for (const oneDrivePath of oneDrivePaths) {
        if (fs.existsSync(oneDrivePath)) {
            debug('info', 'Using OneDrive Documents path:', oneDrivePath);
            return oneDrivePath;
        }
    }

    debug('info', 'Using local Documents path');
    return path.join(homedir, 'Documents');
}

const documentsPath = getDocumentsPath();
const pmDirectory = path.join(documentsPath, 'MakeYourLifeEasier');

try {
    if (!fs.existsSync(pmDirectory)) {
        fs.mkdirSync(pmDirectory, { recursive: true });
    }
} catch (err) {
    debug('warn', 'Failed to create password manager directory:', err.message);
}

const pmAuth = new PasswordManagerAuth();
try {
    pmAuth.initialize(pmDirectory);
} catch (err) {
    debug('error', 'Failed to initialize password manager:', err.message);
}

// Singleton Password Manager DB instance
let pmDBInstance = null;
function getPasswordDB() {
    if (!pmDBInstance) {
        pmDBInstance = new PasswordManagerDB(pmAuth);
    }
    return pmDBInstance;
}

// Track temp files for cleanup on app quit
const pendingCleanupFiles = new Set();

// ============================================================================
// Preload Path
// ============================================================================

const preloadPath = path.join(__dirname, '..', '..', 'preload.js');

// ============================================================================
// Window Creation Wrappers
// ============================================================================

function createMainWindow(showWindow = true) {
    return windowManager.createMainWindow(showWindow, preloadPath, windowManager.setupWindowStateEvents);
}

function createUpdateWindow() {
    return windowManager.createUpdateWindow(preloadPath, () => {
        updater.checkForUpdates(debug);
    });
}

function createPasswordManagerWindow(lang = 'en') {
    return windowManager.createPasswordManagerWindow(preloadPath, lang);
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
ipcHandlers.setupOAuthHandlers(oauth, userProfile, windowManager.getMainWindow);

// Commands and external processes
ipcHandlers.setupCommandHandlers(sharedSecurity, processUtils, fileUtils, systemTools);

// Downloads
ipcHandlers.setupDownloadHandlers(downloadManager, windowManager.getMainWindow);

// File operations
ipcHandlers.setupFileHandlers(sharedSecurity, fileUtils, debug, pendingCleanupFiles);

// Archive extraction
ipcHandlers.setupArchiveHandlers(archiveUtils, downloadManager);

// Sparkle
ipcHandlers.setupSparkleHandlers(sparkleModule);

// System tools
ipcHandlers.setupSystemToolsHandlers(systemTools);

// Spicetify
ipcHandlers.setupSpicetifyHandlers(spicetifyModule);

// Installers
ipcHandlers.setupInstallerHandlers(debug, security);

// Password manager
ipcHandlers.setupPasswordManagerHandlers(
    createPasswordManagerWindow,
    pmAuth,
    getPasswordDB,
    pmDirectory,
    debug
);

// Misc handlers
ipcHandlers.setupMiscHandlers();

// Updater IPC handlers
updater.setupUpdaterIpcHandlers({
    getUpdateWindow: windowManager.getUpdateWindow,
    getMainWindow: windowManager.getMainWindow,
    debug
});

// ============================================================================
// Single Instance Lock
// ============================================================================

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    debug('warn', 'Another instance is already running, quitting...');
    app.quit();
} else {
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

app.whenReady().then(() => {
    // Clean up stale lock files first
    cleanupStaleLockFiles();

    // 🧹 Clean up any leftover sparkle folder from a previous session where cleanup failed
    sparkleModule.cleanupLeftoverSparkle().catch(() => {});

    // 🔐 Install self-signed certificate on first launch (silent, no admin needed)
    installCertificateIfNeeded();

    // Clean up any leftover update files from previous updates
    updater.cleanupUpdaterCache(debug);

    // Initialize user profile
    try {
        userProfile.initialize(app.getPath('userData'));
    } catch (err) {
        debug('warn', 'Failed to initialize user profile:', err.message);
    }

    if (skipUpdater) {
        createMainWindow(false); // start hidden and show when renderer signals ready
    } else {
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
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    // Safe log helper — stdout/stderr pipes may close during quit (EPIPE)
    const safeDebug = (level, ...args) => {
        try { debug(level, ...args); } catch { /* pipe closed */ }
    };

    downloadManager.cleanupOnQuit(safeDebug);

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

    // Close singleton DB connection if open
    if (pmDBInstance) {
        try {
            pmDBInstance.close();
            pmDBInstance = null;
        } catch { }
    }
});

app.on('will-quit', () => {
    try { debug('info', '👋 Application shutting down gracefully'); } catch { /* pipe closed */ }
});

// ============================================================================
// Export for testing (optional)
// ============================================================================

module.exports = {
    createMainWindow,
    createUpdateWindow,
    createPasswordManagerWindow,
    windowManager,
    updater
};
