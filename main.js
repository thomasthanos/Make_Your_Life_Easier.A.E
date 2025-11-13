const { app, BrowserWindow, BrowserView, ipcMain, shell, nativeTheme } = require('electron');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

const fs = require('fs');

function debug(level, ...args) {
  const emojiMap = { info: 'ℹ️', warn: '⚠️', error: '❌', success: '✅' };
  const colorMap = {
    info: 'color:#2196F3; font-weight:bold;',
    warn: 'color:#FF9800; font-weight:bold;',
    error: 'color:#F44336; font-weight:bold;',
    success: 'color:#4CAF50; font-weight:bold;'
  };
  const emoji = emojiMap[level] || '';
  const style = colorMap[level] || '';
  const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
  const fn =
    level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : console.log;
  if (isBrowser) {
    fn.call(console, `%c${emoji}`, style, ...args);
  } else {
    fn.call(console, `${emoji}`, ...args);
  }
}
const downloadedFiles = [];

const extractedDirs = [];

let Sudoer = null;
try {
  const sudoModule = require('electron-sudo');
  Sudoer = sudoModule.default || sudoModule;
} catch (e) {
  Sudoer = null;
}
let oauthConfig = {};
try {
  const oauthPath = path.join(__dirname, 'oauth_config.json');
  if (fs.existsSync(oauthPath)) {
    const raw = fs.readFileSync(oauthPath, 'utf-8');
    oauthConfig = JSON.parse(raw);
  }
} catch (err) {
  debug('warn', 'Failed to load oauth_config.json:', err);
  oauthConfig = {};
}

ipcMain.handle('run-raphi-debloat', async () => {
  // Only support Windows because the script is Windows specific
  if (process.platform !== 'win32') {
    return { success: false, error: 'Debloat is only supported on Windows.' };
  }

  // Determine the PowerShell executable and construct the script command.
  const psExe = getPowerShellExe() || 'powershell.exe';
  const scriptCmd = '& ([scriptblock]::Create((irm "https://debloat.raphi.re/")))';

  const runViaStartProcess = () => {
    return new Promise((resolve) => {
      // Escape quotes inside the command for the argument list
      const escapedCmd = scriptCmd.replace(/"/g, '\\"');
      const argList = `-NoProfile -ExecutionPolicy Bypass -Command \"${escapedCmd}\"`;
      const psCommand = `Start-Process -FilePath \"${psExe}\" -ArgumentList '${argList}' -Verb RunAs -WindowStyle Normal -Wait`;
      const child = spawn(psExe, ['-Command', psCommand], { windowsHide: false });
      let stderrData = '';
      child.stderr.on('data', (buf) => { stderrData += buf.toString(); });
      child.on('error', (err) => {
        resolve({ success: false, error: 'Failed to launch PowerShell: ' + err.message });
      });
      child.on('exit', (code) => {
        if (code === 0) {
          resolve({ success: true, message: 'Debloat script executed successfully. A restart may be required.' });
        } else {
          const msg = stderrData.trim() || 'Debloat script failed or was cancelled.';
          resolve({ success: false, error: msg });
        }
      });
    });
  };

  return await runViaStartProcess();
});
app.commandLine.appendSwitch('enable-features', 'WebContentsForceDark');

/**
 * Determine the appropriate PowerShell executable to use on Windows.
 * When running under a 32‑bit Electron process on a 64‑bit OS,
 * `powershell.exe` may resolve to the 32‑bit version located in
 * `C:\\Windows\\SysWOW64`.  Many system‑level registry changes (under
 * HKLM) are only visible through the 64‑bit registry view and will be
 * silently redirected or dropped when run via the 32‑bit PowerShell.
 * To ensure debloat tasks reliably modify the correct registry hive,
 * prefer the 64‑bit PowerShell located under
 * `System32\\WindowsPowerShell\\v1.0\\powershell.exe`.  When this
 * executable is unavailable (e.g. on 32‑bit editions of Windows) fall back
 * to the bare `powershell.exe` on the PATH.
 *
 * @returns {string|null} The absolute path to a 64‑bit PowerShell
 *   executable if available, otherwise `powershell.exe`. Returns
 *   `null` on non‑Windows platforms.
 */
function getPowerShellExe() {
  if (process.platform !== 'win32') return null;
  try {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows';
    const pwsh64 = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    if (fs.existsSync(pwsh64)) {
      return pwsh64;
    }
  } catch (err) {
    // Ignore fs errors and fall back to default
  }
  return 'powershell.exe';
}


const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '389774067739-qnshev3gbck4firdc787iqhd44omiajs.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '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';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5252';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1329887230482845797';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'ZPK2i6WmbGnBhv7LmyzLwTOoKbaH8nDV';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5252';

let userProfile = null;

const getUserProfilePath = () => {
  const p = app.getPath('userData');
  return path.join(p, 'userProfile.json');
};

function loadUserProfile() {
  try {
    const filePath = getUserProfilePath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      userProfile = JSON.parse(data);
    }
  } catch (err) {
    debug('warn', 'Failed to load saved user profile:', err);
    userProfile = null;
  }
}

function saveUserProfile() {
  try {
    const filePath = getUserProfilePath();
    if (userProfile) {
      fs.writeFileSync(filePath, JSON.stringify(userProfile, null, 2));
    } else {
      // remove any existing file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (err) {
    debug('warn', 'Failed to save user profile:', err);
  }
}

function postForm(url, params) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(params).toString();
    const parsed = new URL(url);
    const https = require(parsed.protocol.replace(':', ''));
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(json.error_description || json.error || body));
          }
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

function getJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const https = require(parsed.protocol.replace(':', ''));
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      method: 'GET',
      headers
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(json.error || body));
          }
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', (err) => reject(err));
    req.end();
  });
}

function openAuthWindow(authUrl, redirectUri, handleCallback) {
  return new Promise((resolve, reject) => {
    const isGoogle = typeof authUrl === 'string' && (authUrl.includes('accounts.google.com') || authUrl.includes('google.com/oauth'));
    const windowOpts = {
      width: 600,
      height: 700,
      show: true,
      parent: mainWindow,
      modal: true,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    };
    const authWindow = new BrowserWindow(windowOpts);

    const loaderView = new BrowserView({
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    const loaderHtml = `
      <!DOCTYPE html>
      <html><head><meta charset="utf-8">
      <style>
        html, body { margin:0; padding:0; height:100%; background:rgba(255,255,255,0.8); display:flex; align-items:center; justify-content:center; }
        .spinner { width:40px; height:40px; border:4px solid rgba(0,0,0,0.2); border-top-color:rgba(0,0,0,0.7); border-radius:50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform:rotate(0deg); } 100% { transform:rotate(360deg); } }
      </style></head>
      <body><div class="spinner"></div></body></html>`;
    loaderView.webContents.loadURL('data:text/html;base64,' + Buffer.from(loaderHtml).toString('base64'));
    authWindow.setBrowserView(loaderView);
    loaderView.setBounds({ x: 0, y: 0, width: windowOpts.width, height: windowOpts.height });
    loaderView.setAutoResize({ width: true, height: true });
    const removeLoaderView = () => {
      try {
        if (!authWindow.isDestroyed() && authWindow.getBrowserView() === loaderView) {
          authWindow.setBrowserView(null);
          loaderView.destroy();
        }
      } catch (_) { }
    };
    authWindow.webContents.once('did-finish-load', removeLoaderView);
    authWindow.once('closed', removeLoaderView);

    const cleanup = () => {
      if (!authWindow.isDestroyed()) authWindow.close();
    };

    function handleUrl(url) {
      try {
        const target = new URL(url);
        if (url.startsWith(redirectUri)) {
          handleCallback(target)
            .then((result) => {
              cleanup();
              resolve(result);
            })
            .catch((err) => {
              cleanup();
              reject(err);
            });
        }
      } catch (e) {
        // ignore malformed URLs
      }
    }

    // Έλεγχος αν είναι Google OAuth
    function isGoogleOAuth(url) {
      return url.includes('accounts.google.com') || url.includes('google.com/oauth');
    }

    // Εφαρμογή dark mode ΜΟΝΟ για Google
    function applyDarkModeIfGoogle() {
      return;
    }

    // Εφαρμογή dark mode κατά τη φόρτωση
    authWindow.webContents.once('did-finish-load', () => {
      applyDarkModeIfGoogle();
    });

    // Εφαρμογή dark mode σε κάθε navigation (για διαφορετικές Google σελίδες)
    authWindow.webContents.on('did-navigate', () => {
      setTimeout(() => {
        applyDarkModeIfGoogle();
      }, 100);
    });

    // Εφαρμογή dark mode σε frame φορτώσεις
    authWindow.webContents.on('frame-loaded', () => {
      setTimeout(() => {
        applyDarkModeIfGoogle();
      }, 50);
    });

    authWindow.webContents.on('will-redirect', (event, url) => {
      handleUrl(url);
    });

    authWindow.webContents.on('will-navigate', (event, url) => {
      handleUrl(url);
    });

    authWindow.webContents.on('did-navigate', (event, url) => {
      handleUrl(url);
    });

    const applyDiscordAccessibilityFix = () => {
      try {
        const current = authWindow.webContents.getURL() || '';
        if (current.includes('discord.com')) {
          authWindow.webContents.insertCSS(`
            input, textarea {
              color: #dcddde !important;
              background-color: #2f3136 !important;
              caret-color: #dcddde !important;
            }
            input::placeholder, textarea::placeholder {
              color: #b9bbbe !important;
            }
          `);
        }
      } catch (_) { }
    };
    authWindow.webContents.on('did-finish-load', applyDiscordAccessibilityFix);
    authWindow.webContents.on('did-navigate', applyDiscordAccessibilityFix);
    authWindow.webContents.on('frame-loaded', applyDiscordAccessibilityFix);

    authWindow.on('closed', () => {
      try {
        resolve(null);
      } catch (e) {
        // If resolve has already been called, ignore any errors.
      }
    });

    authWindow.loadURL(authUrl);
  });
}
const PasswordManagerAuth = require('./password-manager/auth');
const PasswordManagerDB = require('./password-manager/database');
const { dialog } = require('electron');
autoUpdater.autoDownload = true;

autoUpdater.autoInstallOnAppQuit = false;
let updateAvailable = false;
let isManualCheck = false;
let updateDownloaded = false;
autoUpdater.on('checking-for-update', () => {
  debug('info', 'Checking for updates...');
  if (mainWindow && isManualCheck) {
    mainWindow.webContents.send('update-status', { status: 'checking', message: 'Checking for updates...' });
  }
});

autoUpdater.on('update-available', async (info) => {
  debug('info', 'Update available:', info);
  updateAvailable = true;
  if (mainWindow) {
    const title = info.releaseName || '';
    const version = info.version || '';
    const message = title
      ? `${title} (v${version})`
      : `New version available: v${version}`;
    const releaseNotes = info.releaseNotes || '';

    mainWindow.webContents.send('update-status', {
      status: 'available',
      message,
      version,
      releaseName: title,
      releaseNotes: releaseNotes
    });
  }
});


autoUpdater.on('update-not-available', (info) => {
  debug('info', 'Update not available:', info);
  if (mainWindow && isManualCheck) {
    mainWindow.webContents.send('update-status', {
      status: 'not-available',
      message: 'You are running the latest version'
    });
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  debug('info', 'Download progress:', progressObj);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', {
      status: 'downloading',
      message: `Downloading update: ${Math.round(progressObj.percent)}%`,
      percent: progressObj.percent
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  debug('success', 'Update downloaded:', info);
  updateDownloaded = true;
  if (mainWindow) {
    const title = info.releaseName || '';
    const version = info.version || '';
    const message = title
      ? `${title} (v${version}) downloaded.`
      : `v${version} downloaded.`;
    mainWindow.webContents.send('update-status', {
      status: 'downloaded',
      message,
      version,
      releaseName: title
    });
  }
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
  if (mainWindow) {
    mainWindow.webContents.send('update-status', {
      status: 'error',
      message: `Update error: ${err.message}`
    });
  }
});
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
const http = require('http');
const https = require('https');
const documentsPath = require('os').homedir() + '/Documents';
const pmDirectory = require('path').join(documentsPath, 'MakeYourLifeEasier');
if (!fs.existsSync(pmDirectory)) {
  fs.mkdirSync(pmDirectory, { recursive: true });
}
const pmAuth = new PasswordManagerAuth();
pmAuth.initialize(pmDirectory);
function stripAnsiCodes(str) {
  return str.replace(/\u001b\[[0-?]*[ -\/]*[@-~]/g, '');
}
let mainWindow;
const activeDownloads = new Map();
ipcMain.handle('show-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Executables', extensions: ['exe'] }
    ]
  });

  return result;
});
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    icon: path.join(__dirname, 'hacker.ico'),
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    // Απενεργοποίηση του default title bar
    titleBarStyle: 'hidden', // ή 'customButtonsOnHover' για macOS
    frame: false, // Για απόλυτο custom title bar
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  mainWindow.loadFile('index.html');
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      debug('error', err);
    });
  }, 3000);
}
// Window controls handlers
ipcMain.handle('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
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
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// Window state change events
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

function createPasswordManagerWindow() {
  const passwordWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    icon: path.join(__dirname, 'hacker.ico'),
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

app.whenReady().then(() => {
  try {
    loadUserProfile();
  } catch { }
  createWindow();
  setupWindowStateEvents(); // Προσθήκη αυτής της γραμμής
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  for (const filePath of downloadedFiles) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      debug('warn', 'Failed to delete downloaded file:', filePath, err);
    }
  }
  // Remove extracted directories
  for (const dirPath of extractedDirs) {
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    } catch (err) {
      debug('warn', 'Failed to delete extracted directory:', dirPath, err);
    }
  }
});
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

ipcMain.handle('login-google', async () => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials not configured');
  }
  const state = Math.random().toString(36).substring(2);
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'profile email',
    access_type: 'offline',
    prompt: 'consent',
    state
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  const result = await openAuthWindow(authUrl, GOOGLE_REDIRECT_URI, async (redirectUrl) => {
    const code = redirectUrl.searchParams.get('code');
    const returnedState = redirectUrl.searchParams.get('state');
    if (!code) throw new Error('No authorization code received');
    if (returnedState !== state) throw new Error('State mismatch');
    const tokenResponse = await postForm('https://oauth2.googleapis.com/token', {
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    });
    const accessToken = tokenResponse.access_token;
    if (!accessToken) throw new Error('Failed to obtain Google access token');

    const profile = await getJson('https://www.googleapis.com/oauth2/v3/userinfo', {
      Authorization: `Bearer ${accessToken}`
    });
    userProfile = {
      name: profile.name || profile.email || 'User',
      avatar: profile.picture || null,
      provider: 'google'
    };
    saveUserProfile();
    return userProfile;
  });
  return result;
});


ipcMain.handle('login-discord', async () => {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    throw new Error('Discord OAuth credentials not configured');
  }
  const state = Math.random().toString(36).substring(2);
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
    state
  });
  const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  const result = await openAuthWindow(authUrl, DISCORD_REDIRECT_URI, async (redirectUrl) => {
    const code = redirectUrl.searchParams.get('code');
    const returnedState = redirectUrl.searchParams.get('state');
    if (!code) throw new Error('No authorization code received');
    if (returnedState !== state) throw new Error('State mismatch');
    // Exchange the code for a token
    const tokenResponse = await postForm('https://discord.com/api/oauth2/token', {
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: DISCORD_REDIRECT_URI,
      scope: 'identify'
    });
    const accessToken = tokenResponse.access_token;
    if (!accessToken) throw new Error('Failed to obtain Discord access token');
    // Retrieve the user profile
    const profile = await getJson('https://discord.com/api/users/@me', {
      Authorization: `Bearer ${accessToken}`
    });
    // Construct the avatar URL; if the user has no custom avatar, use a default
    let avatarUrl = null;
    if (profile.avatar) {
      avatarUrl = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`;
    }
    userProfile = {
      name: profile.username + (profile.discriminator ? `#${profile.discriminator}` : ''),
      avatar: avatarUrl,
      provider: 'discord'
    };
    saveUserProfile();
    return userProfile;
  });
  return result;
});

ipcMain.handle('get-user-profile', async () => {
  return userProfile;
});

ipcMain.handle('logout', async () => {
  userProfile = null;
  saveUserProfile();
  return { success: true };
});
ipcMain.handle('run-command', async (event, command) => {
  if (typeof command !== 'string' || !command.trim()) {
    return { error: 'Invalid command' };
  }
  if (/[^a-zA-Z0-9_\.\-\s]/.test(command)) {
    return { error: 'Command contains invalid characters' };
  }
  const parts = command.trim().split(/\s+/);
  const cmd = parts.shift();
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, parts, { shell: false, windowsHide: true });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });
      child.on('error', (err) => {
        resolve({ error: err.message, stdout, stderr });
      });
      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          resolve({ error: `Command exited with code ${code}`, stdout, stderr });
        }
      });
    } catch (err) {
      resolve({ error: err.message });
    }
  });
});

// Execute the Chris Titus Windows Utility script via PowerShell.  This handler
// runs a predefined PowerShell command that downloads and executes the
// script from christitus.com.  The command is executed without shell
// interpolation, and output is captured for potential logging.  Errors
// are returned back to the renderer for user feedback.
ipcMain.handle('run-christitus', async () => {
  return new Promise((resolve) => {
    try {
      const psExe = getPowerShellExe() || 'powershell';
      const args = [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-Command',
        'irm christitus.com/win | iex'
      ];
      const child = spawn(psExe, args, { shell: false, windowsHide: false });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });
      child.on('error', (err) => {
        resolve({ error: err.message, stdout, stderr });
      });
      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          resolve({ error: `Command exited with code ${code}`, stdout, stderr });
        }
      });
    } catch (err) {
      resolve({ error: err.message });
    }
  });
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
function clientFor(url) { return url.startsWith('https:') ? https : http; }
function sanitizeName(name) {
  let cleaned = String(name).replace(/\./g, '');
  cleaned = cleaned.replace(/[^a-zA-Z0-9_-]/g, '_');
  cleaned = cleaned.replace(/_+/g, '_');
  cleaned = cleaned.replace(/^_+/, '');
  return cleaned || 'unnamed';
}
function extFromUrl(u) { const m = String(u).match(/\.([a-zA-Z0-9]+)(?:\?|$)/); return m ? `.${m[1]}` : ''; }
ipcMain.on('download-start', (event, { id, url, dest }) => {
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  const start = (downloadUrl) => {
    const req = clientFor(downloadUrl).get(downloadUrl, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const nextUrl = new URL(res.headers.location, downloadUrl).toString();
        start(nextUrl);
        return;
      }
      if (res.statusCode !== 200) {
        mainWindow.webContents.send('download-event', { id, status: 'error', error: `HTTP ${res.statusCode}` });
        return;
      }
      const sanitizedDest = sanitizeName(dest || '');
      const cd = res.headers['content-disposition'] || '';
      const cdMatch = cd.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
      const cdFile = cdMatch ? path.basename(cdMatch[1]) : '';
      const chosenExt = path.extname(sanitizedDest) || (cdFile ? path.extname(cdFile) : '') || extFromUrl(downloadUrl) || '.bin';
      const base = sanitizedDest ? path.basename(sanitizedDest, path.extname(sanitizedDest)) : (cdFile ? path.basename(cdFile, path.extname(cdFile)) : 'download');
      const finalName = sanitizeName(base) + chosenExt;
      const finalPath = path.join(downloadsDir, finalName);
      const tempPath = finalPath + '.part';
      try {
        if (fs.existsSync(finalPath)) {
          fs.unlinkSync(finalPath);
        }
      } catch (err) {
      }
      try {
        const baseNameWithoutExt = path.basename(finalName, path.extname(finalName));
        const extractDir = path.join(downloadsDir, baseNameWithoutExt);
        if (fs.existsSync(extractDir)) {
          fs.rmSync(extractDir, { recursive: true, force: true });
        }
        const altExtractDir = extractDir.replace(/_/g, ' ');
        if (altExtractDir !== extractDir && fs.existsSync(altExtractDir)) {
          fs.rmSync(altExtractDir, { recursive: true, force: true });
        }
      } catch (err) {
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      const file = fs.createWriteStream(tempPath);
      const d = { response: res, file, total, received: 0, paused: false, filePath: tempPath, finalPath };
      activeDownloads.set(id, d);
      mainWindow.webContents.send('download-event', { id, status: 'started', total });
      const cleanup = (errMsg) => {
        try { res.removeAllListeners(); res.destroy(); } catch { }
        try {
          file.removeAllListeners();
          // Close the file handle before destroying it to flush buffers
          file.close(() => {
            try { file.destroy(); } catch { }
          });
        } catch { }
        try { fs.unlink(tempPath, () => { }); } catch { }
        activeDownloads.delete(id);
        if (errMsg) {
          mainWindow.webContents.send('download-event', { id, status: 'error', error: errMsg });
        }
      };
      res.on('data', (chunk) => {
        if (d.paused) return;
        d.received += chunk.length;
        if (total) {
          const percent = Math.round((d.received / total) * 100);
          mainWindow.webContents.send('download-event', { id, status: 'progress', percent });
        }
      });
      res.on('error', (err) => cleanup(err.message));
      file.on('error', (err) => cleanup(err.message));
      res.pipe(file);
      file.once('finish', () => {
        file.close(() => {
          fs.rename(tempPath, finalPath, (err) => {
            if (err) { cleanup(err.message); return; }
            activeDownloads.delete(id);
            // Record the completed download so it can be cleaned up on exit
            try {
              downloadedFiles.push(finalPath);
            } catch (_) {
              // Ignore if push fails for some reason
            }
            mainWindow.webContents.send('download-event', { id, status: 'complete', path: finalPath });
          });
        });
      });
    });
    req.on('error', (err) => {
      activeDownloads.delete(id);
      mainWindow.webContents.send('download-event', { id, status: 'error', error: err.message });
    });
  };
  try { start(url); } catch (e) {
    mainWindow.webContents.send('download-event', { id, status: 'error', error: e.message });
  }
});
ipcMain.on('download-pause', (event, id) => {
  const d = activeDownloads.get(id);
  if (d && d.response) {
    d.paused = true;
    try { d.response.pause(); } catch { }
    mainWindow.webContents.send('download-event', { id, status: 'paused' });
  }
});
ipcMain.on('download-resume', (event, id) => {
  const d = activeDownloads.get(id);
  if (d && d.response) {
    d.paused = false;
    try { d.response.resume(); } catch { }
    mainWindow.webContents.send('download-event', { id, status: 'resumed' });
  }
});
ipcMain.on('download-cancel', (event, id) => {
  const d = activeDownloads.get(id);
  if (d) {
    try {
      if (d.response) {
        d.response.removeAllListeners();
        d.response.destroy();
      }
    } catch { }
    try {
      if (d.file) {
        d.file.removeAllListeners();
        d.file.close(() => {
          try { d.file.destroy(); } catch { }
        });
      }
    } catch { }
    try { if (d.filePath) fs.unlink(d.filePath, () => { }); } catch { }
    activeDownloads.delete(id);
    mainWindow.webContents.send('download-event', { id, status: 'cancelled' });
  }
});
ipcMain.handle('file-exists', async (event, filePath) => {
  try {
    const expandEnv = (input) => {
      return String(input).replace(/%([^%]+)%/g, (match, name) => {
        const value = process.env[name];
        return typeof value === 'string' ? value : match;
      });
    };
    const expanded = expandEnv(filePath);
    return fs.existsSync(expanded);
  } catch {
    return false;
  }
});

ipcMain.handle('replace-exe', async (event, { sourcePath, destPath }) => {
  return new Promise((resolve) => {
    try {
      const expandEnv = (input) => {
        return String(input).replace(/%([^%]+)%/g, (match, name) => {
          const value = process.env[name];
          return typeof value === 'string' ? value : match;
        });
      };

      const src = expandEnv(sourcePath);
      const dst = expandEnv(destPath);

      debug('info', 'Replacing executable with elevated privileges:');
      debug('info', 'Source:', src);
      debug('info', 'Destination:', dst);

      if (!fs.existsSync(src)) {
        resolve({ success: false, error: `Source file not found: ${src}`, code: 'SRC_MISSING' });
        return;
      }

      // Ensure the destination exists so we don't attempt to replace a file
      // that isn't present (e.g. when the application hasn't been installed yet).
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
async function ensure7za() {
  const candidates = [];

  debug('info', '🔍 Searching for 7za...');
  debug('info', 'Resources path:', process.resourcesPath);
  debug('info', '__dirname:', __dirname);
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'bin', '7za.exe'));
    candidates.push(path.join(process.resourcesPath, 'bin', '7z.exe'));

    candidates.push(path.join(__dirname, 'bin', '7za.exe'));
    candidates.push(path.join(__dirname, 'bin', '7z.exe'));

    const parentDir = path.dirname(process.resourcesPath);
    candidates.push(path.join(parentDir, 'bin', '7za.exe'));
    candidates.push(path.join(parentDir, 'bin', '7z.exe'));
  }
  if (process.platform === 'win32') {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    candidates.push(path.join(pf, '7-Zip', '7z.exe'));
    candidates.push(path.join(pf, '7-Zip', '7za.exe'));
    candidates.push(path.join(pf86, '7-Zip', '7z.exe'));
    candidates.push(path.join(pf86, '7-Zip', '7za.exe'));
  }
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        debug('success', '✅ FOUND 7za at:', candidate);
        return candidate;
      }
    } catch (err) {
      debug('error', 'Error checking:', candidate, err.message);
    }
  }
  debug('warn', '7za.exe not found in any location');
  // Candidates list intentionally omitted to reduce noise
  return null;
}
ipcMain.handle('extract-archive', async (event, { filePath, password, destDir }) => {
  return new Promise(async (resolve) => {
    const archive = String(filePath);
    const pwd = String(password || '');
    let outDir;
    if (destDir) {
      outDir = String(destDir);
    } else {
      const parent = path.dirname(archive);
      const base = path.basename(archive, path.extname(archive));
      outDir = path.join(parent, base);
    }
    try {
      if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, { recursive: true, force: true });
      }
      const altDir = outDir.replace(/_/g, ' ');
      if (altDir !== outDir && fs.existsSync(altDir)) {
        fs.rmSync(altDir, { recursive: true, force: true });
      }
      fs.mkdirSync(outDir, { recursive: true });
      // Record the extraction directory so it can be cleaned up when the app quits
      try {
        if (!extractedDirs.includes(outDir)) {
          extractedDirs.push(outDir);
        }
      } catch (_) {
        // ignore errors adding to the list
      }
    } catch (e) {
    }
    const exe = await ensure7za();
    if (!exe) {
      shell.openPath(archive);
      resolve({ success: true, output: 'File opened directly (7-Zip not available)' });
      return;
    }
    debug('info', 'Using 7za.exe from:', exe);
    const args = ['x', archive];
    if (pwd) args.push(`-p${pwd}`);
    args.push(`-o${outDir}`);
    args.push('-y');
    const child = spawn(exe, args, { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (buf) => { stderr += buf.toString(); });
    child.on('error', (err) => {
      debug('error', '7za spawn error:', err);
      resolve({ success: false, error: `7za spawn error: ${err.message}` });
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: stderr.trim() });
      } else {
        const errMsg = stderr.trim() || `7za exited with code ${code}`;
        resolve({ success: false, error: errMsg });
      }
    });
  });
});
ipcMain.handle('install-spicetify', async () => {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      try {
        const tmpScriptName = `spicetify_install_${Date.now()}.ps1`;
        const tmpScriptPath = path.join(os.tmpdir(), tmpScriptName);
        const psLines = [
          'Start-Sleep -Seconds 3',
          "Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);' -Name Native -Namespace Win32",
          '$hwnd = (Get-Process -Id $PID).MainWindowHandle',
          '[Win32.Native]::ShowWindowAsync($hwnd, 6)',
          "$ErrorActionPreference = 'Stop'",
          "$tempCli = [System.IO.Path]::GetTempFileName() + '.ps1'",
          "Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/spicetify/cli/main/install.ps1' -OutFile $tempCli",
          "$lines = Get-Content $tempCli",
          "$skip = $false",
          "$filtered = @()",
          "foreach ($line in $lines) {",
          " if ($line -match '#region Marketplace') { $skip = $true; continue }",
          " if ($line -match '#endregion Marketplace') { $skip = $false; continue }",
          " if (-not $skip) { $filtered += $line }",
          "}",
          "$filtered | Set-Content $tempCli",
          "& $tempCli",
          "Remove-Item $tempCli -Force",
          "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/spicetify/marketplace/main/resources/install.ps1' | Invoke-Expression } catch {}",
          "spicetify -v",
          "spicetify backup apply"
        ];
        fs.writeFileSync(tmpScriptPath, psLines.join('\n'), 'utf8');
        const child = spawn('cmd.exe', [
          '/c', 'start', '', 'powershell.exe', '-ExecutionPolicy', 'Bypass', '-File', tmpScriptPath
        ], { detached: true });
        child.on('error', (err) => {
          resolve({ success: false, error: err.message, output: '' });
        });
        child.on('spawn', () => {
          resolve({ success: true, output: 'Installer started in a new console window.' });
        });
      } catch (e) {
        resolve({ success: false, error: e.message, output: '' });
      }
    } else {
      const shell = process.env.SHELL || '/bin/sh';
      const unixCmd = [
        'tmpfile=$(mktemp /tmp/spicetify_install.XXXXXX.sh)',
        'curl -fsSL https://raw.githubusercontent.com/spicetify/cli/main/install.sh -o "$tmpfile"',
        "sed -i '/Do you want to install spicetify Marketplace?/,/spicetify Marketplace installation script/d' \"$tmpfile\"",
        'sh "$tmpfile"',
        'rm -f "$tmpfile"',
        'curl -fsSL https://raw.githubusercontent.com/spicetify/marketplace/main/resources/install.sh | sh || true',
        'spicetify -v',
        'spicetify backup apply'
      ].join(' && ');
      const child = spawn(shell, ['-c', unixCmd]);
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });
      child.on('error', (err) => {
        resolve({ success: false, error: err.message, output: stdout + stderr });
      });
      child.on('close', (code) => {
        const rawOut = stdout + stderr;
        const output = stripAnsiCodes(rawOut);
        if (code === 0) resolve({ success: true, output });
        else resolve({ success: false, error: `Installer exited with code ${code}`, output });
      });
    }
  });
});
ipcMain.handle('uninstall-spicetify', async () => {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const psCmd = [
        'try { spicetify restore } catch { }',
        'try { Remove-Item -Recurse -Force "$env:APPDATA\\spicetify" } catch { }',
        'try { Remove-Item -Recurse -Force "$env:LOCALAPPDATA\\spicetify" } catch { }'
      ].join(' ; ');
      const child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCmd], { windowsHide: true });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });
      child.on('error', (err) => {
        resolve({ success: false, error: err.message, output: stdout + stderr });
      });
      child.on('close', (code) => {
        const rawOut = stdout + stderr;
        const output = stripAnsiCodes(rawOut);
        if (code === 0) resolve({ success: true, output });
        else resolve({ success: false, error: `Uninstall exited with code ${code}`, output });
      });
    } else {
      const shCmd = 'spicetify restore || true; rm -rf ~/.spicetify || true; rm -rf ~/.config/spicetify || true';
      const child = spawn('sh', ['-c', shCmd]);
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });
      child.on('error', (err) => {
        resolve({ success: false, error: err.message, output: stdout + stderr });
      });
      child.on('close', (code) => {
        const rawOut = stdout + stderr;
        const output = stripAnsiCodes(rawOut);
        if (code === 0) resolve({ success: true, output });
        else resolve({ success: false, error: `Uninstall exited with code ${code}`, output });
      });
    }
  });
});
ipcMain.handle('full-uninstall-spotify', async () => {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const psParts = [
        'try { Get-Process -Name "Spotify*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue } catch { }',
        'try { spicetify restore } catch { }',
        'try {',
        ' $upd = Join-Path $env:LOCALAPPDATA "Spotify\\Update";',
        ' if (Test-Path $upd) {',
        ' attrib -R -S -H $upd -Recurse -ErrorAction SilentlyContinue;',
        ' takeown /F "$upd" /A /R /D Y | Out-Null;',
        ' icacls "$upd" /grant "*S-1-5-32-544":(OI)(CI)F /T /C | Out-Null;',
        ' icacls "$upd" /grant "$env:USERNAME":(OI)(CI)F /T /C | Out-Null;',
        ' }',
        '} catch { }',
        'try { $roam = Join-Path $env:APPDATA "Spotify"; if (Test-Path $roam) { attrib -R -S -H $roam -Recurse -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $roam -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',
        'try { $loc = Join-Path $env:LOCALAPPDATA "Spotify"; if (Test-Path $loc) { attrib -R -S -H $loc -Recurse -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $loc -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',
        'try { if (Test-Path "HKCU:\\Software\\Spotify") { Remove-Item "HKCU:\\Software\\Spotify" -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',
        'try { Remove-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" -Name "Spotify" -ErrorAction SilentlyContinue } catch { }',
        'try { if (Test-Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Spotify") { Remove-Item "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Spotify" -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',
        'try { Get-ChildItem "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall" -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -like "Spotify*" } | ForEach-Object { Remove-Item $_.PsPath -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',
        'try { if (Test-Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Spotify") { Remove-Item "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Spotify" -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',
        'try { Get-ChildItem "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall" -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -like "Spotify*" } | ForEach-Object { Remove-Item $_.PsPath -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',
        'try { Remove-Item "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Spotify.lnk" -Force -ErrorAction SilentlyContinue } catch { }',
        'try { Remove-Item "$env:PROGRAMDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Spotify.lnk" -Force -ErrorAction SilentlyContinue } catch { }',
        'try { Remove-Item "$env:PUBLIC\\Desktop\\Spotify.lnk" -Force -ErrorAction SilentlyContinue } catch { }',
        '$global:LASTEXITCODE = 0',
        'exit 0'
      ];
      const psCmd = psParts.join(' ; ');
      const child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCmd], { windowsHide: true });
      let stdout = '', stderr = '';
      child.stdout.on('data', d => { stdout += d.toString(); });
      child.stderr.on('data', d => { stderr += d.toString(); });
      child.on('error', err => {
        const output = stripAnsiCodes(stdout + stderr);
        resolve({ success: false, error: err.message, output });
      });
      child.on('close', code => {
        const output = stripAnsiCodes(stdout + stderr);
        if (code === 0) resolve({ success: true, output });
        else resolve({ success: false, error: `Full uninstall exited with code ${code}`, output });
      });
    } else {
      const shellParts = [
        'pkill -f spotify || true',
        'spicetify restore || true',
        'rm -rf ~/.config/spotify || true',
        'rm -rf ~/.cache/spotify || true',
        'rm -rf ~/.var/app/com.spotify.Client || true',
        'rm -rf ~/.local/share/spotify || true',
        'rm -rf ~/.spicetify || true',
        'rm -rf ~/.config/spicetify || true'
      ];
      const shCmd = shellParts.join('; ');
      const child = spawn('sh', ['-c', shCmd]);
      let stdout = '', stderr = '';
      child.stdout.on('data', d => { stdout += d.toString(); });
      child.stderr.on('data', d => { stderr += d.toString(); });
      child.on('error', err => {
        resolve({ success: false, error: err.message, output: stdout + stderr });
      });
      child.on('close', code => {
        const output = stripAnsiCodes(stdout + stderr);
        if (code === 0) resolve({ success: true, output });
        else resolve({ success: false, error: `Full uninstall exited with code ${code}`, output });
      });
    }
  });
});
ipcMain.handle('run-sfc-scan', async () => {
  // Execute sfc /scannow in an elevated, hidden PowerShell window and wait for completion
  if (process.platform !== 'win32') {
    return { success: false, error: 'SFC is only available on Windows' };
  }
  return new Promise((resolve) => {
    // Build a PowerShell script that runs the SFC scan and exits with the same exit code
    const psScript = `
Write-Host "=== SYSTEM FILE CHECK (SFC) ===" -ForegroundColor Cyan
Write-Host "Running sfc /scannow..." -ForegroundColor Yellow
sfc /scannow
exit $LASTEXITCODE
`;
    try {
      const psFile = path.join(os.tmpdir(), `sfc_scan_${Date.now()}.ps1`);
      fs.writeFileSync(psFile, psScript, 'utf8');
      const escapedPsFile = psFile.replace(/"/g, '\\"');
      // Launch PowerShell visibly (normal window) and wait for the scan to finish
      const psCommand = `Start-Process -FilePath \"powershell.exe\" -ArgumentList '-ExecutionPolicy Bypass -File \"${escapedPsFile}\"' -Verb RunAs -WindowStyle Normal -Wait`;
      const child = spawn('powershell.exe', ['-Command', psCommand], { windowsHide: true });
      child.on('error', (err) => {
        try { if (fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) { }
        resolve({ success: false, error: 'Administrator privileges required. Please accept the UAC prompt.', code: 'UAC_DENIED' });
      });
      child.on('exit', (code) => {
        try { if (fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) { }
        if (code === 0) {
          resolve({ success: true, message: '✅ SFC scan completed successfully!' });
        } else {
          resolve({ success: false, error: 'SFC scan encountered errors or was cancelled. Please accept the UAC prompt and try again.', code: 'PROCESS_FAILED' });
        }
      });
    } catch (error) {
      try { if (typeof psFile !== 'undefined' && fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) { }
      resolve({ success: false, error: 'Failed to start SFC scan: ' + error.message });
    }
  });
});
ipcMain.handle('run-dism-repair', async () => {
  // Execute DISM RestoreHealth in an elevated, hidden PowerShell window and wait for completion
  if (process.platform !== 'win32') {
    return { success: false, error: 'DISM is only available on Windows' };
  }
  return new Promise((resolve) => {
    // Create a PowerShell script that runs the DISM command and exits with the same exit code
    const psScript = `
Write-Host "=== DEPLOYMENT IMAGE SERVICING AND MANAGEMENT (DISM) ===" -ForegroundColor Cyan
Write-Host "Running DISM /Online /Cleanup-Image /RestoreHealth..." -ForegroundColor Yellow
DISM /Online /Cleanup-Image /RestoreHealth
exit $LASTEXITCODE
`;
    try {
      const psFile = path.join(os.tmpdir(), `dism_repair_${Date.now()}.ps1`);
      fs.writeFileSync(psFile, psScript, 'utf8');
      const escapedPsFile = psFile.replace(/"/g, '\\"');
      // Launch PowerShell visibly (normal window) and wait for the DISM command to finish
      const psCommand = `Start-Process -FilePath \"powershell.exe\" -ArgumentList '-ExecutionPolicy Bypass -File \"${escapedPsFile}\"' -Verb RunAs -WindowStyle Normal -Wait`;
      const child = spawn('powershell.exe', ['-Command', psCommand], { windowsHide: true });
      child.on('error', (err) => {
        try { if (fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) { }
        resolve({ success: false, error: 'Administrator privileges required. Please accept the UAC prompt.', code: 'UAC_DENIED' });
      });
      child.on('exit', (code) => {
        try { if (fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) { }
        if (code === 0) {
          resolve({ success: true, message: '✅ DISM repair completed successfully!' });
        } else {
          resolve({ success: false, error: 'DISM repair encountered errors or was cancelled. Please accept the UAC prompt and try again.', code: 'PROCESS_FAILED' });
        }
      });
    } catch (error) {
      try { if (typeof psFile !== 'undefined' && fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) { }
      resolve({ success: false, error: 'Failed to start DISM repair: ' + error.message });
    }
  });
});
ipcMain.handle('run-temp-cleanup', async () => {
  // Only supported on Windows
  if (process.platform !== 'win32') {
    return { success: false, error: 'This feature is only available on Windows' };
  }

  // Begin new implementation: run the PowerShell script with elevation and wait for completion.
  return new Promise((resolve) => {
    // Define the PowerShell script that performs the cleanup.
    const psScript = `
Write-Host "=== TEMPORARY FILES CLEANUP ===" -ForegroundColor Cyan
Write-Host "Running with Administrator privileges..." -ForegroundColor Green
Write-Host ""

# 1. Clean Recent files
Write-Host "1. Cleaning Recent files..." -ForegroundColor Yellow
if (Test-Path "$env:USERPROFILE\\Recent") {
    Get-ChildItem "$env:USERPROFILE\\Recent\\*.*" -Force -ErrorAction SilentlyContinue | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
    Write-Host "   ✓ Recent files cleaned" -ForegroundColor Green
} else {
    Write-Host "   ! Recent folder not found" -ForegroundColor Red
}

# 2. Clean Prefetch
Write-Host "2. Cleaning Prefetch..." -ForegroundColor Yellow
if (Test-Path "C:\\Windows\\Prefetch") {
    Get-ChildItem "C:\\Windows\\Prefetch\\*.*" -Force -ErrorAction SilentlyContinue | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
    Write-Host "   ✓ Prefetch cleaned" -ForegroundColor Green
} else {
    Write-Host "   ! Prefetch folder not found" -ForegroundColor Red
}

# 3. Clean Windows Temp
Write-Host "3. Cleaning Windows Temp..." -ForegroundColor Yellow
if (Test-Path "C:\\Windows\\Temp") {
    Get-ChildItem "C:\\Windows\\Temp\\*.*" -Force -ErrorAction SilentlyContinue | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
    Write-Host "   ✓ Windows Temp cleaned" -ForegroundColor Green
} else {
    Write-Host "   ! Windows Temp folder not found" -ForegroundColor Red
}

# 4. Clean User Temp
Write-Host "4. Cleaning User Temp..." -ForegroundColor Yellow
if (Test-Path "$env:USERPROFILE\\AppData\\Local\\Temp") {
    Get-ChildItem "$env:USERPROFILE\\AppData\\Local\\Temp\\*.*" -Force -ErrorAction SilentlyContinue | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
    Write-Host "   ✓ User Temp cleaned" -ForegroundColor Green
} else {
    Write-Host "   ! User Temp folder not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== CLEANUP COMPLETED ===" -ForegroundColor Cyan
Write-Host "All temporary files have been cleaned successfully!" -ForegroundColor Green
Write-Host ""
# Removed interactive pause for hidden execution
`;
    try {
      // Save the script to a temporary file
      const psFile = path.join(os.tmpdir(), `temp_cleanup_${Date.now()}.ps1`);
      fs.writeFileSync(psFile, psScript, 'utf8');
      // Escape double quotes for embedding in a PowerShell argument
      const escapedPsFile = psFile.replace(/"/g, '\\"');
      // Build a wrapper command that elevates and waits for completion
      const psCommand = `Start-Process -FilePath \"powershell.exe\" -ArgumentList '-ExecutionPolicy Bypass -File \"${escapedPsFile}\"' -Verb RunAs -WindowStyle Hidden -Wait`;
      const child = spawn('powershell.exe', ['-Command', psCommand], { windowsHide: true });
      // Handle error events (likely UAC denial)
      child.on('error', (err) => {
        try { if (fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) { }
        resolve({ success: false, error: 'Administrator privileges required. Please accept the UAC prompt.', code: 'UAC_DENIED' });
      });
      child.on('exit', (code) => {
        try { if (fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) { }
        if (code === 0) {
          resolve({ success: true, message: '✅ Temporary files cleanup completed successfully!' });
        } else {
          resolve({ success: false, error: 'Administrator privileges required or cleanup failed. Please accept the UAC prompt and try again.', code: 'PROCESS_FAILED' });
        }
      });
    } catch (err) {
      // Attempt to clean up the script file and propagate an error
      try { if (typeof psFile !== 'undefined' && fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) { }
      resolve({ success: false, error: 'Failed to start temp files cleanup: ' + err.message });
    }
  });

  // End of new implementation for run-temp-cleanup
});
ipcMain.handle('restart-to-bios', async () => {
  return new Promise((resolve) => {
    const tempDir = os.tmpdir();
    const vbsPath = path.join(tempDir, 'bios_restart.vbs');

    // Use array join with \r\n to avoid indentation/newline issues
    const vbsContent = [
      'Set UAC = CreateObject("Shell.Application")',
      'UAC.ShellExecute "cmd.exe", "/c shutdown /r /fw /t 0", "", "runas", 1'
    ].join('\r\n');

    try {
      fs.writeFileSync(vbsPath, vbsContent);
      exec(`cscript //nologo "${vbsPath}"`, (error) => {
        try { fs.unlinkSync(vbsPath); } catch (e) { }

        if (error) {
          resolve({
            success: false,
            error: 'Administrator privileges required. Please run as Administrator.',
            code: 'ADMIN_REQUIRED'
          });
        } else {
          resolve({
            success: true,
            message: 'UAC prompt appeared. Grant permissions to restart to BIOS.'
          });
        }
      });
    } catch (fileError) {
      resolve({
        success: false,
        error: 'Failed to create elevation script: ' + fileError.message
      });
    }
  });
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
    // Password add requested

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
        debug('error', 'Error details:', err.message);
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
ipcMain.handle('open-password-manager', async () => {
  createPasswordManagerWindow();
  return { success: true };
});
ipcMain.handle('password-manager-has-master-password', async () => {
  try {
    debug('info', 'Checking for master password...');

    if (!pmAuth.configPath) {
      debug('info', 'Auth manager not initialized, initializing now...');
      const documentsPath = require('os').homedir() + '/Documents';
      const pmDirectory = require('path').join(documentsPath, 'MakeYourLifeEasier');
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
      debug('info', 'Auth manager not initialized, initializing now...');
      const documentsPath = require('os').homedir() + '/Documents';
      const pmDirectory = require('path').join(documentsPath, 'MakeYourLifeEasier');
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
      debug('info', 'Auth manager not initialized, initializing now...');
      const documentsPath = require('os').homedir() + '/Documents';
      const pmDirectory = require('path').join(documentsPath, 'MakeYourLifeEasier');
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
ipcMain.handle('run-activate-script', async () => {
  return new Promise((resolve) => {
    resolve({ success: true, message: 'Activation script completed' });
  });
});
ipcMain.handle('run-autologin-script', async () => {
  return new Promise((resolve) => {
    resolve({ success: true, message: 'Autologin script completed' });
  });
});

function getFallbackApps() {
  return [
    { id: 'Microsoft.BingNews', name: 'Microsoft News' },
    { id: 'Microsoft.BingWeather', name: 'Microsoft Weather' },
    { id: 'Microsoft.Getstarted', name: 'Get Started' },
    { id: 'Microsoft.MicrosoftSolitaireCollection', name: 'Microsoft Solitaire' },
    { id: 'Microsoft.YourPhone', name: 'Your Phone' },
    { id: 'Microsoft.TikTok', name: 'TikTok' },
    { id: 'SpotifyAB.SpotifyMusic', name: 'Spotify' }
  ];
}


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
            } catch (e) {
              continue;
            }
          }
        } catch (error) {
        }
      }

      searchDirectory(directoryPath);
      resolve(executableFiles);
    } catch (error) {
      resolve([]);
    }
  });
});
// Προσθήκη νέου handler για MSI installers
ipcMain.handle('run-msi-installer', async (event, msiPath) => {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ success: false, error: 'MSI installers are only supported on Windows' });
      return;
    }

    const command = `msiexec /i "${msiPath}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        debug('info', 'MSI execution details:', { error, stdout, stderr });

        // Θεωρούμε επιτυχία αν υπήρχε κάποιο output
        if (stdout || stderr) {
          resolve({
            success: true,
            message: 'MSI installer started successfully',
            details: { stdout, stderr }
          });
        } else {
          resolve({
            success: false,
            error: error.message,
            details: { stdout, stderr }
          });
        }
      } else {
        resolve({
          success: true,
          message: 'MSI installer completed successfully',
          details: { stdout, stderr }
        });
      }
    });
  });
});
// Νέο handler για εκτέλεση installers
ipcMain.handle('run-installer', async (event, filePath) => {
  return new Promise((resolve) => {
    debug('info', 'Running installer:', filePath);

    if (process.platform === 'win32') {
      // Χρήση start command για να ανοίξει το αρχείο
      const command = `start "" "${filePath}"`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          debug('error', 'Exec error:', error);
          resolve({ success: false, error: error.message });
        } else {
          debug('success', 'Exec success');
          resolve({ success: true });
        }
      });
    } else {
      // Για άλλα OS
      shell.openPath(filePath)
        .then((error) => {
          if (error) {
            resolve({ success: false, error: error });
          } else {
            resolve({ success: true });
          }
        })
        .catch((error) => {
          resolve({ success: false, error: error.message });
        });
    }
  });
});

ipcMain.handle('password-manager-reset', async () => {
  try {
    // Διαγραφή config file
    if (fs.existsSync(pmAuth.configPath)) {
      fs.unlinkSync(pmAuth.configPath);
    }

    // Διαγραφή DB file
    const dbPath = path.join(pmAuth.dbDirectory, 'password_manager.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    // Logout και reset auth
    pmAuth.logout();
    pmAuth.initialize(); // Re-init

    return { success: true };
  } catch (error) {
    debug('error', 'Error resetting password manager:', error);
    return { success: false, error: error.message };
  }
});