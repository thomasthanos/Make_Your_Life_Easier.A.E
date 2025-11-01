const { app, BrowserWindow, ipcMain, shell, nativeTheme } = require('electron');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

// would not be defined yet.
const fs = require('fs');
let oauthConfig = {};
try {
  const oauthPath = path.join(__dirname, 'oauth_config.json');
  if (fs.existsSync(oauthPath)) {
    const raw = fs.readFileSync(oauthPath, 'utf-8');
    oauthConfig = JSON.parse(raw);
  }
} catch (err) {
  console.warn('Failed to load oauth_config.json:', err);
  oauthConfig = {};
}

app.commandLine.appendSwitch('enable-features', 'WebContentsForceDark');


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
    console.warn('Failed to load saved user profile:', err);
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
    console.warn('Failed to save user profile:', err);
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
    const authWindow = new BrowserWindow({
      width: 600,
      height: 700,
      show: true,
      parent: mainWindow,
      modal: true,
      autoHideMenuBar: true,
      backgroundColor: '#202124',
      darkTheme: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

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
      const currentUrl = authWindow.webContents.getURL();
      
      if (isGoogleOAuth(currentUrl)) {
        // CSS Injection ΜΟΝΟ για Google
        authWindow.webContents.insertCSS(`
          body {
            background-color: #202124 !important;
            color: #e8eaed !important;
          }
          [class*="background"] {
            background-color: #202124 !important;
          }
          [class*="container"], [class*="wrapper"], [class*="box"] {
            background-color: #202124 !important;
            color: #e8eaed !important;
          }
          div {
            background-color: #202124 !important;
            color: #e8eaed !important;
          }
          form {
            background-color: #202124 !important;
            color: #e8eaed !important;
          }
          .CryPo, .BDE19, .LZgQXe, .Ha17qf, .Or16q {
            background-color: #202124 !important;
            color: #e8eaed !important;
          }
          
          /* ΜΟΝΟ Η ΔΙΟΡΘΩΣΗ ΓΙΑ HOVER - ελαφρώς πιο σκούρο */
          .wehrve:focus, .wehrve:hover, 
          .mTkos:focus, .mTkos:hover,
          .TrZEUc:focus, .TrZEUc:hover,
          .JnOM6e:focus, .JnOM6e:hover {
            background-color: #1a1c1e !important;
          }
        `);
        
        // JavaScript για Google
        authWindow.webContents.executeJavaScript(`
          // Αλλαγή background και text color σε όλα τα elements
          document.body.style.backgroundColor = '#202124';
          document.body.style.color = '#e8eaed';
          
          // Αλλαγή σε όλα τα divs
          const allDivs = document.querySelectorAll('div');
          allDivs.forEach(div => {
            div.style.backgroundColor = '#202124';
            div.style.color = '#e8eaed';
          });
          
          // Αλλαγή σε όλα τα forms
          const allForms = document.querySelectorAll('form');
          allForms.forEach(form => {
            form.style.backgroundColor = '#202124';
            form.style.color = '#e8eaed';
          });
          
          // Αλλαγή στα συγκεκριμένα class της Google
          const googleClasses = ['CryPo', 'BDE19', 'LZgQXe', 'Ha17qf', 'Or16q'];
          googleClasses.forEach(className => {
            const elements = document.getElementsByClassName(className);
            for (let element of elements) {
              element.style.backgroundColor = '#202124';
              element.style.color = '#e8eaed';
            }
          });
        `);
      }
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
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
let updateAvailable = false;
let isManualCheck = false;
let updateDownloaded = false;
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for updates...');
  if (mainWindow && isManualCheck) {
    mainWindow.webContents.send('update-status', { status: 'checking', message: 'Checking for updates...' });
  }
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info);
  updateAvailable = true;
  if (mainWindow) {
    const title = info.releaseName || '';
    const version = info.version || '';
    const message = title
      ? `${title} (v${version})`
      : `Update available: v${version}`;
    mainWindow.webContents.send('update-status', {
      status: 'available',
      message,
      version,
      releaseName: title,
      releaseNotes: info.releaseNotes
    });
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available:', info);
  if (mainWindow && isManualCheck) {
    mainWindow.webContents.send('update-status', {
      status: 'not-available',
      message: 'You are running the latest version'
    });
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log('Download progress:', progressObj);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', {
      status: 'downloading',
      message: `Downloading update: ${Math.round(progressObj.percent)}%`,
      percent: progressObj.percent
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info);
  updateDownloaded = true;
  if (mainWindow) {
    const title = info.releaseName || '';
    const version = info.version || '';
    const message = title
      ? `${title} (v${version}) downloaded. Restart to install.`
      : `v${version} downloaded. Restart to install.`;
    mainWindow.webContents.send('update-status', {
      status: 'downloaded',
      message,
      version,
      releaseName: title
    });
  }
});

autoUpdater.on('error', (err) => {
  console.log('Update error:', err);
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
    autoUpdater.quitAndInstall();
    return { success: true };
  }
  return { success: false, error: 'No update downloaded' };
});
ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
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

// Keep track of files and directories downloaded or extracted by this app.
// Items added to this set will be deleted automatically when the app quits.
const completedDownloads = new Set();
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
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  mainWindow.loadFile('index.html');
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(console.error);
  }, 3000);
}

function createPasswordManagerWindow() {
  const passwordWindow = new BrowserWindow({
    width: 1600,
    height: 900,
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
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// When the application is about to fully quit (after all windows closed),
// remove any downloaded files or extracted folders that were recorded
// during runtime. This ensures temporary install files do not
// accumulate in the user's Downloads folder.  The cleanup runs
// synchronously because quitting is already in progress.
app.on('will-quit', () => {
  try {
    for (const p of completedDownloads) {
      try {
        if (fs.existsSync(p)) {
          const stat = fs.lstatSync(p);
          if (stat.isDirectory()) {
            fs.rmSync(p, { recursive: true, force: true });
          } else {
            fs.unlinkSync(p);
          }
        }
      } catch (err) {
        console.warn('Failed to delete temporary download', p, err);
      }
    }
    completedDownloads.clear();
  } catch (e) {
    console.warn('Error during cleanup on exit:', e);
  }
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
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

// Return the cached user profile (if any).  The renderer can call this
// method to determine whether a user is currently logged in and display
// their details.  If no user is logged in, this will return null.
ipcMain.handle('get-user-profile', async () => {
  return userProfile;
});

// Clear the current user profile and remove any persisted data.  This
// handler is invoked when the user chooses to log out via the UI.
ipcMain.handle('logout', async () => {
  userProfile = null;
  saveUserProfile();
  return { success: true };
});
ipcMain.handle('run-command', async (event, command) => {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error) resolve({ error: error.message, stdout, stderr });
      else resolve({ stdout, stderr });
    });
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
function sanitizeName(name) { return String(name).replace(/[^a-zA-Z0-9._-]/g, '_'); }
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
        try { res.destroy(); } catch { }
        try { file.destroy(); } catch { }
        try { fs.unlink(tempPath, () => { }); } catch { }
        activeDownloads.delete(id);
        if (errMsg) mainWindow.webContents.send('download-event', { id, status: 'error', error: errMsg });
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
            mainWindow.webContents.send('download-event', { id, status: 'complete', path: finalPath });

            // Record the downloaded file for cleanup on exit
            try {
              completedDownloads.add(finalPath);
            } catch (e) {
              console.warn('Failed to record downloaded file for cleanup:', e);
            }
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
    try { if (d.response) d.response.destroy(); } catch { }
    try { if (d.file) d.file.destroy(); } catch { }
    try { if (d.filePath) fs.unlink(d.filePath, () => { }); } catch { }
    activeDownloads.delete(id);
    mainWindow.webContents.send('download-event', { id, status: 'cancelled' });
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

      console.log('Replacing executable with elevated privileges:');
      console.log('Source:', src);
      console.log('Destination:', dst);

      if (!fs.existsSync(src)) {
        resolve({ success: false, error: `Source file not found: ${src}` });
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
      console.log('Requesting UAC elevation for file replacement...');
      exec(`wscript "${vbsFile}"`, (error) => {
        setTimeout(() => {
          try { fs.unlinkSync(vbsFile); } catch { }
          try { fs.unlinkSync(psFile); } catch { }
        }, 10000);

        if (error) {
          console.log('User denied UAC or elevation failed:', error);
          resolve({
            success: false,
            error: 'Administrator privileges required. Please accept the UAC prompt.',
            code: 'UAC_DENIED'
          });
        } else {
          console.log('UAC accepted, replacement in progress...');

          setTimeout(() => {
            if (fs.existsSync(dst)) {
              resolve({
                success: true,
                message: '✅ File replacement completed successfully!'
              });
            } else {
              resolve({
                success: false,
                error: 'Replacement may have failed. The destination file was not found.'
              });
            }
          }, 4000);
        }
      });

    } catch (err) {
      console.error('Replace exception:', err);
      resolve({ success: false, error: `Exception: ${err.message}` });
    }
  });
});
async function ensure7za() {
  const candidates = [];

  console.log('🔍 Searching for 7za...');
  console.log('Resources path:', process.resourcesPath);
  console.log('__dirname:', __dirname);
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
        console.log('✅ FOUND 7za at:', candidate);
        return candidate;
      }
    } catch (err) {
      console.log('❌ Error checking:', candidate, err.message);
    }
  }
  console.log('❌ 7za.exe not found in any location');

  console.log('📋 Checked paths:');
  candidates.forEach((candidate, index) => {
    console.log(` ${index + 1}. ${candidate}`);
  });

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

    // Record the extracted directory for cleanup on exit
    try {
      completedDownloads.add(outDir);
    } catch (e) {
      console.warn('Failed to record extraction directory for cleanup:', e);
    }
    } catch (e) {
    }
    const exe = await ensure7za();
    if (!exe) {
      shell.openPath(archive);
      resolve({ success: true, output: 'File opened directly (7-Zip not available)' });
      return;
    }
    console.log('Using 7za.exe from:', exe);
    const args = ['x', archive];
    if (pwd) args.push(`-p${pwd}`);
    args.push(`-o${outDir}`);
    args.push('-y');
    const child = spawn(exe, args, { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (buf) => { stderr += buf.toString(); });
    child.on('error', (err) => {
      console.error('7za spawn error:', err);
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
      // Escape backslashes and double quotes in the temp script path.  Without escaping
      // backslashes the generated PowerShell command can misinterpret parts of the path.
      const escapedPsFile = psFile
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
      // Launch PowerShell visibly (normal window) and wait for the scan to finish.  Wrap
      // the file path in double quotes inside the argument list; the surrounding single
      // quotes for -ArgumentList prevent PowerShell from splitting on spaces.
      const psCommand = `Start-Process -FilePath "powershell.exe" -ArgumentList '-ExecutionPolicy Bypass -File "${escapedPsFile}"' -Verb RunAs -WindowStyle Normal -Wait`;
      const child = spawn('powershell.exe', ['-Command', psCommand], { windowsHide: true });
      child.on('error', (err) => {
        try { if (fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) {}
        resolve({ success: false, error: 'Administrator privileges required. Please accept the UAC prompt.', code: 'UAC_DENIED' });
      });
      child.on('exit', (code) => {
        try { if (fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) {}
        if (code === 0) {
          resolve({ success: true, message: '✅ SFC scan completed successfully!' });
        } else {
          resolve({ success: false, error: 'SFC scan encountered errors or was cancelled. Please accept the UAC prompt and try again.', code: 'PROCESS_FAILED' });
        }
      });
    } catch (error) {
      try { if (typeof psFile !== 'undefined' && fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) {}
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
      // Escape backslashes and double quotes in the temp script path. Without escaping
      // backslashes the generated PowerShell command can misinterpret parts of the path.
      const escapedPsFile = psFile
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
      // Launch PowerShell visibly (normal window) and wait for the DISM command to finish.
      // Wrap the file path in double quotes inside the argument list; the surrounding
      // single quotes ensure the path is passed as a single argument to PowerShell.
      const psCommand = `Start-Process -FilePath "powershell.exe" -ArgumentList '-ExecutionPolicy Bypass -File "${escapedPsFile}"' -Verb RunAs -WindowStyle Normal -Wait`;
      const child = spawn('powershell.exe', ['-Command', psCommand], { windowsHide: true });
      child.on('error', (err) => {
        try { if (fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) {}
        resolve({ success: false, error: 'Administrator privileges required. Please accept the UAC prompt.', code: 'UAC_DENIED' });
      });
      child.on('exit', (code) => {
        try { if (fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) {}
        if (code === 0) {
          resolve({ success: true, message: '✅ DISM repair completed successfully!' });
        } else {
          resolve({ success: false, error: 'DISM repair encountered errors or was cancelled. Please accept the UAC prompt and try again.', code: 'PROCESS_FAILED' });
        }
      });
    } catch (error) {
      try { if (typeof psFile !== 'undefined' && fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) {}
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
      // Escape backslashes and double quotes for embedding in a PowerShell argument.
      const escapedPsFile = psFile
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
      // Build a wrapper command that elevates and waits for completion.  Wrap the
      // file path in double quotes inside the argument list; the surrounding single
      // quotes ensure it remains a single argument.
      const psCommand = `Start-Process -FilePath "powershell.exe" -ArgumentList '-ExecutionPolicy Bypass -File "${escapedPsFile}"' -Verb RunAs -WindowStyle Hidden -Wait`;
      const child = spawn('powershell.exe', ['-Command', psCommand], { windowsHide: true });
      // Handle error events (likely UAC denial)
      child.on('error', (err) => {
        try { if (fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) {}
        resolve({ success: false, error: 'Administrator privileges required. Please accept the UAC prompt.', code: 'UAC_DENIED' });
      });
      child.on('exit', (code) => {
        try { if (fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) {}
        if (code === 0) {
          resolve({ success: true, message: '✅ Temporary files cleanup completed successfully!' });
        } else {
          resolve({ success: false, error: 'Administrator privileges required or cleanup failed. Please accept the UAC prompt and try again.', code: 'PROCESS_FAILED' });
        }
      });
    } catch (err) {
      // Attempt to clean up the script file and propagate an error
      try { if (typeof psFile !== 'undefined' && fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) {}
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
        console.error('Error getting categories:', err);
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
        console.error('Error getting passwords:', err);
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, passwords: rows || [] });
      }
    });
  });
});
ipcMain.handle('password-manager-add-password', async (event, passwordData) => {
  return new Promise((resolve) => {
    console.log('=== ADD PASSWORD REQUEST ===');
    console.log('Password data received:', {
      title: passwordData.title,
      passwordLength: passwordData.password ? passwordData.password.length : 0,
      hasUsername: !!passwordData.username,
      hasEmail: !!passwordData.email,
      hasUrl: !!passwordData.url,
      hasNotes: !!passwordData.notes
    });

    const db = new PasswordManagerDB(pmAuth);

    const timeout = setTimeout(() => {
      db.close();
      resolve({ success: false, error: 'Database timeout' });
    }, 10000);
    db.addPassword(passwordData, function (err) {
      clearTimeout(timeout);
      db.close();
      if (err) {
        console.error('Error adding password:', err);
        console.error('Error details:', err.message);
        resolve({ success: false, error: err.message });
      } else {
        console.log('Password added successfully, ID:', this.lastID);
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
    console.log('Checking for master password...');

    if (!pmAuth.configPath) {
      console.log('Auth manager not initialized, initializing now...');
      const documentsPath = require('os').homedir() + '/Documents';
      const pmDirectory = require('path').join(documentsPath, 'MakeYourLifeEasier');
      pmAuth.initialize(pmDirectory);
    }

    const result = pmAuth.hasMasterPassword();
    console.log('Master password exists:', result);
    return result;
  } catch (error) {
    console.error('Error checking master password:', error);
    return false;
  }
});
ipcMain.handle('password-manager-create-master-password', async (event, password) => {
  try {
    console.log('Creating master password...');

    if (!pmAuth.configPath) {
      console.log('Auth manager not initialized, initializing now...');
      const documentsPath = require('os').homedir() + '/Documents';
      const pmDirectory = require('path').join(documentsPath, 'MakeYourLifeEasier');
      pmAuth.initialize(pmDirectory);
    }

    await pmAuth.createMasterPassword(password);
    return { success: true };
  } catch (error) {
    console.error('Error creating master password:', error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle('password-manager-authenticate', async (event, password) => {
  try {
    console.log('Authenticating...');

    if (!pmAuth.configPath) {
      console.log('Auth manager not initialized, initializing now...');
      const documentsPath = require('os').homedir() + '/Documents';
      const pmDirectory = require('path').join(documentsPath, 'MakeYourLifeEasier');
      pmAuth.initialize(pmDirectory);
    }

    await pmAuth.authenticate(password);
    return { success: true };
  } catch (error) {
    console.error('Error authenticating:', error);
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

// Προσθήκη του get-preinstalled-apps handler
ipcMain.handle('get-preinstalled-apps', async () => {
  // Only supported on Windows. Return an empty array on other platforms
  if (process.platform !== 'win32') {
    return [];
  }

  return new Promise((resolve) => {
    const psScript = `
# Βελτιωμένη ανάκτηση εφαρμογών με κατηγοριοποίηση
try {
    $allPackages = Get-AppxPackage | Where-Object { 
        $_.NonRemovable -eq $false -and 
        $_.SignatureKind -eq "Store" -and
        $_.IsFramework -eq $false
    }
    
    # Κατηγορίες εφαρμογών
    $appCategories = @{
        "Microsoft Apps" = @(
            "Microsoft.BingNews", "Microsoft.BingWeather", "Microsoft.Getstarted",
            "Microsoft.MicrosoftSolitaireCollection", "Microsoft.YourPhone"
        )
        "Social Media" = @(
            "Microsoft.TikTok", "Facebook.Facebook", "Instagram.Instagram", 
            "Twitter.Twitter"
        )
        "Xbox & Gaming" = @(
            "Microsoft.XboxApp", "Microsoft.XboxIdentityProvider", 
            "Microsoft.XboxGamingOverlay", "ROBLOXCORPORATION.ROBLOX"
        )
        "Media & Entertainment" = @(
            "SpotifyAB.SpotifyMusic", "Microsoft.ZuneMusic", "Microsoft.WindowsPhotos",
            "Netflix", "Disney.37853FC22B2CE"
        )
        "Productivity" = @(
            "Microsoft.QuickAssist", "Microsoft.PowerAutomateDesktop",
            "Microsoft.OutlookForWindows", "Microsoft.Todos", "Microsoft.MicrosoftTeams"
        )
        "Utilities" = @(
            "Clipchamp.Clipchamp", "Microsoft.WindowsSoundRecorder",
            "Microsoft.WindowsAlarms", "Microsoft.WindowsCamera", "Microsoft.WindowsMaps"
        )
    }
    
    $categorizedApps = @{}
    $uncategorizedApps = @()
    
    foreach ($package in $allPackages) {
        $foundCategory = $null
        foreach ($category in $appCategories.Keys) {
            foreach ($pattern in $appCategories[$category]) {
                if ($package.Name -like "*$pattern*") {
                    if (-not $categorizedApps[$category]) {
                        $categorizedApps[$category] = @()
                    }
                    $categorizedApps[$category] += @{
                        id = $package.Name
                        name = $package.Name
                        fullName = $package.PackageFullName
                        version = $package.Version
                    }
                    $foundCategory = $category
                    break
                }
            }
            if ($foundCategory) { break }
        }
        
        if (-not $foundCategory) {
            # Προσθήκη μόνο αν δεν είναι system component
            if ($package.Name -notlike "*Microsoft.Windows.*" -and 
                $package.Name -notlike "*Microsoft.NET.*" -and
                $package.Name -notlike "*Microsoft.VCLibs.*" -and
                $package.Name -notlike "*Microsoft.UI.Xaml*") {
                $uncategorizedApps += @{
                    id = $package.Name
                    name = $package.Name
                    fullName = $package.PackageFullName
                    version = $package.Version
                }
            }
        }
    }
    
    # Προσθήκη uncategorized apps σε ξεχωριστή κατηγορία
    if ($uncategorizedApps.Count -gt 0) {
        $categorizedApps["Other Apps"] = $uncategorizedApps
    }
    
    ConvertTo-Json -InputObject @{
        categories = $categorizedApps
        totalCount = $allPackages.Count
    } -Compress -Depth 3
} catch {
    Write-Error $_
    "{}"
}
`;

    const child = spawn('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript
    ]);

    let output = '';
    child.stdout.on('data', (data) => output += data.toString());
    child.stderr.on('data', (data) => console.error('PS Error:', data.toString()));
    
    child.on('exit', (code) => {
      try {
        if (output.trim()) {
          const result = JSON.parse(output);
          // If the result has categories, flatten them to a list of app IDs
          if (result && typeof result === 'object' && result.categories) {
            // Mapping of known package IDs to human-friendly names
            const friendlyNames = {
              'Microsoft.BingNews': 'Microsoft News',
              'Microsoft.BingWeather': 'Microsoft Weather',
              'Microsoft.Getstarted': 'Get Started',
              'Microsoft.MicrosoftSolitaireCollection': 'Microsoft Solitaire',
              'Microsoft.YourPhone': 'Your Phone',
              'Microsoft.TikTok': 'TikTok',
              'Clipchamp.Clipchamp': 'Clipchamp',
              'Microsoft.XboxApp': 'Xbox',
              'Microsoft.XboxIdentityProvider': 'Xbox Identity Provider',
              'Microsoft.XboxGamingOverlay': 'Xbox Game Bar',
              'Microsoft.WindowsSoundRecorder': 'Sound Recorder',
              'Microsoft.QuickAssist': 'Quick Assist',
              'Microsoft.PowerAutomateDesktop': 'Power Automate',
              'Microsoft.OutlookForWindows': 'Outlook for Windows',
              'Microsoft.Todos': 'Microsoft To Do',
              'Microsoft.MicrosoftTeams': 'Microsoft Teams',
              'Microsoft.GamingApp': 'Microsoft Gaming',
              'Microsoft.Bing': 'Microsoft Bing',
              'Microsoft.ZuneMusic': 'Media Player',
              'Microsoft.WindowsFeedbackHub': 'Feedback Hub',
              'Microsoft.WindowsAlarms': 'Clock',
              'Microsoft.WindowsCamera': 'Camera',
              'Microsoft.SkypeApp': 'Skype',
              'Microsoft.People': 'People',
              'Microsoft.WindowsMaps': 'Maps',
              'Microsoft.Paint': 'Paint',
              'Microsoft.MSPaint': 'Paint 3D',
              'SpotifyAB.SpotifyMusic': 'Spotify',
              'Facebook.Facebook': 'Facebook',
              'Instagram.Instagram': 'Instagram',
              'Twitter.Twitter': 'Twitter'
            };
            // Helper to derive a name from a package ID when no mapping is found
            function deriveName(id) {
              const seg = id.split('.').pop();
              let name = seg;
              // Insert space between a lower-case/digit and an uppercase letter
              name = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
              // Also insert space between consecutive uppercase letters when the next is followed by a lower-case letter
              name = name.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
              return name;
            }
            const list = [];
            for (const key of Object.keys(result.categories)) {
              const items = result.categories[key];
              if (Array.isArray(items)) {
                items.forEach((item) => {
                  let id;
                  let baseName;
                  if (item && typeof item === 'object') {
                    id = item.id;
                    baseName = item.name;
                  } else if (typeof item === 'string') {
                    id = item;
                    baseName = undefined;
                  }
                  if (!id) return;
                  // Prefer a friendly name from the mapping, then the item's base name if it's different from the id, else derive from the id
                  let name;
                  if (friendlyNames[id]) {
                    name = friendlyNames[id];
                  } else if (baseName && baseName !== id) {
                    name = baseName;
                  } else {
                    name = deriveName(id);
                  }
                  // Skip entries where the name resolves to a purely numeric string
                  if (typeof name === 'string' && /^\d+$/.test(name.trim())) {
                    return;
                  }
                  list.push({ id, name });
                });
              }
            }
            resolve(list);
            return;
          }
          // If the parsed result is already an array, ensure each element is an object with id/name
          if (Array.isArray(result)) {
            const friendlyNames = {
              'Microsoft.BingNews': 'Microsoft News',
              'Microsoft.BingWeather': 'Microsoft Weather',
              'Microsoft.Getstarted': 'Get Started',
              'Microsoft.MicrosoftSolitaireCollection': 'Microsoft Solitaire',
              'Microsoft.YourPhone': 'Your Phone',
              'Microsoft.TikTok': 'TikTok',
              'Clipchamp.Clipchamp': 'Clipchamp',
              'Microsoft.XboxApp': 'Xbox',
              'Microsoft.XboxIdentityProvider': 'Xbox Identity Provider',
              'Microsoft.XboxGamingOverlay': 'Xbox Game Bar',
              'Microsoft.WindowsSoundRecorder': 'Sound Recorder',
              'Microsoft.QuickAssist': 'Quick Assist',
              'Microsoft.PowerAutomateDesktop': 'Power Automate',
              'Microsoft.OutlookForWindows': 'Outlook for Windows',
              'Microsoft.Todos': 'Microsoft To Do',
              'Microsoft.MicrosoftTeams': 'Microsoft Teams',
              'Microsoft.GamingApp': 'Microsoft Gaming',
              'Microsoft.Bing': 'Microsoft Bing',
              'Microsoft.ZuneMusic': 'Media Player',
              'Microsoft.WindowsFeedbackHub': 'Feedback Hub',
              'Microsoft.WindowsAlarms': 'Clock',
              'Microsoft.WindowsCamera': 'Camera',
              'Microsoft.SkypeApp': 'Skype',
              'Microsoft.People': 'People',
              'Microsoft.WindowsMaps': 'Maps',
              'Microsoft.Paint': 'Paint',
              'Microsoft.MSPaint': 'Paint 3D',
              'SpotifyAB.SpotifyMusic': 'Spotify',
              'Facebook.Facebook': 'Facebook',
              'Instagram.Instagram': 'Instagram',
              'Twitter.Twitter': 'Twitter'
            };
            function deriveName(id) {
              const seg = id.split('.').pop();
              let name = seg;
              name = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
              name = name.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
              return name;
            }
            const list = result.map((item) => {
              let id;
              let baseName;
              if (item && typeof item === 'object') {
                id = item.id;
                baseName = item.name;
              } else if (typeof item === 'string') {
                id = item;
                baseName = undefined;
              }
              if (!id) return null;
              let name;
              if (friendlyNames[id]) {
                name = friendlyNames[id];
              } else if (baseName && baseName !== id) {
                name = baseName;
              } else {
                name = deriveName(id);
              }
              // Skip entries where the name resolves to a purely numeric string
              if (typeof name === 'string' && /^\d+$/.test(name.trim())) {
                return null;
              }
              return { id, name };
            }).filter(Boolean);
            resolve(list);
            return;
          }
          // Otherwise, resolve with an empty array
          resolve([]);
        } else {
          resolve([]);
        }
      } catch {
        resolve([]);
      }
    });
  });
});

// Προσθήκη του get-default-remove-apps handler (legacy instance 1)
// Ensure previous handlers for the same channel are removed before registering again
ipcMain.removeHandler('get-default-remove-apps');
ipcMain.handle('get-default-remove-apps', async () => {
  return [
    'Microsoft.BingNews',
    'Microsoft.BingWeather',
    'Microsoft.Getstarted',
    'Microsoft.MicrosoftSolitaireCollection', 
    'Microsoft.YourPhone',
    'Microsoft.TikTok',
    'Clipchamp.Clipchamp',
    'Microsoft.XboxApp',
    'Microsoft.XboxIdentityProvider',
    'Microsoft.XboxGamingOverlay',
    'Microsoft.WindowsSoundRecorder',
    'Microsoft.QuickAssist',
    'Microsoft.PowerAutomateDesktop',
    'Microsoft.OutlookForWindows',
    'Microsoft.Todos',
    'Microsoft.MicrosoftTeams',
    'Microsoft.GamingApp',
    'Microsoft.Bing',
    'Microsoft.ZuneMusic',
    'Microsoft.WindowsFeedbackHub',
    'Microsoft.SkypeApp',
    'Microsoft.People',
    'Microsoft.WindowsCamera',
    'Microsoft.WindowsAlarms',
    'Microsoft.WindowsMaps',
    'Microsoft.Paint',
    'Microsoft.MSPaint',
    'SpotifyAB.SpotifyMusic',
    'Facebook.Facebook',
    'Instagram.Instagram',
    'Twitter.Twitter'
  ];
});

// Helper function for fallback apps
function getFallbackApps() {
  return [
    { id: 'Microsoft.BingNews', name: 'Microsoft News' },
    { id: 'Microsoft.BingWeather', name: 'Microsoft Weather' },
    { id: 'Microsoft.Getstarted', name: 'Get Started' },
    { id: 'Microsoft.MicrosoftSolitaireCollection', name: 'Microsoft Solitaire' },
    { id: 'Microsoft.YourPhone', name: 'Your Phone' },
    { id: 'Microsoft.TikTok', name: 'TikTok' },
    { id: 'Clipchamp.Clipchamp', name: 'Clipchamp' },
    { id: 'SpotifyAB.SpotifyMusic', name: 'Spotify' },
    { id: 'Microsoft.XboxApp', name: 'Xbox' },
    { id: 'Microsoft.XboxIdentityProvider', name: 'Xbox Identity Provider' },
    { id: 'Microsoft.XboxGamingOverlay', name: 'Xbox Game Bar' },
    { id: 'Microsoft.WindowsSoundRecorder', name: 'Sound Recorder' },
    { id: 'Microsoft.QuickAssist', name: 'Quick Assist' },
    { id: 'Microsoft.PowerAutomateDesktop', name: 'Power Automate' },
    { id: 'Microsoft.Paint', name: 'Paint' },
    { id: 'Microsoft.MSPaint', name: 'Paint 3D' },
    { id: 'Microsoft.OutlookForWindows', name: 'Outlook for Windows' },
    { id: 'Microsoft.Todos', name: 'Microsoft To Do' },
    { id: 'Microsoft.MicrosoftTeams', name: 'Microsoft Teams' },
    { id: 'Microsoft.Edge', name: 'Microsoft Edge' },
    { id: 'Microsoft.GamingApp', name: 'Microsoft Gaming' },
    { id: 'Microsoft.Bing', name: 'Microsoft Bing' },
    { id: 'Microsoft.ZuneMusic', name: 'Media Player' },
    { id: 'Microsoft.WindowsFeedbackHub', name: 'Feedback Hub' },
    { id: 'Microsoft.WindowsAlarms', name: 'Clock' },
    { id: 'Microsoft.WindowsCamera', name: 'Camera' },
    { id: 'Microsoft.SkypeApp', name: 'Skype' },
    { id: 'Microsoft.People', name: 'People' },
    { id: 'Microsoft.WindowsMaps', name: 'Maps' }
  ];
}

// Προσθήκη του get-default-debloat-tasks handler (legacy instance 1)
// Ensure previous handlers are removed before re-registering
ipcMain.removeHandler('get-default-debloat-tasks');
ipcMain.handle('get-default-debloat-tasks', async () => {
  return {
    selectedTasks: [
      'removePreinstalledApps',
      'disableTelemetry',
      'disableActivityHistory', 
      'disableTipsSuggestions',
      'disableCortana',
      'disableLocationServices',
      'disableAdvertisingID',
      'disableTelemetryHost',
      'disableBackgroundApps',
      'disableBingSearch',
      'disableCopilot',
      'disableRemoteAssistance',
      'disableRemoteDesktop',
      'showFileExtensions',
      'restoreClassicContextMenu',
      'enablePerformanceTweaks',
      'disableAnimations',
      'disableGameBar',
      'disableOneDrive'
    ],
    removeApps: [
      'Microsoft.BingNews',
      'Microsoft.BingWeather',
      'Microsoft.Getstarted',
      'Microsoft.MicrosoftSolitaireCollection',
      'Microsoft.YourPhone',
      'Microsoft.TikTok',
      'Clipchamp.Clipchamp',
      'Microsoft.XboxApp',
      'Microsoft.XboxIdentityProvider',
      'Microsoft.XboxGamingOverlay',
      'Microsoft.WindowsSoundRecorder',
      'Microsoft.QuickAssist',
      'Microsoft.PowerAutomateDesktop',
      'Microsoft.OutlookForWindows',
      'Microsoft.Todos',
      'Microsoft.MicrosoftTeams',
      'Microsoft.GamingApp',
      'Microsoft.Bing',
      'Microsoft.ZuneMusic',
      'Microsoft.WindowsFeedbackHub',
      'Microsoft.SkypeApp',
      'Microsoft.People',
      'Microsoft.WindowsCamera',
      'Microsoft.WindowsAlarms',
      'Microsoft.WindowsMaps',
      'Microsoft.Paint',
      'Microsoft.MSPaint',
      'SpotifyAB.SpotifyMusic',
      'Facebook.Facebook',
      'Instagram.Instagram',
      'Twitter.Twitter'
    ],
    searchBarMode: 0
  };
});


ipcMain.removeHandler('get-default-remove-apps');
ipcMain.handle('get-default-remove-apps', async () => {
  return [
    'Microsoft.BingNews',
    'Microsoft.BingWeather',
    'Microsoft.Getstarted',
    'Microsoft.MicrosoftSolitaireCollection', 
    'Microsoft.YourPhone',
    'Microsoft.TikTok',
    'Clipchamp.Clipchamp',
    'Microsoft.XboxApp',
    'Microsoft.XboxIdentityProvider',
    'Microsoft.XboxGamingOverlay',
    'Microsoft.WindowsSoundRecorder',
    'Microsoft.QuickAssist',
    'Microsoft.PowerAutomateDesktop',
    'Microsoft.OutlookForWindows',
    'Microsoft.Todos',
    'Microsoft.MicrosoftTeams',
    'Microsoft.GamingApp',
    'Microsoft.Bing',
    'Microsoft.ZuneMusic',
    'Microsoft.WindowsFeedbackHub',
    'Microsoft.SkypeApp',
    'Microsoft.People',
    'Microsoft.WindowsCamera',
    'Microsoft.WindowsAlarms',
    'Microsoft.WindowsMaps',
    'Microsoft.Paint',
    'Microsoft.MSPaint',
    'SpotifyAB.SpotifyMusic',
    'Facebook.Facebook',
    'Instagram.Instagram',
    'Twitter.Twitter'
  ];
});

// Helper function for fallback apps
function getFallbackApps() {
  return [
    { id: 'Microsoft.BingNews', name: 'Microsoft News' },
    { id: 'Microsoft.BingWeather', name: 'Microsoft Weather' },
    { id: 'Microsoft.Getstarted', name: 'Get Started' },
    { id: 'Microsoft.MicrosoftSolitaireCollection', name: 'Microsoft Solitaire' },
    { id: 'Microsoft.YourPhone', name: 'Your Phone' },
    { id: 'Microsoft.TikTok', name: 'TikTok' },
    { id: 'Clipchamp.Clipchamp', name: 'Clipchamp' },
    { id: 'SpotifyAB.SpotifyMusic', name: 'Spotify' },
    { id: 'Microsoft.XboxApp', name: 'Xbox' },
    { id: 'Microsoft.XboxIdentityProvider', name: 'Xbox Identity Provider' },
    { id: 'Microsoft.XboxGamingOverlay', name: 'Xbox Game Bar' },
    { id: 'Microsoft.WindowsSoundRecorder', name: 'Sound Recorder' },
    { id: 'Microsoft.QuickAssist', name: 'Quick Assist' },
    { id: 'Microsoft.PowerAutomateDesktop', name: 'Power Automate' },
    { id: 'Microsoft.Paint', name: 'Paint' },
    { id: 'Microsoft.MSPaint', name: 'Paint 3D' },
    { id: 'Microsoft.OutlookForWindows', name: 'Outlook for Windows' },
    { id: 'Microsoft.Todos', name: 'Microsoft To Do' },
    { id: 'Microsoft.MicrosoftTeams', name: 'Microsoft Teams' },
    { id: 'Microsoft.Edge', name: 'Microsoft Edge' },
    { id: 'Microsoft.GamingApp', name: 'Microsoft Gaming' },
    { id: 'Microsoft.Bing', name: 'Microsoft Bing' },
    { id: 'Microsoft.ZuneMusic', name: 'Media Player' },
    { id: 'Microsoft.WindowsFeedbackHub', name: 'Feedback Hub' },
    { id: 'Microsoft.WindowsAlarms', name: 'Clock' },
    { id: 'Microsoft.WindowsCamera', name: 'Camera' },
    { id: 'Microsoft.SkypeApp', name: 'Skype' },
    { id: 'Microsoft.People', name: 'People' },
    { id: 'Microsoft.WindowsMaps', name: 'Maps' }
  ];
}

// Προσθήκη του get-default-debloat-tasks handler
// Remove existing handler to ensure only one registration
ipcMain.removeHandler('get-default-debloat-tasks');
ipcMain.handle('get-default-debloat-tasks', async () => {
  return {
    selectedTasks: [
      'removePreinstalledApps',
      'disableTelemetry',
      'disableActivityHistory', 
      'disableTipsSuggestions',
      'disableCortana',
      'disableLocationServices',
      'disableAdvertisingID',
      'disableTelemetryHost',
      'disableBackgroundApps',
      'disableBingSearch',
      'disableCopilot',
      'disableRemoteAssistance',
      'disableRemoteDesktop',
      'showFileExtensions',
      'restoreClassicContextMenu',
      'enablePerformanceTweaks',
      'disableAnimations',
      'disableGameBar',
      'disableOneDrive'
    ],
    removeApps: [
      'Microsoft.BingNews',
      'Microsoft.BingWeather',
      'Microsoft.Getstarted',
      'Microsoft.MicrosoftSolitaireCollection',
      'Microsoft.YourPhone',
      'Microsoft.TikTok',
      'Clipchamp.Clipchamp',
      'Microsoft.XboxApp',
      'Microsoft.XboxIdentityProvider',
      'Microsoft.XboxGamingOverlay',
      'Microsoft.WindowsSoundRecorder',
      'Microsoft.QuickAssist',
      'Microsoft.PowerAutomateDesktop',
      'Microsoft.OutlookForWindows',
      'Microsoft.Todos',
      'Microsoft.MicrosoftTeams',
      'Microsoft.GamingApp',
      'Microsoft.Bing',
      'Microsoft.ZuneMusic',
      'Microsoft.WindowsFeedbackHub',
      'Microsoft.SkypeApp',
      'Microsoft.People',
      'Microsoft.WindowsCamera',
      'Microsoft.WindowsAlarms',
      'Microsoft.WindowsMaps',
      'Microsoft.Paint',
      'Microsoft.MSPaint',
      'SpotifyAB.SpotifyMusic',
      'Facebook.Facebook',
      'Instagram.Instagram',
      'Twitter.Twitter'
    ],
    searchBarMode: 0
  };
});


// Προσθέστε αυτό το handler στο main.js
// Remove any previously registered handler for this channel to avoid duplicates
ipcMain.removeHandler('get-default-remove-apps');
ipcMain.handle('get-default-remove-apps', async () => {
  return [
    'Microsoft.BingNews',
    'Microsoft.BingWeather',
    'Microsoft.Getstarted',
    'Microsoft.MicrosoftSolitaireCollection', 
    'Microsoft.YourPhone',
    'Microsoft.TikTok',
    'Clipchamp.Clipchamp',
    'Microsoft.XboxApp',
    'Microsoft.XboxIdentityProvider',
    'Microsoft.XboxGamingOverlay',
    'Microsoft.WindowsSoundRecorder',
    'Microsoft.QuickAssist',
    'Microsoft.PowerAutomateDesktop',
    'Microsoft.OutlookForWindows',
    'Microsoft.Todos',
    'Microsoft.MicrosoftTeams',
    'Microsoft.GamingApp',
    'Microsoft.Bing',
    'Microsoft.ZuneMusic',
    'Microsoft.WindowsFeedbackHub',
    'Microsoft.SkypeApp',
    'Microsoft.People',
    'Microsoft.WindowsCamera',
    'Microsoft.WindowsAlarms',
    'Microsoft.WindowsMaps',
    'Microsoft.Paint',
    'Microsoft.MSPaint',
    'SpotifyAB.SpotifyMusic',
    'Facebook.Facebook',
    'Instagram.Instagram',
    'Twitter.Twitter'
  ];
});



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
        console.log('MSI execution details:', { error, stdout, stderr });

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
    console.log('Running installer:', filePath);

    if (process.platform === 'win32') {
      // Χρήση start command για να ανοίξει το αρχείο
      const command = `start "" "${filePath}"`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log('Exec error:', error);
          resolve({ success: false, error: error.message });
        } else {
          console.log('Exec success');
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

// Αφαίρεση όλων των παλιών handlers
ipcMain.removeHandler('run-debloat-tasks');

ipcMain.handle('run-debloat-tasks', async (event, selectedTasks) => {
  if (process.platform !== 'win32') {
    return { success: false, error: 'Debloat tasks are only supported on Windows' };
  }

  return new Promise((resolve) => {
    const timeoutMs = 300000; // 5 λεπτά timeout
    const timeout = setTimeout(() => {
      resolve({
        success: false,
        error: 'Operation timed out. Please try again.',
        code: 'TIMEOUT'
      });
    }, timeoutMs);

    try {
      // Normalize input
      const config = selectedTasks || {};
      const selectedArray = Array.isArray(config.selectedTasks) ? config.selectedTasks : [];
      const removeApps = Array.isArray(config.removeApps) ? config.removeApps : [];
      const searchBarMode = Number.isInteger(config.searchBarMode) ? config.searchBarMode : null;

      console.log('Debloat config received:', {
        selectedTasks: selectedArray,
        removeApps: removeApps,
        searchBarMode: searchBarMode
      });

      // Build PowerShell script
      let psScript = `
# Windows Debloat Script
# Generated by MakeYourLifeEasier App

Write-Host "=== WINDOWS DEBLOAT TOOL ===" -ForegroundColor Cyan
Write-Host "Starting debloat operations..." -ForegroundColor Yellow
Write-Host ""

function Execute-Task {
    param([string]$TaskName, [scriptblock]$ScriptBlock)
    
    Write-Host "Executing: $TaskName" -ForegroundColor Yellow
    try {
        & $ScriptBlock
        Write-Host "✓ $TaskName completed" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "✗ $TaskName failed: $_" -ForegroundColor Red
        return $false
    }
    Write-Host ""
}
`;

      // Add selected tasks
      if (selectedArray.includes('removePreinstalledApps') && removeApps.length > 0) {
        psScript += `
# Remove preinstalled apps
Execute-Task "Remove Preinstalled Apps" {
    $appsToRemove = @(${removeApps.map(app => `"${app}"`).join(', ')})
    foreach ($app in $appsToRemove) {
        Write-Host "  Removing: $app" -ForegroundColor Gray
        try {
            # Remove for current user
            Get-AppxPackage -Name "*$app*" -ErrorAction SilentlyContinue | Remove-AppxPackage -ErrorAction SilentlyContinue
            # Remove for all users
            Get-AppxPackage -AllUsers -Name "*$app*" -ErrorAction SilentlyContinue | Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue
            # Remove provisioned packages
            Get-AppxProvisionedPackage -Online | Where-Object { $_.DisplayName -like "*$app*" } | Remove-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue
            Write-Host "    ✓ Removed: $app" -ForegroundColor Green
        } catch {
            Write-Host "    ⚠️ Could not remove: $app" -ForegroundColor Yellow
        }
    }
}
`;
      }

      if (selectedArray.includes('disableTelemetry')) {
        psScript += `
# Disable telemetry
Execute-Task "Disable Telemetry" {
    New-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" -Name "AllowTelemetry" -Value 0 -PropertyType DWord -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\DataCollection" -Name "AllowTelemetry" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
}
`;
      }

      if (selectedArray.includes('disableCortana')) {
        psScript += `
# Disable Cortana
Execute-Task "Disable Cortana" {
    New-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search" -Name "AllowCortana" -Value 0 -PropertyType DWord -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search" -Name "AllowCortana" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
}
`;
      }

      if (selectedArray.includes('showFileExtensions')) {
        psScript += `
# Show file extensions
Execute-Task "Show File Extensions" {
    New-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" -Name "HideFileExt" -Value 0 -PropertyType DWord -Force -ErrorAction SilentlyContinue
}
`;
      }

      if (selectedArray.includes('disableBingSearch')) {
        psScript += `
# Disable Bing search
Execute-Task "Disable Bing Search" {
    New-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search" -Name "BingSearchEnabled" -Value 0 -PropertyType DWord -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search" -Name "CortanaConsent" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
}
`;
      }

      if (selectedArray.includes('disableOneDrive')) {
        psScript += `
# Disable OneDrive
Execute-Task "Disable OneDrive" {
    # Kill OneDrive process
    taskkill /f /im OneDrive.exe /t 2>&1 | Out-Null
    # Uninstall OneDrive
    %SystemRoot%\\SysWOW64\\OneDriveSetup.exe /uninstall 2>&1 | Out-Null
    # Remove from startup
    Remove-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" -Name "OneDrive" -ErrorAction SilentlyContinue
}
`;
      }

      if (selectedArray.includes('disableGameBar')) {
        psScript += `
# Disable Xbox Game Bar
Execute-Task "Disable Xbox Game Bar" {
    New-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" -Name "AppCaptureEnabled" -Value 0 -PropertyType DWord -Force -ErrorAction SilentlyContinue
    New-ItemProperty -Path "HKCU:\\System\\GameConfigStore" -Name "GameDVR_Enabled" -Value 0 -PropertyType DWord -Force -ErrorAction SilentlyContinue
}
`;
      }

      // Search bar mode setting
      if (searchBarMode !== null) {
        psScript += `
# Set search bar mode
Execute-Task "Set Search Bar Mode" {
    New-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search" -Name "SearchBoxTaskbarMode" -Value ${searchBarMode} -PropertyType DWord -Force -ErrorAction SilentlyContinue
}
`;
      }

      // Final script section
      psScript += `
Write-Host ""
Write-Host "=== DEBLOAT OPERATIONS COMPLETED ===" -ForegroundColor Cyan
Write-Host "All operations finished!" -ForegroundColor Green
Write-Host "Some changes may require a restart to take full effect." -ForegroundColor Yellow

# Restart Explorer to apply UI changes
Write-Host "Restarting Explorer to apply changes..." -ForegroundColor Yellow
try {
    Stop-Process -Name "explorer" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "✓ Explorer restarted" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Could not restart Explorer" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Debloat process completed successfully!" -ForegroundColor Green
exit 0
`;

      // Execute the script with elevation
      const psFile = path.join(os.tmpdir(), `debloat_${Date.now()}.ps1`);
      fs.writeFileSync(psFile, psScript, 'utf8');
      
      // Escape backslashes and double quotes in the temp script path. Failure to escape
      // backslashes may result in malformed paths (e.g. "AppData\Loca]") when the
      // command string is parsed by PowerShell.
      const escapedPsFile = psFile
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
      const command = `Start-Process -FilePath "powershell.exe" -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File "${escapedPsFile}"' -Verb RunAs -WindowStyle Normal -Wait`;
      
      const child = spawn('powershell.exe', ['-Command', command], {
        windowsHide: false,
        timeout: timeoutMs - 30000
      });

      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
        console.log('Debloat Output:', data.toString());
      });

      child.stderr.on('data', (data) => {
        output += data.toString();
        console.error('Debloat Error:', data.toString());
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        try { if (fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) {}
        
        if (err.message.includes('denied')) {
          resolve({
            success: false,
            error: 'Administrator privileges required. Please accept the UAC prompt.',
            code: 'UAC_DENIED'
          });
        } else {
          resolve({
            success: false,
            error: 'Failed to start debloat process: ' + err.message,
            code: 'PROCESS_ERROR'
          });
        }
      });

      child.on('exit', (code) => {
        clearTimeout(timeout);
        try { if (fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) {}
        
        if (code === 0) {
          resolve({
            success: true,
            message: 'Debloat tasks completed successfully! Some changes may require restart.',
            output: output
          });
        } else {
          resolve({
            success: false,
            error: 'Debloat process exited with errors. Please check the UAC prompt.',
            output: output
          });
        }
      });

    } catch (err) {
      clearTimeout(timeout);
      resolve({
        success: false,
        error: 'Failed to initiate debloat: ' + err.message,
        code: 'INIT_ERROR'
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
    console.error('Error resetting password manager:', error);
    return { success: false, error: error.message };
  }
});