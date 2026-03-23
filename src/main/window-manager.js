/**
 * Window Manager Module
 * Handles creation and management of all application windows
 */

const { BrowserWindow } = require('electron');
const path = require('path');

// Window dimension constants
const MAIN_WINDOW = { width: 1100, height: 750, minWidth: 800, minHeight: 600 };
const UPDATE_WINDOW = { width: 500, height: 350 };
const PASSWORD_WINDOW = { width: 1600, height: 900 };
const WINDOW_BG_COLOR = '#0f1117';

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
 * Get the update window instance
 * @returns {BrowserWindow|null}
 */
function getUpdateWindow() {
    return updateWindow;
}

/**
 * Create the main application window
 * @param {boolean} showWindow - Whether to show the window when ready
 * @param {string} preloadPath - Path to preload script
 * @param {Function} setupWindowStateEvents - Callback for setting up window state events
 * @returns {BrowserWindow}
 */
function createMainWindow(showWindow = true, preloadPath, setupWindowStateEvents) {
    mainWindow = new BrowserWindow({
        width: MAIN_WINDOW.width,
        height: MAIN_WINDOW.height,
        icon: path.join(__dirname, '..', 'assets', 'icons', 'hacker.ico'),
        minWidth: MAIN_WINDOW.minWidth,
        minHeight: MAIN_WINDOW.minHeight,
        autoHideMenuBar: true,
        titleBarStyle: 'hidden',
        frame: false,
        show: showWindow,
        backgroundColor: WINDOW_BG_COLOR,
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, '..', '..', 'index.html'));

    // Cleanup reference when window is closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

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
        width: UPDATE_WINDOW.width,
        height: UPDATE_WINDOW.height,
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
        width: PASSWORD_WINDOW.width,
        height: PASSWORD_WINDOW.height,
        icon: path.join(__dirname, '..', 'assets', 'icons', 'hacker.ico'),
        parent: mainWindow,
        frame: false,
        titleBarStyle: 'hidden',
        autoHideMenuBar: true,
        backgroundColor: WINDOW_BG_COLOR,
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

module.exports = {
    getMainWindow,
    getUpdateWindow,
    createMainWindow,
    createUpdateWindow,
    createPasswordManagerWindow,
    setupWindowStateEvents,
    MAIN_WINDOW,
    WINDOW_BG_COLOR
};
