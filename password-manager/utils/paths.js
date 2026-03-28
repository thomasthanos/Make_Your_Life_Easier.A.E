/**
 * Shared path utilities for Password Manager
 * Centralizes document path detection to avoid duplication
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Get the user's Documents folder path, checking OneDrive locations first
 * @returns {string} Path to Documents folder
 */
function getDocumentsPath() {
    const oneDrivePaths = [
        path.join(os.homedir(), 'OneDrive', 'Documents'),
        path.join(os.homedir(), 'OneDrive - Personal', 'Documents'),
        path.join(os.homedir(), 'Documents')
    ];

    for (const docPath of oneDrivePaths) {
        if (fs.existsSync(docPath)) {
            return docPath;
        }
    }

    return path.join(os.homedir(), 'Documents');
}

/**
 * Get the app data directory path (Documents/MakeYourLifeEasier)
 * @returns {string} Path to app data folder
 */
function getAppDataPath() {
    return path.join(getDocumentsPath(), 'MakeYourLifeEasier');
}

module.exports = {
    getDocumentsPath,
    getAppDataPath
};
