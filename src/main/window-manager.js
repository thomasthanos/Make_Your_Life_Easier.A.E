
const { BrowserWindow, app } = require('electron');
const path = require('path');
const { hardenWindow } = require('./security');

const MAIN_WINDOW = { width: 1100, height: 750, minWidth: 800, minHeight: 600 };
const UPDATE_WINDOW = { width: 650, height: 440 };
const INSTALLER_WINDOW = { width: 560, height: 462 };
const WINDOW_BG_COLOR = '#171717';

const isDev = !app.isPackaged;

let mainWindow = null;
let updateWindow = null;
let installerWindow = null;

function getMainWindow() {
    return mainWindow;
}

function getUpdateWindow() {
    return updateWindow;
}

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
            devTools: isDev
        }
    });

    hardenWindow(mainWindow);
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

    if (!isDev) {
        mainWindow.webContents.on('before-input-event', (event, input) => {
            if (
                (input.control && input.shift && (input.key === 'I' || input.key === 'J' || input.key === 'C')) ||
                input.key === 'F12'
            ) {
                event.preventDefault();
            }
        });
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    return mainWindow;
}

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

    hardenWindow(updateWindow);
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

function getInstallerWindow() {
    return installerWindow;
}

function createInstallerWindow(preloadPath) {
    installerWindow = new BrowserWindow({
        width: INSTALLER_WINDOW.width,
        height: INSTALLER_WINDOW.height,
        resizable: false,
        maximizable: false,
        fullscreenable: false,
        icon: path.join(__dirname, '..', 'assets', 'icons', 'hacker.ico'),
        autoHideMenuBar: true,
        frame: false,
        show: false,
        transparent: true,
        backgroundColor: '#00000000',
        hasShadow: true,
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
            devTools: isDev
        }
    });

    hardenWindow(installerWindow);
    installerWindow.setMenuBarVisibility(false);
    installerWindow.loadFile(path.join(__dirname, '..', 'installer-ui', 'installer.html'));

    installerWindow.once('ready-to-show', () => {
        if (installerWindow && !installerWindow.isDestroyed()) installerWindow.show();
    });

    installerWindow.on('closed', () => {
        installerWindow = null;
    });

    return installerWindow;
}

module.exports = {
    getMainWindow,
    getUpdateWindow,
    getInstallerWindow,
    createMainWindow,
    createUpdateWindow,
    createInstallerWindow
};
