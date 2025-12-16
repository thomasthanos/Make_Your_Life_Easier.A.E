/**
 * Make Your Life Easier - Main Process Entry Point
 * Refactored version using modular architecture
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

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

if (!fs.existsSync(pmDirectory)) {
    fs.mkdirSync(pmDirectory, { recursive: true });
}

const pmAuth = new PasswordManagerAuth();
pmAuth.initialize(pmDirectory);

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
ipcHandlers.setupInstallerHandlers(debug);

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
// App Lifecycle
// ============================================================================

app.whenReady().then(() => {
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
    downloadManager.cleanupOnQuit(debug);

    // Cleanup any pending temp files
    pendingCleanupFiles.forEach(filePath => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                debug('info', 'Cleaned up temp file:', filePath);
            }
        } catch (err) {
            debug('warn', 'Failed to cleanup temp file:', filePath, err.message);
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
