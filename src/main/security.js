/**
 * Security Module for Main Process
 * Re-exports security utilities and adds main process specific security features
 */

const { app } = require('electron');

// Re-export the shared security module
const sharedSecurity = require('../modules/security');

/**
 * Configure app command line switches for security
 */
function configureAppSecurity() {
    // Enable dark mode for web contents
    app.commandLine.appendSwitch('enable-features', 'WebContentsForceDark');
    // Disable HTTP/2 for better compatibility
    app.commandLine.appendSwitch('disable-http2');
}

/**
 * Determine if updater should be bypassed
 * @returns {boolean}
 */
function shouldSkipUpdater() {
    return Boolean(process.env.ELECTRON_NO_UPDATER) ||
        Boolean(process.env.BYPASS_UPDATER) ||
        process.argv.includes('--no-updater');
}

// Export shared security module functions along with main-process specific ones
module.exports = {
    // Re-export all shared security functions
    ...sharedSecurity,

    // Main process specific
    configureAppSecurity,
    shouldSkipUpdater
};
