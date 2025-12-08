/**
 * Auto-Updater Module
 * Manages application updates using electron-updater
 */

const { autoUpdater } = require('electron-updater');
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { debug } = require('./debug');

let updateAvailable = false;
let pendingUpdateInfo = null;
let isManualCheck = false;
let updateDownloaded = false;
let mainWindow = null;
let updateWindow = null;
let userDataPathRef = null;

/**
 * Initialize the auto-updater
 * @param {Object} options - Configuration options
 * @param {BrowserWindow} options.mainWin - Reference to main window
 * @param {BrowserWindow} options.updateWin - Reference to update window
 * @param {Function} options.createMainWindow - Function to create main window
 * @param {string} options.userDataPath - Path to user data directory
 */
function initialize(options) {
  mainWindow = options.mainWin;
  updateWindow = options.updateWin;
  const createMainWindow = options.createMainWindow;
  const userDataPath = options.userDataPath;
  userDataPathRef = userDataPath;

  // Clean up old update files from previous update
  cleanupUpdaterCache();

  // Configure auto-updater
  autoUpdater.autoDownload = true;
  autoUpdater.requestHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
  };
  autoUpdater.autoInstallOnAppQuit = false;

  // Event handlers
  autoUpdater.on('checking-for-update', () => {
    debug('info', 'Checking for updates...');
    if (updateWindow) {
      updateWindow.webContents.send('update-status', { status: 'checking', message: 'Checking for updates...' });
    } else if (mainWindow && isManualCheck) {
      mainWindow.webContents.send('update-status', { status: 'checking', message: 'Checking for updates...' });
    }
  });

  autoUpdater.on('update-available', async (info) => {
    debug('info', 'Update available:', info);
    updateAvailable = true;
    pendingUpdateInfo = {
      version: info.version,
      releaseName: info.releaseName,
      releaseNotes: info.releaseNotes
    };
    
    const title = info.releaseName || '';
    const version = info.version || '';
    const message = title ? `${title} (v${version})` : `New version available: v${version}`;
    const releaseNotes = info.releaseNotes || '';
    
    const payload = { status: 'available', message, version, releaseName: title, releaseNotes };
    if (updateWindow) updateWindow.webContents.send('update-status', payload);
    if (mainWindow) mainWindow.webContents.send('update-status', payload);
  });

  autoUpdater.on('update-not-available', (info) => {
    debug('info', 'Update not available:', info);
    
    if (updateWindow) {
      let progress = 0;
      updateWindow.webContents.send('update-status', {
        status: 'downloading',
        message: `Loading application: ${progress}%`,
        percent: progress
      });
      
      const progressTimer = setInterval(() => {
        progress = Math.min(progress + 5, 99);
        updateWindow.webContents.send('update-status', {
          status: 'downloading',
          message: `Loading application: ${progress}%`,
          percent: progress
        });
      }, 200);
      
      if (!mainWindow && createMainWindow) {
        createMainWindow(false);
        mainWindow = options.getMainWindow ? options.getMainWindow() : null;
      }
      
      if (mainWindow) {
        mainWindow.webContents.once('did-finish-load', () => {
          clearInterval(progressTimer);
          updateWindow.webContents.send('update-status', {
            status: 'downloading',
            message: 'Loading application: 100%',
            percent: 100
          });
          setTimeout(() => {
            if (updateWindow) updateWindow.close();
            try { if (mainWindow) mainWindow.show(); } catch { }
          }, 500);
        });
      }
      return;
    }
    
    if (mainWindow && isManualCheck) {
      mainWindow.webContents.send('update-status', {
        status: 'not-available',
        message: 'You are running the latest version'
      });
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    debug('info', 'Download progress:', progressObj);
    const statusPayload = {
      status: 'downloading',
      message: `Downloading update: ${Math.round(progressObj.percent)}%`,
      percent: progressObj.percent
    };
    if (updateWindow) updateWindow.webContents.send('update-status', statusPayload);
    if (mainWindow) mainWindow.webContents.send('update-status', statusPayload);
  });

  autoUpdater.on('update-downloaded', (info) => {
    debug('success', 'Update downloaded:', info);
    updateDownloaded = true;
    
    const title = info.releaseName || '';
    const version = info.version || '';
    const message = title ? `${title} (v${version}) downloaded.` : `v${version} downloaded.`;
    const payload = { status: 'downloaded', message, version, releaseName: title };
    
    if (updateWindow) updateWindow.webContents.send('update-status', payload);
    if (mainWindow) mainWindow.webContents.send('update-status', payload);

    // Persist update metadata
    try {
      const updateInfoToSave = pendingUpdateInfo || {
        version: info.version,
        releaseName: info.releaseName,
        releaseNotes: info.releaseNotes
      };
      updateInfoToSave.timestamp = Date.now();
      const updateInfoFilePath = path.join(userDataPath, 'update-info.json');
      fs.writeFileSync(updateInfoFilePath, JSON.stringify(updateInfoToSave));
    } catch (err) {
      debug('warn', 'Failed to persist update info:', err);
    }

    // Install update after short delay
    setTimeout(() => {
      try {
        autoUpdater.quitAndInstall(true, true);
      } catch (e) {
        debug('error', 'Failed to install update automatically:', e);
      }
    }, 1000);
  });

  autoUpdater.on('error', (err) => {
    debug('error', 'Update error:', err);
    
    if (updateWindow && !mainWindow) {
      updateWindow.webContents.send('update-status', {
        status: 'not-available',
        message: 'You are running the latest version'
      });
      setTimeout(() => {
        if (updateWindow) updateWindow.close();
        if (createMainWindow) createMainWindow();
      }, 800);
      return;
    }
    
    const payload = { status: 'error', message: `Update error: ${err.message}` };
    if (updateWindow) updateWindow.webContents.send('update-status', payload);
    if (mainWindow) mainWindow.webContents.send('update-status', payload);
  });
}

/**
 * Set window references (call when windows are created/destroyed)
 */
function setWindows(main, update) {
  mainWindow = main;
  updateWindow = update;
}

/**
 * Check for updates
 * @param {boolean} manual - Whether this is a manual check
 */
async function checkForUpdates(manual = false) {
  try {
    isManualCheck = manual;
    await autoUpdater.checkForUpdates();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    if (manual) isManualCheck = false;
  }
}

/**
 * Download available update
 */
async function downloadUpdate() {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Install downloaded update
 */
function installUpdate() {
  if (updateDownloaded) {
    autoUpdater.quitAndInstall(true, true);
    return { success: true };
  }
  return { success: false, error: 'No update downloaded' };
}

/**
 * Get current state
 */
function getState() {
  return {
    updateAvailable,
    updateDownloaded,
    pendingUpdateInfo
  };
}

/**
 * Clean up the updater cache directory
 * Removes downloaded installers and temp files after successful update
 */
function cleanupUpdaterCache() {
  try {
    // Get the updater cache directory path
    const appName = app.getName().toLowerCase().replace(/\s+/g, '-');
    const updaterCachePath = path.join(app.getPath('userData'), '..', `${appName}-updater`);
    
    if (fs.existsSync(updaterCachePath)) {
      const files = fs.readdirSync(updaterCachePath);
      let cleanedSize = 0;
      
      for (const file of files) {
        const filePath = path.join(updaterCachePath, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          // Recursively remove directories (like 'pending')
          fs.rmSync(filePath, { recursive: true, force: true });
          debug('info', `Cleaned updater cache directory: ${file}`);
        } else {
          // Remove files (.exe, .blockmap, .json, etc.)
          cleanedSize += stat.size;
          fs.unlinkSync(filePath);
          debug('info', `Cleaned updater cache file: ${file}`);
        }
      }
      
      if (cleanedSize > 0) {
        const sizeMB = (cleanedSize / (1024 * 1024)).toFixed(2);
        debug('success', `Updater cache cleaned: ${sizeMB} MB freed`);
      }
    }
  } catch (err) {
    // Non-critical error - just log it
    debug('warn', 'Failed to clean updater cache:', err.message);
  }
}

module.exports = {
  initialize,
  setWindows,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  getState,
  cleanupUpdaterCache,
  autoUpdater
};
