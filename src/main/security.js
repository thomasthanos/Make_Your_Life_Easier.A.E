/**
 * Security Module for Main Process
 * Re-exports security utilities and adds main process specific security features
 */

const { app, shell } = require('electron');
const path = require('path');

// Re-export the shared security module
const sharedSecurity = require('../modules/security');

/**
 * Configure app command line switches for security
 */
function configureAppSecurity() {
    // Enable dark mode for web contents
    app.commandLine.appendSwitch('enable-features', 'WebContentsForceDark');
}

// Everything the app is allowed to load into its own windows lives under src/.
const APP_ROOT = path.resolve(__dirname, '..');

/**
 * Whether a URL points at one of the app's own bundled pages.
 * @param {string} url - Target URL
 * @returns {boolean} True for file:// URLs inside the app directory
 */
function isLocalAppUrl(url) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'file:') return false;
        return sharedSecurity.isWithin(decodeURIComponent(parsed.pathname).replace(/^\//, ''), APP_ROOT);
    } catch {
        return false;
    }
}

/**
 * Lock a window down to the local UI it was built for.
 *
 * Any window Electron opens on this one's behalf inherits its webPreferences, and
 * therefore its preload — so a `window.open()` or a `target="_blank"` link would
 * hand the full `window.api` bridge (run-command, replace-exe, extract-archive)
 * to whatever page ended up in that window. Nothing may open a window, and the
 * frame may not navigate away from the bundled pages; real links are handed to
 * the user's browser instead, which is where they belonged anyway.
 *
 * The OAuth window is deliberately not passed through here: it has no preload,
 * loads a real identity-provider page, and drives its own redirect handling.
 * @param {import('electron').BrowserWindow} win - Window to harden
 * @returns {import('electron').BrowserWindow} The same window, for chaining
 */
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

    // The app ships no <webview>; anything trying to attach one is not ours.
    contents.on('will-attach-webview', (event) => event.preventDefault());

    return win;
}

/**
 * Hand an http(s) URL to the user's default browser, ignoring anything else.
 * @param {string} url - Candidate URL
 */
function openExternally(url) {
    try {
        const { protocol } = new URL(url);
        if (protocol === 'http:' || protocol === 'https:') {
            shell.openExternal(url).catch(() => {});
        }
    } catch {
        // Not a URL we can act on — dropping it is the safe outcome.
    }
}

/**
 * Determine if updater should be bypassed
 * @returns {boolean}
 */
function shouldSkipUpdater() {
    return Boolean(process.env.ELECTRON_NO_UPDATER) ||
        Boolean(process.env.BYPASS_UPDATER) ||
        Boolean(process.env.PORTABLE_EXECUTABLE_DIR) ||
        process.argv.includes('--no-updater');
}

// Export shared security module functions along with main-process specific ones
module.exports = {
    // Re-export all shared security functions
    ...sharedSecurity,

    // Main process specific
    configureAppSecurity,
    hardenWindow,
    isLocalAppUrl,
    shouldSkipUpdater
};
