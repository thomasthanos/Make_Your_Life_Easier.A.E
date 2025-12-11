/**
 * Make Your Life Easier - Main Process
 * Refactored version using modular architecture
 */

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const fs = require('fs');

// Import modules
const { debug } = require('./src/modules/debug');
const fileUtils = require('./src/modules/file-utils');
const processUtils = require('./src/modules/process-utils');
const httpUtils = require('./src/modules/http-utils');
const downloadManager = require('./src/modules/download-manager');
const userProfile = require('./src/modules/user-profile');
const oauth = require('./src/modules/oauth');
const systemTools = require('./src/modules/system-tools');
const spicetifyModule = require('./src/modules/spicetify');
const archiveUtils = require('./src/modules/archive-utils');
const sparkleModule = require('./src/modules/sparkle');
const security = require('./src/modules/security');

// Auto-updater
const { autoUpdater } = require('electron-updater');

// Password Manager
const PasswordManagerAuth = require('./password-manager/auth');
const PasswordManagerDB = require('./password-manager/database');

// ============================================================================
// Configuration
// ============================================================================

// Determine whether the updater should be bypassed
const skipUpdater = Boolean(process.env.ELECTRON_NO_UPDATER) ||
  Boolean(process.env.BYPASS_UPDATER) ||
  process.argv.includes('--no-updater');

// App command line switches
app.commandLine.appendSwitch('enable-features', 'WebContentsForceDark');
app.commandLine.appendSwitch('disable-http2');

// ============================================================================
// Auto-Updater Configuration
// ============================================================================

autoUpdater.autoDownload = true;
autoUpdater.requestHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
};
autoUpdater.autoInstallOnAppQuit = false;

let updateAvailable = false;
let pendingUpdateInfo = null;
let updateDownloaded = false;

// Persist update metadata in two places:
// 1) temp: survives app update cycle even if userData is wiped by NSIS.
// 2) userData: survives temp cleanup and keeps backward compatibility.
// Persist update metadata in durable locations (no temp):
// 1) userData (per-user, survives temp cleanup)
// 2) ProgramData on Windows (machine-wide fallback, survives uninstall in most cases)
const updateInfoPrimaryPath = path.join(app.getPath('userData'), 'update-info.json');
const updateInfoSecondaryPath = process.platform === 'win32'
  ? path.join(process.env.PROGRAMDATA || path.join('C:\\', 'ProgramData'), 'MakeYourLifeEasier', 'update-info.json')
  : null;

// ❌ ΔΙΑΓΡΑΦΗ: Αφαίρεσε αυτή τη γραμμή
// let currentManualCheckId = null;

// ============================================================================
// Updater Cache Cleanup
// ============================================================================

/**
 * Clean up the updater cache directory
 * Removes downloaded installers and temp files after successful update
 */
function cleanupUpdaterCache() {
  try {
    // electron-updater stores cache in Local AppData, not Roaming
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const updaterCachePath = path.join(localAppData, 'make-your-life-easier-updater');

    if (fs.existsSync(updaterCachePath)) {
      const files = fs.readdirSync(updaterCachePath);
      let cleanedSize = 0;

      for (const file of files) {
        const filePath = path.join(updaterCachePath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
          debug('info', `Cleaned updater cache directory: ${file}`);
        } else {
          cleanedSize += stat.size;
          fs.unlinkSync(filePath);
          debug('info', `Cleaned updater cache file: ${file}`);
        }
      }

      if (cleanedSize > 0) {
        const sizeMB = (cleanedSize / (1024 * 1024)).toFixed(2);
        debug('success', `Updater cache cleaned: ${sizeMB} MB freed`);
      }

      // Remove the empty directory itself
      try {
        fs.rmdirSync(updaterCachePath);
      } catch (e) {
        // Directory might not be empty or other error, ignore
      }
    }
  } catch (err) {
    debug('warn', 'Failed to clean updater cache:', err.message);
  }
}

// ============================================================================
// Window References
// ============================================================================

let mainWindow = null;
let updateWindow = null;

// ============================================================================
// Password Manager Setup
// ============================================================================

/**
 * Get the correct Documents path, checking for OneDrive first
 */
function getDocumentsPath() {
  const homedir = os.homedir();

  // Check OneDrive paths first
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

  // Fallback to regular Documents
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

// ============================================================================
// Auto-Updater Events
// ============================================================================

autoUpdater.on('checking-for-update', () => {
  debug('info', 'Checking for updates...');
  if (updateWindow) {
    updateWindow.webContents.send('update-status', { status: 'checking', message: 'Checking for updates...' });
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

    if (!mainWindow) {
      createMainWindow(false);
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
  }
  // ❌ ΔΙΑΓΡΑΦΗ: Αφαίρεσε τον έλεγχο για manual check εδώ
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
    fs.writeFileSync(updateInfoFilePath, JSON.stringify(updateInfoToSave));
  } catch (err) {
    debug('warn', 'Failed to persist update info:', err);
  }

  // Note: Updater cache cleanup is handled by cleanupUpdaterCache() on app startup

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
      createMainWindow();
    }, 800);
    return;
  }

  const payload = { status: 'error', message: `Update error: ${err.message}` };
  if (updateWindow) updateWindow.webContents.send('update-status', payload);
  if (mainWindow) mainWindow.webContents.send('update-status', payload);
});

// ============================================================================
// Window Creation
// ============================================================================

function createMainWindow(showWindow = true) {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    icon: path.join(__dirname, 'src', 'assets', 'icons', 'hacker.ico'),
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    frame: false,
    show: showWindow,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');
  setupWindowStateEvents();
}

function createUpdateWindow() {
  updateWindow = new BrowserWindow({
    width: 500,
    height: 350,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    frame: false,
    show: true,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  updateWindow.setMenuBarVisibility(false);
  updateWindow.loadFile(path.join('updater', 'update.html'));

  updateWindow.on('closed', () => {
    updateWindow = null;
  });

  autoUpdater.checkForUpdates().catch((err) => {
    debug('error', err);
  });
}

function createPasswordManagerWindow(lang = 'en') {
  const passwordWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    icon: path.join(__dirname, 'src', 'assets', 'icons', 'hacker.ico'),
    parent: mainWindow,
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  passwordWindow.loadFile('password-manager/index.html', { query: { lang } });
  passwordWindow.setMenuBarVisibility(false);
}

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

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(() => {
  // Clean up any leftover update files from previous updates
  cleanupUpdaterCache();

  // Initialize user profile
  try {
    userProfile.initialize(app.getPath('userData'));
  } catch (err) {
    debug('warn', 'Failed to initialize user profile:', err.message);
  }

  if (skipUpdater) {
    createMainWindow();
  } else {
    createUpdateWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (skipUpdater) {
        createMainWindow();
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
});

// ============================================================================
// IPC Handlers - Window Controls
// ============================================================================

ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('password-window-close', (event) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender);
  if (senderWin && senderWin !== mainWindow) {
    senderWin.close();
  }
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle('window-set-size', (event, size) => {
  try {
    if (mainWindow && size && typeof size.width !== 'undefined' && typeof size.height !== 'undefined') {
      const w = parseInt(size.width, 10);
      const h = parseInt(size.height, 10);
      if (!Number.isNaN(w) && !Number.isNaN(h)) {
        mainWindow.setSize(w, h);
        return true;
      }
    }
  } catch { }
  return false;
});

ipcMain.handle('window-get-size', () => {
  try {
    if (mainWindow) return mainWindow.getSize();
  } catch { }
  return [0, 0];
});

ipcMain.handle('window-set-bounds-animate', (event, size) => {
  try {
    if (mainWindow && size && typeof size.width !== 'undefined') {
      const bounds = mainWindow.getBounds();
      const newWidth = parseInt(size.width, 10);
      const newHeight = typeof size.height !== 'undefined' ? parseInt(size.height, 10) : bounds.height;
      if (!Number.isNaN(newWidth) && (typeof size.height === 'undefined' || !Number.isNaN(newHeight))) {
        mainWindow.setBounds({ x: bounds.x, y: bounds.y, width: newWidth, height: newHeight }, true);
        return true;
      }
    }
  } catch { }
  return false;
});

ipcMain.handle('window-animate-resize', (event, { width, height, duration = 200 }) => {
  return new Promise((resolve) => {
    try {
      if (!mainWindow || typeof width === 'undefined' || typeof height === 'undefined') {
        return resolve(false);
      }
      const wTarget = parseInt(width, 10);
      const hTarget = parseInt(height, 10);
      if (Number.isNaN(wTarget) || Number.isNaN(hTarget)) {
        return resolve(false);
      }
      const [startW, startH] = mainWindow.getSize();
      const steps = 15;
      const stepDelay = Math.max(10, duration / steps);
      const deltaW = (wTarget - startW) / steps;
      const deltaH = (hTarget - startH) / steps;
      let i = 0;

      const animateStep = () => {
        i += 1;
        const newW = Math.round(startW + deltaW * i);
        const newH = Math.round(startH + deltaH * i);
        try {
          mainWindow.setSize(newW, newH);
        } catch {
          return resolve(false);
        }
        if (i < steps) {
          setTimeout(animateStep, stepDelay);
        } else {
          resolve(true);
        }
      };
      animateStep();
    } catch {
      resolve(false);
    }
  });
});

// ============================================================================
// IPC Handlers - Auto-Updater
// ============================================================================

// ✅ Απλοποιημένος handler - απλά κάνει check, χωρίς complex logic
ipcMain.handle('check-for-updates', async () => {
  try {
    await autoUpdater.checkForUpdates();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-update', async () => {
  if (updateDownloaded) {
    autoUpdater.quitAndInstall(true, true);
    return { success: true };
  }
  return { success: false, error: 'No update downloaded' };
});

ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
});

ipcMain.handle('save-update-info', async (event, info) => {
  try {
    const payload = JSON.stringify(info);
    // Write to both locations; ignore secondary errors so at least one persists.
    await fs.promises.writeFile(updateInfoPrimaryPath, payload);
    if (updateInfoSecondaryPath) {
      try {
        fs.mkdirSync(path.dirname(updateInfoSecondaryPath), { recursive: true });
        await fs.promises.writeFile(updateInfoSecondaryPath, payload);
      } catch (secondaryErr) {
        debug('warn', 'Failed to persist update info to ProgramData (secondary):', secondaryErr.message);
      }
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-update-info', async () => {
  try {
    const pathToRead = fs.existsSync(updateInfoPrimaryPath)
      ? updateInfoPrimaryPath
      : (updateInfoSecondaryPath && fs.existsSync(updateInfoSecondaryPath)
        ? updateInfoSecondaryPath
        : null);

    if (pathToRead) {
      const content = await fs.promises.readFile(pathToRead, 'utf-8');
      try {
        await fs.promises.unlink(pathToRead);
      } catch { /* ignore cleanup errors */ }

      // Ensure both copies are removed so the changelog is not shown repeatedly.
      try { if (fs.existsSync(updateInfoPrimaryPath)) await fs.promises.unlink(updateInfoPrimaryPath); } catch { }
      try { if (fs.existsSync(updateInfoSecondaryPath)) await fs.promises.unlink(updateInfoSecondaryPath); } catch { }

      return { success: true, info: JSON.parse(content) };
    }

    return { success: false, error: 'No update info' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================================
// IPC Handlers - System Info
// ============================================================================

ipcMain.handle('get-system-info', async () => {
  return {
    platform: os.platform(),
    release: os.release(),
    type: os.type(),
    arch: os.arch(),
    totalmem: os.totalmem(),
    freemem: os.freemem(),
    cpus: os.cpus().map(c => ({ model: c.model, speed: c.speed })),
    hostname: os.hostname(),
    user: os.userInfo(),
    homedir: os.homedir()
  };
});

// ============================================================================
// IPC Handlers - OAuth / User Profile
// ============================================================================

ipcMain.handle('login-google', async () => {
  const result = await oauth.loginGoogle(mainWindow);
  if (result) {
    userProfile.set(result);
  }
  return result;
});

ipcMain.handle('login-discord', async () => {
  const result = await oauth.loginDiscord(mainWindow);
  if (result) {
    userProfile.set(result);
  }
  return result;
});

ipcMain.handle('get-user-profile', async () => {
  return userProfile.get();
});

ipcMain.handle('logout', async () => {
  userProfile.clear();
  return { success: true };
});

// ============================================================================
// IPC Handlers - Commands & External
// ============================================================================

ipcMain.handle('run-command', async (event, command) => {
  if (typeof command !== 'string' || !command.trim()) {
    return { error: 'Invalid command' };
  }

  // Whitelist of allowed commands (for security)
  const allowedCommands = ['winget'];
  const parts = command.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();

  if (!allowedCommands.includes(cmd)) {
    return { error: `Command '${cmd}' is not allowed. Only winget is permitted.` };
  }

  // Validate command arguments using security module
  const args = parts.slice(1); // Get arguments (everything after command)
  const argsValidation = security.validateCommandArgs(args);
  if (!argsValidation.valid) {
    return { error: argsValidation.error };
  }

  // Additional validation: check for path traversal in arguments
  for (const arg of args) {
    if (arg.includes('..')) {
      return { error: 'Path traversal detected in command arguments' };
    }
  }

  // Use shell: false for better security (spawn directly)
  // This prevents shell injection attacks
  return processUtils.runSpawnCommand(parts[0], args, { shell: false, windowsHide: true });
});

ipcMain.handle('run-christitus', async () => {
  return systemTools.runChrisTitus();
});

ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle('open-file', async (event, filePath) => {
  return new Promise(async (resolve) => {
    try {
      if (typeof filePath !== 'string' || !filePath.trim()) {
        return resolve({ success: false, error: 'Invalid file path' });
      }

      const expanded = fileUtils.expandEnvVars(filePath);

      // Validate path
      const validation = security.validatePath(expanded);
      if (!validation.valid) {
        return resolve({ success: false, error: validation.error });
      }

      const normalized = validation.normalized;

      // Verify file exists
      if (!fs.existsSync(normalized)) {
        return resolve({ success: false, error: 'File does not exist' });
      }

      // Use shell.openPath which is safer than exec with string concatenation
      if (process.platform === 'win32') {
        // For Windows, use shell.openPath which handles paths safely
        shell.openPath(normalized)
          .then((errStr) => {
            if (errStr) {
              resolve({ success: false, error: errStr });
            } else {
              resolve({ success: true });
            }
          })
          .catch((err) => {
            resolve({ success: false, error: err.message });
          });
      } else {
        const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
        // Use spawn instead of exec to avoid shell injection
        const child = spawn(cmd, [normalized], { detached: true, stdio: 'ignore' });
        child.on('error', (err) => {
          resolve({ success: false, error: err.message });
        });
        child.unref();
        resolve({ success: true });
      }
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

ipcMain.handle('open-installer', async (event, filePath) => {
  await shell.openPath(filePath);
  return { success: true };
});

ipcMain.handle('show-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Executables', extensions: ['exe'] }]
  });
  return result;
});

// ============================================================================
// IPC Handlers - Downloads
// ============================================================================

ipcMain.on('download-start', (event, { id, url, dest }) => {
  downloadManager.startDownload(id, url, dest, mainWindow);
});

ipcMain.on('download-pause', (event, id) => {
  downloadManager.pauseDownload(id, mainWindow);
});

ipcMain.on('download-resume', (event, id) => {
  downloadManager.resumeDownload(id, mainWindow);
});

ipcMain.on('download-cancel', (event, id) => {
  downloadManager.cancelDownload(id, mainWindow);
});

// ============================================================================
// IPC Handlers - File Operations
// ============================================================================

// Get asset path for images and other assets (works in both dev and production)
// Returns file:// URL for use in <img> tags
ipcMain.handle('get-asset-path', async (event, relativePath) => {
  const isDev = !app.isPackaged;
  let assetPath;
  if (isDev) {
    assetPath = path.join(__dirname, 'src', 'assets', relativePath);
  } else {
    // In production: assets are in resources/src/assets (extraResources)
    assetPath = path.join(process.resourcesPath, 'src', 'assets', relativePath);
  }
  // Convert to file:// URL for use in renderer
  // Windows needs file:/// (3 slashes), Unix needs file:// (2 slashes)
  const normalizedPath = assetPath.replace(/\\/g, '/');
  if (process.platform === 'win32' && normalizedPath.match(/^[A-Za-z]:/)) {
    return `file:///${normalizedPath}`;
  }
  return `file://${normalizedPath}`;
});

ipcMain.handle('file-exists', async (event, filePath) => {
  try {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      return false;
    }

    const expanded = fileUtils.expandEnvVars(filePath);

    // Validate path before checking existence
    const validation = security.validatePath(expanded);
    if (!validation.valid) {
      return false;
    }

    return fs.existsSync(validation.normalized);
  } catch {
    return false;
  }
});

ipcMain.handle('delete-file', async (event, filePath) => {
  return new Promise(async (resolve) => {
    try {
      if (typeof filePath !== 'string' || filePath.trim() === '') {
        return resolve({ success: false, error: 'Invalid file path' });
      }

      // Expand environment variables
      const expanded = fileUtils.expandEnvVars(filePath);

      // Validate path with security module - use delete-specific validation
      // Allow deletion in temp, downloads, and user directories
      const allowedDirs = [
        os.tmpdir(),
        path.join(os.homedir(), 'Downloads'),
        os.homedir()
      ];

      const validation = security.validateDeletePath(expanded, allowedDirs);
      if (!validation.valid) {
        return resolve({ success: false, error: validation.error, code: 'VALIDATION_FAILED' });
      }

      const normalizedPath = validation.normalized;

      // Additional check: ensure file exists and is actually a file (not directory)
      try {
        const stats = fs.statSync(normalizedPath);
        if (stats.isDirectory()) {
          return resolve({ success: false, error: 'Cannot delete directory. Use rename-directory for directories.', code: 'IS_DIRECTORY' });
        }
      } catch (statErr) {
        if (statErr.code === 'ENOENT') {
          return resolve({ success: false, error: 'File does not exist', code: 'FILE_NOT_FOUND' });
        }
        return resolve({ success: false, error: `Cannot access file: ${statErr.message}`, code: 'ACCESS_ERROR' });
      }

      // Perform deletion
      fs.unlink(normalizedPath, (err) => {
        if (err) {
          return resolve({ success: false, error: err.message, code: 'DELETE_FAILED' });
        }
        resolve({ success: true });
      });
    } catch (err) {
      resolve({ success: false, error: err.message, code: 'EXCEPTION' });
    }
  });
});

ipcMain.handle('rename-directory', async (event, { src, dest }) => {
  return new Promise(async (resolve) => {
    try {
      if (typeof src !== 'string' || typeof dest !== 'string' || !src || !dest) {
        return resolve({ success: false, error: 'Invalid source or destination' });
      }

      // Expand environment variables
      const srcExpanded = fileUtils.expandEnvVars(src);
      const destExpanded = fileUtils.expandEnvVars(dest);

      // Validate both paths
      const srcValidation = security.validatePath(srcExpanded);
      if (!srcValidation.valid) {
        return resolve({ success: false, error: `Invalid source path: ${srcValidation.error}`, code: 'INVALID_SOURCE' });
      }

      const destValidation = security.validatePath(destExpanded);
      if (!destValidation.valid) {
        return resolve({ success: false, error: `Invalid destination path: ${destValidation.error}`, code: 'INVALID_DEST' });
      }

      const srcNormalized = srcValidation.normalized;
      const destNormalized = destValidation.normalized;

      // Verify source exists and is a directory
      try {
        const srcStats = fs.statSync(srcNormalized);
        if (!srcStats.isDirectory()) {
          return resolve({ success: false, error: 'Source is not a directory', code: 'NOT_DIRECTORY' });
        }
      } catch (statErr) {
        if (statErr.code === 'ENOENT') {
          return resolve({ success: false, error: 'Source directory does not exist', code: 'SRC_NOT_FOUND' });
        }
        return resolve({ success: false, error: `Cannot access source: ${statErr.message}`, code: 'SRC_ACCESS_ERROR' });
      }

      // Remove destination if it exists (only if it's a directory)
      try {
        if (fs.existsSync(destNormalized)) {
          const destStats = fs.statSync(destNormalized);
          if (destStats.isDirectory()) {
            fs.rmSync(destNormalized, { recursive: true, force: true });
          } else {
            return resolve({ success: false, error: 'Destination exists and is not a directory', code: 'DEST_EXISTS' });
          }
        }
      } catch (rmErr) {
        // If we can't remove, continue - rename might still work
        debug('warn', 'Could not remove existing destination:', rmErr.message);
      }

      // Perform rename
      fs.rename(srcNormalized, destNormalized, (err) => {
        if (err) {
          return resolve({ success: false, error: err.message, code: 'RENAME_FAILED' });
        }
        resolve({ success: true });
      });
    } catch (err) {
      resolve({ success: false, error: err.message, code: 'EXCEPTION' });
    }
  });
});

ipcMain.handle('replace-exe', async (event, { sourcePath, destPath }) => {
  return new Promise(async (resolve) => {
    try {
      // Expand environment variables first
      const srcExpanded = fileUtils.expandEnvVars(sourcePath);
      const dstExpanded = fileUtils.expandEnvVars(destPath);

      // Validate and normalize paths using security module
      const srcValidation = security.validatePath(srcExpanded);
      if (!srcValidation.valid) {
        resolve({ success: false, error: srcValidation.error, code: 'INVALID_SOURCE_PATH' });
        return;
      }

      const dstValidation = security.validatePath(dstExpanded);
      if (!dstValidation.valid) {
        resolve({ success: false, error: dstValidation.error, code: 'INVALID_DEST_PATH' });
        return;
      }

      const src = srcValidation.normalized;
      const dst = dstValidation.normalized;

      debug('info', 'Replacing executable with elevated privileges:');
      debug('info', 'Source:', src);
      debug('info', 'Destination:', dst);

      // Verify files exist
      const srcExists = await security.validateFileExists(src);
      if (!srcExists.valid || !srcExists.exists) {
        resolve({ success: false, error: `Source file not found: ${src}`, code: 'SRC_MISSING' });
        return;
      }

      const dstExists = await security.validateFileExists(dst);
      if (!dstExists.valid || !dstExists.exists) {
        resolve({ success: false, error: `Destination file not found: ${dst}`, code: 'DEST_MISSING' });
        return;
      }

      // Sanitize paths for PowerShell (properly escaped)
      const srcSanitized = security.sanitizePathForPowerShell(src);
      const dstSanitized = security.sanitizePathForPowerShell(dst);

      if (!srcSanitized.valid || !dstSanitized.valid) {
        resolve({ success: false, error: 'Failed to sanitize paths for PowerShell', code: 'SANITIZATION_FAILED' });
        return;
      }

      // Use JSON file to pass parameters - much safer than command-line arguments
      // This completely prevents injection attacks
      const configFile = path.join(os.tmpdir(), `replace_exe_config_${Date.now()}.json`);
      const config = {
        sourcePath: src,
        destPath: dst
      };
      fs.writeFileSync(configFile, JSON.stringify(config), 'utf8');

      // PowerShell script reads from JSON file - no string interpolation
      const psScript = `
$configPath = '${configFile.replace(/\\/g, '\\\\')}'
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$sourcePath = $config.sourcePath
$destPath = $config.destPath

try {
    Write-Output "Starting file replacement..."
    Write-Output "Source: $sourcePath"
    Write-Output "Destination: $destPath"
   
    # Validate paths exist (defense in depth)
    if (-not (Test-Path -LiteralPath $sourcePath)) {
        throw "Source file does not exist: $sourcePath"
    }
    
    if (-not (Test-Path -LiteralPath $destPath)) {
        throw "Destination file does not exist: $destPath"
    }
   
    Write-Output "Taking ownership..."
    & takeown /f $destPath /r /d y 2>&1 | Out-Null
   
    $username = $env:USERNAME
    & icacls $destPath /grant "${username}:F" /T /C 2>&1 | Out-Null
   
    if (Test-Path -LiteralPath $destPath) {
        Write-Output "Removing existing file..."
        Remove-Item -LiteralPath $destPath -Force -ErrorAction Stop
    }
   
    Write-Output "Copying new file..."
    Copy-Item -LiteralPath $sourcePath -Destination $destPath -Force -ErrorAction Stop
   
    if (Test-Path -LiteralPath $destPath) {
        Write-Output "SUCCESS: File replacement completed"
        # Cleanup config file
        Remove-Item -LiteralPath $configPath -Force -ErrorAction SilentlyContinue
        exit 0
    } else {
        throw "File replacement failed - destination file not found"
    }
}
catch {
    Write-Output "ERROR: $($_.Exception.Message)"
    # Cleanup config file on error
    Remove-Item -LiteralPath $configPath -Force -ErrorAction SilentlyContinue
    exit 1
}
`;

      // Write the script to a temporary file
      const psFile = path.join(os.tmpdir(), `elevated_ps_${Date.now()}.ps1`);
      fs.writeFileSync(psFile, psScript, 'utf8');

      // VBS script only needs to pass the script file - no user input
      const escapedPsFile = psFile.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const vbsScript = `
Set UAC = CreateObject("Shell.Application")
UAC.ShellExecute "powershell.exe", "-ExecutionPolicy Bypass -File ""${escapedPsFile}""", "", "runas", 1
WScript.Sleep(3000)
`;
      const vbsFile = path.join(os.tmpdir(), `elevate_${Date.now()}.vbs`);
      fs.writeFileSync(vbsFile, vbsScript);

      debug('info', 'Requesting UAC elevation for file replacement...');

      exec(`wscript "${vbsFile}"`, (error) => {
        setTimeout(() => {
          try { fs.unlinkSync(vbsFile); } catch { }
          try { fs.unlinkSync(psFile); } catch { }
          try { fs.unlinkSync(configFile); } catch { }
        }, 10000);

        if (error) {
          debug('warn', 'User denied UAC or elevation failed:', error);
          resolve({
            success: false,
            error: 'Administrator privileges required. Please accept the UAC prompt.',
            code: 'UAC_DENIED'
          });
        } else {
          debug('success', 'UAC accepted, replacement in progress...');
          let waited = 0;
          const interval = setInterval(() => {
            waited += 1000;
            if (fs.existsSync(dst)) {
              clearInterval(interval);
              resolve({ success: true, message: '✅ File replacement completed successfully!' });
            } else if (waited >= 15000) {
              clearInterval(interval);
              resolve({ success: false, error: 'Replacement may have failed. The destination file was not found.' });
            }
          }, 1000);
        }
      });
    } catch (err) {
      debug('error', 'Replace exception:', err);
      resolve({ success: false, error: `Exception: ${err.message}` });
    }
  });
});

// ============================================================================
// IPC Handlers - Archive Extraction
// ============================================================================

ipcMain.handle('extract-archive', async (event, { filePath, password, destDir }) => {
  return archiveUtils.extractArchive(filePath, password, destDir, downloadManager.trackExtractedDir);
});

// ============================================================================
// IPC Handlers - Sparkle
// ============================================================================

ipcMain.handle('ensure-sparkle', async () => {
  return sparkleModule.ensureSparkle();
});

// ============================================================================
// IPC Handlers - System Tools
// ============================================================================

ipcMain.handle('run-raphi-debloat', async () => {
  return systemTools.runRaphiDebloat();
});

ipcMain.handle('run-sfc-scan', async () => {
  return systemTools.runSfcScan();
});

ipcMain.handle('run-dism-repair', async () => {
  return systemTools.runDismRepair();
});

ipcMain.handle('run-temp-cleanup', async () => {
  return systemTools.runTempCleanup();
});

ipcMain.handle('restart-to-bios', async () => {
  return systemTools.restartToBios();
});

// ============================================================================
// IPC Handlers - Spicetify
// ============================================================================

ipcMain.handle('install-spicetify', async () => {
  return spicetifyModule.installSpicetify();
});

ipcMain.handle('uninstall-spicetify', async () => {
  return spicetifyModule.uninstallSpicetify();
});

ipcMain.handle('full-uninstall-spotify', async () => {
  return spicetifyModule.fullUninstallSpotify();
});

// ============================================================================
// IPC Handlers - Installers
// ============================================================================

ipcMain.handle('find-exe-files', async (event, directoryPath) => {
  return new Promise((resolve) => {
    try {
      if (!fs.existsSync(directoryPath)) {
        resolve([]);
        return;
      }

      const executableFiles = [];

      function searchDirectory(dir) {
        try {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            const fullPath = path.join(dir, item);
            try {
              const stat = fs.statSync(fullPath);
              if (stat.isDirectory()) {
                searchDirectory(fullPath);
              } else if (stat.isFile()) {
                const ext = path.extname(item).toLowerCase();
                if (ext === '.exe' || ext === '.bat') {
                  executableFiles.push(fullPath);
                }
              }
            } catch { continue; }
          }
        } catch { }
      }

      searchDirectory(directoryPath);
      resolve(executableFiles);
    } catch {
      resolve([]);
    }
  });
});

ipcMain.handle('run-msi-installer', async (event, msiPath) => {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ success: false, error: 'MSI installers are only supported on Windows' });
      return;
    }

    const normalized = path.normalize(msiPath);

    try {
      const child = spawn('msiexec', ['/i', normalized], { detached: true, stdio: 'ignore' });
      child.on('error', (spawnErr) => {
        resolve({ success: false, error: spawnErr.message });
      });
      child.unref();
      resolve({ success: true });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

ipcMain.handle('run-installer', async (event, filePath) => {
  return new Promise((resolve) => {
    debug('info', 'Running installer:', filePath);
    const normalized = path.normalize(filePath);
    const ext = path.extname(normalized).toLowerCase();

    try {
      if (!fs.existsSync(normalized)) {
        return resolve({ success: false, error: `File does not exist: ${normalized}` });
      }
    } catch (fsErr) {
      return resolve({ success: false, error: fsErr.message });
    }

    if (process.platform === 'win32') {
      if (ext === '.msi') {
        try {
          const child = spawn('msiexec', ['/i', normalized], { detached: true, stdio: 'ignore' });
          child.on('error', (spawnErr) => {
            resolve({ success: false, error: spawnErr.message });
          });
          child.unref();
          return resolve({ success: true });
        } catch (spawnErr) {
          return resolve({ success: false, error: spawnErr.message });
        }
      }

      shell.openPath(normalized)
        .then((errStr) => {
          if (!errStr) {
            resolve({ success: true });
          } else {
            debug('warn', 'shell.openPath failed:', errStr);
            resolve({ success: false, error: errStr });
          }
        })
        .catch((err) => {
          resolve({ success: false, error: err.message });
        });
    } else {
      shell.openPath(normalized)
        .then((errStr) => {
          if (!errStr) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: errStr });
          }
        })
        .catch((err) => {
          resolve({ success: false, error: err.message });
        });
    }
  });
});

// ============================================================================
// IPC Handlers - Password Manager
// ============================================================================

ipcMain.handle('open-password-manager', async (_event, lang = 'en') => {
  createPasswordManagerWindow(lang);
  return { success: true };
});

ipcMain.handle('password-manager-has-master-password', async () => {
  try {
    debug('info', 'Checking for master password...');
    if (!pmAuth.configPath) {
      debug('info', 'Auth manager not initialized, initializing now...');
      pmAuth.initialize(pmDirectory);
    }
    const result = pmAuth.hasMasterPassword();
    debug('info', 'Master password exists:', result);
    return result;
  } catch (error) {
    debug('error', 'Error checking master password:', error);
    return false;
  }
});

ipcMain.handle('password-manager-create-master-password', async (event, password) => {
  try {
    debug('info', 'Creating master password...');
    if (!pmAuth.configPath) {
      pmAuth.initialize(pmDirectory);
    }
    await pmAuth.createMasterPassword(password);
    return { success: true };
  } catch (error) {
    debug('error', 'Error creating master password:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('password-manager-authenticate', async (event, password) => {
  try {
    debug('info', 'Authenticating...');
    if (!pmAuth.configPath) {
      pmAuth.initialize(pmDirectory);
    }
    await pmAuth.authenticate(password);
    return { success: true };
  } catch (error) {
    debug('error', 'Error authenticating:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('password-manager-logout', async () => {
  pmAuth.logout();
  return { success: true };
});

ipcMain.handle('password-manager-change-password', async (event, currentPassword, newPassword) => {
  try {
    await pmAuth.changeMasterPassword(currentPassword, newPassword);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('password-manager-validate-password', async (event, password) => {
  const result = pmAuth.validatePasswordStrength(password);
  return result;
});

ipcMain.handle('password-manager-get-categories', async () => {
  return new Promise((resolve) => {
    const db = new PasswordManagerDB(pmAuth);
    let finished = false;
    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      db.close();
      resolve({ success: false, error: 'Database timeout' });
    }, 10000);

    db.getCategories((err, rows) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      db.close();
      if (err) {
        debug('error', 'Error getting categories:', err);
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, categories: rows || [] });
      }
    });
  });
});

ipcMain.handle('password-manager-add-category', async (event, name) => {
  return new Promise((resolve) => {
    const db = new PasswordManagerDB(pmAuth);
    db.addCategory(name, function (err) {
      db.close();
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, id: this.lastID });
      }
    });
  });
});

ipcMain.handle('password-manager-update-category', async (event, id, name) => {
  return new Promise((resolve) => {
    const db = new PasswordManagerDB(pmAuth);
    db.updateCategory(id, name, function (err) {
      db.close();
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, changes: this.changes });
      }
    });
  });
});

ipcMain.handle('password-manager-delete-category', async (event, id) => {
  return new Promise((resolve) => {
    const db = new PasswordManagerDB(pmAuth);
    db.deleteCategory(id, function (err) {
      db.close();
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, changes: this.changes });
      }
    });
  });
});

ipcMain.handle('password-manager-get-passwords', async (event, categoryId = 'all') => {
  return new Promise((resolve) => {
    const db = new PasswordManagerDB(pmAuth);
    let finished = false;
    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      db.close();
      resolve({ success: false, error: 'Database timeout' });
    }, 10000);

    db.getPasswordsByCategory(categoryId, (err, rows) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      db.close();
      if (err) {
        debug('error', 'Error getting passwords:', err);
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, passwords: rows || [] });
      }
    });
  });
});

ipcMain.handle('password-manager-get-password', async (event, id) => {
  return new Promise((resolve) => {
    const db = new PasswordManagerDB(pmAuth);
    db.getPasswordById(id, (err, row) => {
      db.close();
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, password: row });
      }
    });
  });
});

ipcMain.handle('password-manager-add-password', async (event, passwordData) => {
  return new Promise((resolve) => {
    const db = new PasswordManagerDB(pmAuth);
    let finished = false;
    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      db.close();
      resolve({ success: false, error: 'Database timeout' });
    }, 10000);

    db.addPassword(passwordData, function (err) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      db.close();
      if (err) {
        debug('error', 'Error adding password:', err);
        resolve({ success: false, error: err.message });
      } else {
        debug('success', 'Password added successfully, ID:', this.lastID);
        resolve({ success: true, id: this.lastID });
      }
    });
  });
});

ipcMain.handle('password-manager-update-password', async (event, id, passwordData) => {
  return new Promise((resolve) => {
    const db = new PasswordManagerDB(pmAuth);
    db.updatePassword(id, passwordData, function (err) {
      db.close();
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, changes: this.changes });
      }
    });
  });
});

ipcMain.handle('password-manager-delete-password', async (event, id) => {
  return new Promise((resolve) => {
    const db = new PasswordManagerDB(pmAuth);
    db.deletePassword(id, function (err) {
      db.close();
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, changes: this.changes });
      }
    });
  });
});

ipcMain.handle('password-manager-search-passwords', async (event, query) => {
  return new Promise((resolve) => {
    const db = new PasswordManagerDB(pmAuth);
    db.searchPasswords(query, (err, rows) => {
      db.close();
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, passwords: rows });
      }
    });
  });
});

ipcMain.handle('password-manager-reset', async () => {
  try {
    if (fs.existsSync(pmAuth.configPath)) {
      fs.unlinkSync(pmAuth.configPath);
    }
    const dbPath = path.join(pmAuth.dbDirectory, 'password_manager.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    pmAuth.logout();
    pmAuth.initialize(pmDirectory);
    return { success: true };
  } catch (error) {
    debug('error', 'Error resetting password manager:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// IPC Handlers - Misc
// ============================================================================

ipcMain.handle('run-activate-script', async () => {
  return { success: true, message: 'Activation script completed' };
});

ipcMain.handle('run-autologin-script', async () => {
  return { success: true, message: 'Autologin script completed' };
});
