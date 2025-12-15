/**
 * Window Manager Module
 * Handles creation and management of all application windows
 */

const { BrowserWindow } = require('electron');
const path = require('path');

// Window references
let mainWindow = null;
let updateWindow = null;

/**
 * Get the main window instance
 * @returns {BrowserWindow|null}
 */
function getMainWindow() {
    return mainWindow;
}

/**
 * Set the main window instance
 * @param {BrowserWindow|null} window
 */
function setMainWindow(window) {
    mainWindow = window;
}

/**
 * Get the update window instance
 * @returns {BrowserWindow|null}
 */
function getUpdateWindow() {
    return updateWindow;
}

/**
 * Set the update window instance
 * @param {BrowserWindow|null} window
 */
function setUpdateWindow(window) {
    updateWindow = window;
}

/**
 * Create the main application window
 * @param {boolean} showWindow - Whether to show the window immediately
 * @param {string} preloadPath - Path to preload script
 * @param {Function} setupWindowStateEvents - Callback for setting up window state events
 * @returns {BrowserWindow}
 */
function createMainWindow(showWindow = true, preloadPath, setupWindowStateEvents) {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 750,
        icon: path.join(__dirname, '..', 'assets', 'icons', 'hacker.ico'),
        minWidth: 800,
        minHeight: 600,
        autoHideMenuBar: true,
        titleBarStyle: 'hidden',
        frame: false,
        show: showWindow,
        backgroundColor: '#0f1117',
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile(path.join(__dirname, '..', '..', 'index.html'));

    if (setupWindowStateEvents) {
        setupWindowStateEvents();
    }

    return mainWindow;
}

/**
 * Create the update/splash window
 * @param {string} preloadPath - Path to preload script
 * @param {Function} onReady - Callback when window is ready
 * @returns {BrowserWindow}
 */
function createUpdateWindow(preloadPath, onReady) {
    updateWindow = new BrowserWindow({
        width: 500,
        height: 350,
        resizable: false,
        movable: true,
        minimizable: false,
        maximizable: false,
        frame: false,
        show: false,
        transparent: true,
        backgroundColor: '#00000000',
        hasShadow: false,
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    updateWindow.setMenuBarVisibility(false);
    updateWindow.loadFile(path.join(__dirname, '..', '..', 'updater', 'update.html'));

    updateWindow.on('closed', () => {
        updateWindow = null;
    });

    updateWindow.webContents.once('did-finish-load', () => {
        updateWindow.show();
        if (onReady) {
            onReady();
        }
    });

    return updateWindow;
}

/**
 * Create the password manager window
 * @param {string} preloadPath - Path to preload script
 * @param {string} lang - Language code
 * @returns {BrowserWindow}
 */
function createPasswordManagerWindow(preloadPath, lang = 'en') {
    const passwordWindow = new BrowserWindow({
        width: 1600,
        height: 900,
        icon: path.join(__dirname, '..', 'assets', 'icons', 'hacker.ico'),
        parent: mainWindow,
        frame: false,
        titleBarStyle: 'hidden',
        autoHideMenuBar: true,
        backgroundColor: '#0f1117',
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    passwordWindow.loadFile(path.join(__dirname, '..', '..', 'password-manager', 'index.html'), {
        query: { lang }
    });
    passwordWindow.setMenuBarVisibility(false);

    return passwordWindow;
}

/**
 * Setup window state change events for the main window
 */
function setupWindowStateEvents() {
    if (mainWindow) {
        mainWindow.on('maximize', () => {
            mainWindow.webContents.send('window-state-changed', { isMaximized: true });
        });
        mainWindow.on('unmaximize', () => {
            mainWindow.webContents.send('window-state-changed', { isMaximized: false });
        });
    }
}

/**
 * Close all windows safely
 */
function closeAllWindows() {
    if (updateWindow) {
        updateWindow.close();
        updateWindow = null;
    }
    if (mainWindow) {
        mainWindow.close();
        mainWindow = null;
    }
}

module.exports = {
    getMainWindow,
    setMainWindow,
    getUpdateWindow,
    setUpdateWindow,
    createMainWindow,
    createUpdateWindow,
    createPasswordManagerWindow,
    setupWindowStateEvents,
    closeAllWindows
};
