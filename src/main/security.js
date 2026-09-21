
const { app, shell } = require('electron');
const path = require('path');

const sharedSecurity = require('../modules/security');

function configureAppSecurity() {
    app.commandLine.appendSwitch('enable-features', 'WebContentsForceDark');
}

const APP_ROOT = path.resolve(__dirname, '..');

function isLocalAppUrl(url) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'file:') return false;
        return sharedSecurity.isWithin(decodeURIComponent(parsed.pathname).replace(/^\//, ''), APP_ROOT);
    } catch {
        return false;
    }
}

function hardenWindow(win) {
    if (!win || win.isDestroyed()) return win;
    const contents = win.webContents;

    contents.setWindowOpenHandler(({ url }) => {
        openExternally(url);
        return { action: 'deny' };
    });

    contents.on('will-navigate', (event, url) => {
        if (isLocalAppUrl(url)) return;
        event.preventDefault();
        openExternally(url);
    });

    contents.on('will-attach-webview', (event) => event.preventDefault());

    return win;
}

function openExternally(url) {
    try {
        const { protocol } = new URL(url);
        if (protocol === 'http:' || protocol === 'https:') {
            shell.openExternal(url).catch(() => {});
        }
    } catch {
    }
}

function shouldSkipUpdater() {
    return Boolean(process.env.ELECTRON_NO_UPDATER) ||
        Boolean(process.env.BYPASS_UPDATER) ||
        Boolean(process.env.PORTABLE_EXECUTABLE_DIR) ||
        process.argv.includes('--no-updater');
}

module.exports = {
    ...sharedSecurity,

    configureAppSecurity,
    hardenWindow,
    isLocalAppUrl,
    shouldSkipUpdater
};
