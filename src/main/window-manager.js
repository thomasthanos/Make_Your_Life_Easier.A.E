/**
 * Window Manager Module
 * Handles creation and management of all application windows
 */

const { BrowserWindow, app } = require('electron');
const path = require('path');

// Window dimension constants
const MAIN_WINDOW = { width: 1100, height: 750, minWidth: 800, minHeight: 600 };
const UPDATE_WINDOW = { width: 650, height: 440 };
const WINDOW_BG_COLOR = '#171717';

// Whether the app is running in development mode
const isDev = !app.isPackaged;

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
 * @returns {BrowserWindow}
 */
function createMainWindow(showWindow = true, preloadPath) {
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
            backgroundThrottling: false,
            devTools: isDev
        }
    });

    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

    // Block DevTools keyboard shortcut in production
    if (!isDev) {
        mainWindow.webContents.on('before-input-event', (event, input) => {
            // Block Ctrl+Shift+I, Ctrl+Shift+J, F12
            if (
                (input.control && input.shift && (input.key === 'I' || input.key === 'J')) ||
                input.key === 'F12'
            ) {
                event.preventDefault();
            }
        });
    }

    // Cleanup reference when window is closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

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
            contextIsolation: true,
            devTools: isDev
        }
    });

    updateWindow.setMenuBarVisibility(false);
    updateWindow.loadFile(path.join(__dirname, '..', 'updater', 'update.html'));

    updateWindow.on('closed', () => {
        updateWindow = null;
    });

    updateWindow.once('ready-to-show', () => {
        if (updateWindow && !updateWindow.isDestroyed()) {
            updateWindow.show();
            if (onReady) {
                onReady();
            }
        }
    });

    return updateWindow;
}

module.exports = {
    getMainWindow,
    getUpdateWindow,
    createMainWindow,
    createUpdateWindow,
    MAIN_WINDOW,
    WINDOW_BG_COLOR
};
