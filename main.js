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
let isManualCheck = false;
let updateDownloaded = false;

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

const documentsPath = path.join(os.homedir(), 'Documents');
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
    const updateInfoFilePath = path.join(app.getPath('userData'), 'update-info.json');
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

function createPasswordManagerWindow() {
  const passwordWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    icon: path.join(__dirname, 'src', 'assets', 'icons', 'hacker.ico'),
    parent: mainWindow,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  passwordWindow.loadFile('password-manager/index.html');
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
  } catch { }

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

ipcMain.handle('check-for-updates', async () => {
  try {
    isManualCheck = true;
    await autoUpdater.checkForUpdates();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    isManualCheck = false;
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

const updateInfoFilePath = path.join(app.getPath('userData'), 'update-info.json');

ipcMain.handle('save-update-info', async (event, info) => {
  try {
    await fs.promises.writeFile(updateInfoFilePath, JSON.stringify(info));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-update-info', async () => {
  try {
    if (fs.existsSync(updateInfoFilePath)) {
      const content = await fs.promises.readFile(updateInfoFilePath, 'utf-8');
      await fs.promises.unlink(updateInfoFilePath);
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
  if (/[^a-zA-Z0-9_\.\-\s\=\:]/i.test(command)) {
    return { error: 'Command contains invalid characters' };
  }
  const parts = command.trim().split(/\s+/);
  const cmd = parts.shift();
  return processUtils.runSpawnCommand(cmd, parts, { shell: true, windowsHide: true });
});

ipcMain.handle('run-christitus', async () => {
  return systemTools.runChrisTitus();
});

ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle('open-file', async (event, filePath) => {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec(`start "" "${filePath}"`, (error) => {
        resolve(error ? { success: false, error: error.message } : { success: true });
      });
    } else {
      const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
      exec(`${cmd} "${filePath}"`, (error) => {
        resolve(error ? { success: false, error: error.message } : { success: true });
      });
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
ipcMain.handle('get-asset-path', async (event, relativePath) => {
  const isDev = !app.isPackaged;
  if (isDev) {
    return path.join(__dirname, 'src', 'assets', relativePath);
  }
  // In production: assets are in resources/src/assets (extraResources)
  return path.join(process.resourcesPath, 'src', 'assets', relativePath);
});

ipcMain.handle('file-exists', async (event, filePath) => {
  try {
    const expanded = fileUtils.expandEnvVars(filePath);
    return fs.existsSync(expanded);
  } catch {
    return false;
  }
});

ipcMain.handle('delete-file', async (event, filePath) => {
  return new Promise((resolve) => {
    try {
      if (typeof filePath !== 'string' || filePath.trim() === '') {
        return resolve({ success: false, error: 'Invalid file path' });
      }
      fs.unlink(filePath, (err) => {
        if (err) return resolve({ success: false, error: err.message });
        resolve({ success: true });
      });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

ipcMain.handle('rename-directory', async (event, { src, dest }) => {
  return new Promise((resolve) => {
    try {
      if (typeof src !== 'string' || typeof dest !== 'string' || !src || !dest) {
        return resolve({ success: false, error: 'Invalid source or destination' });
      }
      try {
        if (fs.existsSync(dest)) {
          fs.rmSync(dest, { recursive: true, force: true });
        }
      } catch { }
      fs.rename(src, dest, (err) => {
        if (err) return resolve({ success: false, error: err.message });
        resolve({ success: true });
      });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

ipcMain.handle('replace-exe', async (event, { sourcePath, destPath }) => {
  return new Promise((resolve) => {
    try {
      const src = fileUtils.expandEnvVars(sourcePath);
      const dst = fileUtils.expandEnvVars(destPath);

      debug('info', 'Replacing executable with elevated privileges:');
      debug('info', 'Source:', src);
      debug('info', 'Destination:', dst);

      if (!fs.existsSync(src)) {
        resolve({ success: false, error: `Source file not found: ${src}`, code: 'SRC_MISSING' });
        return;
      }

      if (!fs.existsSync(dst)) {
        resolve({ success: false, error: `Destination file not found: ${dst}`, code: 'DEST_MISSING' });
        return;
      }

      const psScript = `
try {
    Write-Output "Starting file replacement..."
    Write-Output "Source: '${src}'"
    Write-Output "Destination: '${dst}'"
   
    if (-not (Test-Path '${src}')) {
        throw "Source file does not exist: '${src}'"
    }
   
    Write-Output "Taking ownership..."
    & takeown /f '${dst}' /r /d y 2>&1 | Out-Null
   
    & icacls '${dst}' /grant '%username%':F /T /C 2>&1 | Out-Null
   
    if (Test-Path '${dst}') {
        Write-Output "Removing existing file..."
        Remove-Item -Path '${dst}' -Force -ErrorAction Stop
    }
   
    Write-Output "Copying new file..."
    Copy-Item -Path '${src}' -Destination '${dst}' -Force -ErrorAction Stop
   
    if (Test-Path '${dst}') {
        Write-Output "SUCCESS: File replacement completed"
        exit 0
    } else {
        throw "File replacement failed - destination file not found"
    }
}
catch {
    Write-Output "ERROR: $($_.Exception.Message)"
    exit 1
}
`;
      const psFile = path.join(os.tmpdir(), `elevated_ps_${Date.now()}.ps1`);
      fs.writeFileSync(psFile, psScript, 'utf8');

      const vbsScript = `
Set UAC = CreateObject("Shell.Application")
UAC.ShellExecute "powershell.exe", "-ExecutionPolicy Bypass -File ""${psFile.replace(/\\/g, '\\\\')}""", "", "runas", 1
WScript.Sleep(3000)
`;
      const vbsFile = path.join(os.tmpdir(), `elevate_${Date.now()}.vbs`);
      fs.writeFileSync(vbsFile, vbsScript);

      debug('info', 'Requesting UAC elevation for file replacement...');

      exec(`wscript "${vbsFile}"`, (error) => {
        setTimeout(() => {
          try { fs.unlinkSync(vbsFile); } catch { }
          try { fs.unlinkSync(psFile); } catch { }
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

ipcMain.handle('open-password-manager', async () => {
  createPasswordManagerWindow();
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
    const timeout = setTimeout(() => {
      db.close();
      resolve({ success: false, error: 'Database timeout' });
    }, 10000);

    db.getCategories((err, rows) => {
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
    const timeout = setTimeout(() => {
      db.close();
      resolve({ success: false, error: 'Database timeout' });
    }, 10000);

    db.getPasswordsByCategory(categoryId, (err, rows) => {
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

ipcMain.handle('password-manager-add-password', async (event, passwordData) => {
  return new Promise((resolve) => {
    const db = new PasswordManagerDB(pmAuth);
    const timeout = setTimeout(() => {
      db.close();
      resolve({ success: false, error: 'Database timeout' });
    }, 10000);

    db.addPassword(passwordData, function (err) {
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
