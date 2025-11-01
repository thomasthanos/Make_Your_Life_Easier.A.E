const { app, BrowserWindow, ipcMain, shell, nativeTheme, dialog } = require('electron');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const http = require('http');
const https = require('https');

// Password Manager imports
const PasswordManagerAuth = require('./password-manager/auth');
const PasswordManagerDB = require('./password-manager/database');

// Constants
const DOCUMENTS_PATH = path.join(os.homedir(), 'Documents');
const PM_DIRECTORY = path.join(DOCUMENTS_PATH, 'MakeYourLifeEasier');
const DOWNLOADS_DIR = path.join(os.homedir(), 'Downloads');

// OAuth Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '389774067739-qnshev3gbck4firdc787iqhd44omiajs.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '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';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5252';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1329887230482845797';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'ZPK2i6WmbGnBhv7LmyzLwTOoKbaH8nDV';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5252';

// Global variables
let mainWindow = null;
let userProfile = null;
let oauthConfig = {};
const activeDownloads = new Map();
const completedDownloads = new Set();

// Update variables
let updateAvailable = false;
let isManualCheck = false;
let updateDownloaded = false;

// Password Manager
const pmAuth = new PasswordManagerAuth();

// Default configurations
const DEFAULT_REMOVE_APPS = [
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

const DEFAULT_DEBLOAT_CONFIG = {
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
    removeApps: DEFAULT_REMOVE_APPS,
    searchBarMode: 0
};

// App Configuration
app.commandLine.appendSwitch('enable-features', 'WebContentsForceDark');
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Utility Functions
function stripAnsiCodes(str) {
    return str.replace(/\u001b\[[0-?]*[ -\/]*[@-~]/g, '');
}

function sanitizeName(name) {
    return String(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function extFromUrl(url) {
    const match = String(url).match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match ? `.${match[1]}` : '.bin';
}

function clientFor(url) {
    return url.startsWith('https:') ? https : http;
}

function expandEnv(input) {
    return String(input).replace(/%([^%]+)%/g, (match, name) => {
        const value = process.env[name];
        return typeof value === 'string' ? value : match;
    });
}

// File System Utilities
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// User Profile Management
const getUserProfilePath = () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'userProfile.json');
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
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    } catch (err) {
        console.warn('Failed to save user profile:', err);
    }
}

// OAuth Configuration Management
function loadOAuthConfig() {
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
}

// Network Utilities
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

// Window Management
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
    
    // Check for updates after window is ready
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
    return passwordWindow;
}

// OAuth Window Management
function openAuthWindow(authUrl, redirectUri, handleCallback) {
    return new Promise((resolve, reject) => {
        if (!mainWindow) {
            reject(new Error('Main window not available'));
            return;
        }

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

        function isGoogleOAuth(url) {
            return url.includes('accounts.google.com') || url.includes('google.com/oauth');
        }

        function applyDarkModeIfGoogle() {
            const currentUrl = authWindow.webContents.getURL();
            
            if (isGoogleOAuth(currentUrl)) {
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
                    .wehrve:focus, .wehrve:hover, 
                    .mTkos:focus, .mTkos:hover,
                    .TrZEUc:focus, .TrZEUc:hover,
                    .JnOM6e:focus, .JnOM6e:hover {
                        background-color: #1a1c1e !important;
                    }
                `);
                
                authWindow.webContents.executeJavaScript(`
                    document.body.style.backgroundColor = '#202124';
                    document.body.style.color = '#e8eaed';
                    
                    const allDivs = document.querySelectorAll('div');
                    allDivs.forEach(div => {
                        div.style.backgroundColor = '#202124';
                        div.style.color = '#e8eaed';
                    });
                    
                    const allForms = document.querySelectorAll('form');
                    allForms.forEach(form => {
                        form.style.backgroundColor = '#202124';
                        form.style.color = '#e8eaed';
                    });
                    
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

        authWindow.webContents.once('did-finish-load', () => {
            applyDarkModeIfGoogle();
        });

        authWindow.webContents.on('did-navigate', () => {
            setTimeout(() => {
                applyDarkModeIfGoogle();
            }, 100);
        });

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

// 7-Zip Management
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

// App Initialization
function initializeApp() {
    ensureDirectoryExists(PM_DIRECTORY);
    pmAuth.initialize(PM_DIRECTORY);
    loadOAuthConfig();
    loadUserProfile();
}

// Cleanup Management
function cleanupDownloads() {
    try {
        for (const filePath of completedDownloads) {
            try {
                if (fs.existsSync(filePath)) {
                    const stat = fs.lstatSync(filePath);
                    if (stat.isDirectory()) {
                        fs.rmSync(filePath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(filePath);
                    }
                }
            } catch (err) {
                console.warn('Failed to delete temporary download', filePath, err);
            }
        }
        completedDownloads.clear();
    } catch (e) {
        console.warn('Error during cleanup on exit:', e);
    }
}

function cleanupActiveDownloads() {
    for (const [id, download] of activeDownloads) {
        try {
            if (download.response) download.response.destroy();
            if (download.file) download.file.destroy();
        } catch (err) {
            console.warn('Error cleaning up download', id, err);
        }
    }
    activeDownloads.clear();
}

// Event Handlers
app.whenReady().then(() => {
    initializeApp();
    createWindow();
    
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    cleanupActiveDownloads();
    cleanupDownloads();
});

app.on('before-quit', () => {
    cleanupActiveDownloads();
});

// Auto Updater Events
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

// IPC Handlers

// System Information
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

// Authentication Handlers
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
        const profile = await getJson('https://discord.com/api/users/@me', {
            Authorization: `Bearer ${accessToken}`
        });
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

// File Operations
ipcMain.handle('show-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'Executables', extensions: ['exe'] }
        ]
    });
    return result;
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

ipcMain.handle('run-command', async (event, command) => {
    return new Promise((resolve) => {
        exec(command, (error, stdout, stderr) => {
            if (error) resolve({ error: error.message, stdout, stderr });
            else resolve({ stdout, stderr });
        });
    });
});

// Download Management
ipcMain.on('download-start', (event, { id, url, dest }) => {
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
            const finalPath = path.join(DOWNLOADS_DIR, finalName);
            const tempPath = finalPath + '.part';
            try {
                if (fs.existsSync(finalPath)) {
                    fs.unlinkSync(finalPath);
                }
            } catch (err) {
                // Ignore errors
            }
            try {
                const baseNameWithoutExt = path.basename(finalName, path.extname(finalName));
                const extractDir = path.join(DOWNLOADS_DIR, baseNameWithoutExt);
                if (fs.existsSync(extractDir)) {
                    fs.rmSync(extractDir, { recursive: true, force: true });
                }
                const altExtractDir = extractDir.replace(/_/g, ' ');
                if (altExtractDir !== extractDir && fs.existsSync(altExtractDir)) {
                    fs.rmSync(altExtractDir, { recursive: true, force: true });
                }
            } catch (err) {
                // Ignore errors
            }
            const total = parseInt(res.headers['content-length'] || '0', 10);
            const file = fs.createWriteStream(tempPath);
            const downloadData = { response: res, file, total, received: 0, paused: false, filePath: tempPath, finalPath };
            activeDownloads.set(id, downloadData);
            mainWindow.webContents.send('download-event', { id, status: 'started', total });
            const cleanup = (errMsg) => {
                try { res.destroy(); } catch { }
                try { file.destroy(); } catch { }
                try { fs.unlink(tempPath, () => { }); } catch { }
                activeDownloads.delete(id);
                if (errMsg) mainWindow.webContents.send('download-event', { id, status: 'error', error: errMsg });
            };
            res.on('data', (chunk) => {
                if (downloadData.paused) return;
                downloadData.received += chunk.length;
                if (total) {
                    const percent = Math.round((downloadData.received / total) * 100);
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
    const downloadData = activeDownloads.get(id);
    if (downloadData && downloadData.response) {
        downloadData.paused = true;
        try { downloadData.response.pause(); } catch { }
        mainWindow.webContents.send('download-event', { id, status: 'paused' });
    }
});

ipcMain.on('download-resume', (event, id) => {
    const downloadData = activeDownloads.get(id);
    if (downloadData && downloadData.response) {
        downloadData.paused = false;
        try { downloadData.response.resume(); } catch { }
        mainWindow.webContents.send('download-event', { id, status: 'resumed' });
    }
});

ipcMain.on('download-cancel', (event, id) => {
    const downloadData = activeDownloads.get(id);
    if (downloadData) {
        try { if (downloadData.response) downloadData.response.destroy(); } catch { }
        try { if (downloadData.file) downloadData.file.destroy(); } catch { }
        try { if (downloadData.filePath) fs.unlink(downloadData.filePath, () => { }); } catch { }
        activeDownloads.delete(id);
        mainWindow.webContents.send('download-event', { id, status: 'cancelled' });
    }
});

// File Operations
ipcMain.handle('replace-exe', async (event, { sourcePath, destPath }) => {
    return new Promise((resolve) => {
        try {
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
            try {
                completedDownloads.add(outDir);
            } catch (e) {
                console.warn('Failed to record extraction directory for cleanup:', e);
            }
        } catch (e) {
            // Ignore errors
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

// Installer Management
ipcMain.handle('open-installer', async (event, filePath) => {
    await shell.openPath(filePath);
    return { success: true };
});

ipcMain.handle('run-installer', async (event, filePath) => {
    return new Promise((resolve) => {
        console.log('Running installer:', filePath);

        if (!fs.existsSync(filePath)) {
            resolve({ success: false, error: 'File not found' });
            return;
        }

        if (process.platform === 'win32') {
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

ipcMain.handle('run-msi-installer', async (event, msiPath) => {
    return new Promise((resolve) => {
        if (process.platform !== 'win32') {
            resolve({ success: false, error: 'MSI installers are only supported on Windows' });
            return;
        }

        if (!fs.existsSync(msiPath)) {
            resolve({ success: false, error: 'MSI file not found' });
            return;
        }

        const command = `msiexec /i "${msiPath}"`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.log('MSI execution details:', { error, stdout, stderr });
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
                    // Ignore directory errors
                }
            }

            searchDirectory(directoryPath);
            resolve(executableFiles);
        } catch (error) {
            resolve([]);
        }
    });
});

// Spotify/Spicetify Management
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

// System Maintenance
ipcMain.handle('run-sfc-scan', async () => {
    if (process.platform !== 'win32') {
        return { success: false, error: 'SFC is only available on Windows' };
    }
    return new Promise((resolve) => {
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
            const psCommand = `Start-Process -FilePath \"powershell.exe\" -ArgumentList '-ExecutionPolicy Bypass -File \"${escapedPsFile}\"' -Verb RunAs -WindowStyle Normal -Wait`;
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
    if (process.platform !== 'win32') {
        return { success: false, error: 'DISM is only available on Windows' };
    }
    return new Promise((resolve) => {
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
            const psCommand = `Start-Process -FilePath \"powershell.exe\" -ArgumentList '-ExecutionPolicy Bypass -File \"${escapedPsFile}\"' -Verb RunAs -WindowStyle Normal -Wait`;
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
    if (process.platform !== 'win32') {
        return { success: false, error: 'This feature is only available on Windows' };
    }
    return new Promise((resolve) => {
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
`;
        try {
            const psFile = path.join(os.tmpdir(), `temp_cleanup_${Date.now()}.ps1`);
            fs.writeFileSync(psFile, psScript, 'utf8');
            const escapedPsFile = psFile.replace(/"/g, '\\"');
            const psCommand = `Start-Process -FilePath \"powershell.exe\" -ArgumentList '-ExecutionPolicy Bypass -File \"${escapedPsFile}\"' -Verb RunAs -WindowStyle Hidden -Wait`;
            const child = spawn('powershell.exe', ['-Command', psCommand], { windowsHide: true });
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
            try { if (typeof psFile !== 'undefined' && fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch (_) {}
            resolve({ success: false, error: 'Failed to start temp files cleanup: ' + err.message });
        }
    });
});

ipcMain.handle('restart-to-bios', async () => {
    return new Promise((resolve) => {
        const tempDir = os.tmpdir();
        const vbsPath = path.join(tempDir, 'bios_restart.vbs');
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

// Windows Debloat
ipcMain.handle('get-preinstalled-apps', async () => {
    if (process.platform !== 'win32') {
        return [];
    }

    return new Promise((resolve) => {
        const psScript = `
try {
    $allPackages = Get-AppxPackage | Where-Object { 
        $_.NonRemovable -eq $false -and 
        $_.SignatureKind -eq "Store" -and
        $_.IsFramework -eq $false
    }
    
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
                    if (result && typeof result === 'object' && result.categories) {
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
                                    let name;
                                    if (friendlyNames[id]) {
                                        name = friendlyNames[id];
                                    } else if (baseName && baseName !== id) {
                                        name = baseName;
                                    } else {
                                        name = deriveName(id);
                                    }
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
                            if (typeof name === 'string' && /^\d+$/.test(name.trim())) {
                                return null;
                            }
                            return { id, name };
                        }).filter(Boolean);
                        resolve(list);
                        return;
                    }
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

ipcMain.handle('get-default-remove-apps', async () => {
    return DEFAULT_REMOVE_APPS;
});

ipcMain.handle('get-default-debloat-tasks', async () => {
    return DEFAULT_DEBLOAT_CONFIG;
});

ipcMain.handle('run-debloat-tasks', async (event, selectedTasks) => {
    if (process.platform !== 'win32') {
        return { success: false, error: 'Debloat tasks are only supported on Windows' };
    }

    return new Promise((resolve) => {
        const timeoutMs = 300000; // 5 minutes timeout
        const timeout = setTimeout(() => {
            resolve({
                success: false,
                error: 'Operation timed out. Please try again.',
                code: 'TIMEOUT'
            });
        }, timeoutMs);

        try {
            const config = selectedTasks || {};
            const selectedArray = Array.isArray(config.selectedTasks) ? config.selectedTasks : [];
            const removeApps = Array.isArray(config.removeApps) ? config.removeApps : [];
            const searchBarMode = Number.isInteger(config.searchBarMode) ? config.searchBarMode : null;

            console.log('Debloat config received:', {
                selectedTasks: selectedArray,
                removeApps: removeApps,
                searchBarMode: searchBarMode
            });

            // Build PowerShell script dynamically based on selected tasks
            let psScript = `
# Windows Debloat Script
# Generated by MakeYourLifeEasier App

Write-Host "=== WINDOWS DEBLOAT TOOL ===" -ForegroundColor Cyan
Write-Host "Starting debloat operations..." -ForegroundColor Yellow
Write-Host ""

\$ErrorActionPreference = "Continue"
\$ProgressPreference = "SilentlyContinue"

function Write-TaskResult {
    param([string]\$Message, [bool]\$Success)
    if (\$Success) {
        Write-Host "  ✓ \$Message" -ForegroundColor Green
    } else {
        Write-Host "  ✗ \$Message" -ForegroundColor Red
    }
}

function Execute-Task {
    param([string]\$TaskName, [scriptblock]\$ScriptBlock)
    
    Write-Host "Executing: \$TaskName" -ForegroundColor Yellow
    try {
        \$result = & \$ScriptBlock
        Write-TaskResult -Message "\$TaskName completed" -Success \$true
        return \$true
    } catch {
        Write-TaskResult -Message "\$TaskName failed: \$_" -Success \$false
        return \$false
    }
}
`;

            // Remove preinstalled apps
            if (selectedArray.includes('removePreinstalledApps') && removeApps.length > 0) {
                psScript += `
# Remove preinstalled apps
Execute-Task "Remove Preinstalled Apps" {
    \$appsToRemove = @(${removeApps.map(app => `"${app}"`).join(', ')})
    \$removedCount = 0
    
    foreach (\$app in \$appsToRemove) {
        Write-Host "    Removing: \$app" -ForegroundColor Gray
        try {
            # Remove for current user
            \$packages = Get-AppxPackage -Name "*\$app*" -ErrorAction SilentlyContinue
            if (\$packages) {
                \$packages | Remove-AppxPackage -ErrorAction SilentlyContinue
            }
            
            # Remove for all users
            \$allUserPackages = Get-AppxPackage -AllUsers -Name "*\$app*" -ErrorAction SilentlyContinue
            if (\$allUserPackages) {
                \$allUserPackages | Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue
            }
            
            # Remove provisioned packages
            \$provisioned = Get-AppxProvisionedPackage -Online | Where-Object { \$_.DisplayName -like "*\$app*" }
            if (\$provisioned) {
                \$provisioned | ForEach-Object {
                    try {
                        Remove-AppxProvisionedPackage -Online -PackageName \$_.PackageName -ErrorAction SilentlyContinue
                    } catch {
                        # Ignore errors for provisioned packages
                    }
                }
            }
            
            \$removedCount++
            Write-Host "      ✓ Removed: \$app" -ForegroundColor Green
        } catch {
            Write-Host "      ⚠️ Could not remove: \$app" -ForegroundColor Yellow
        }
    }
    Write-Host "    Total apps removed: \$removedCount/\$(\$appsToRemove.Count)" -ForegroundColor Cyan
}
`;
            }

            // Registry modifications for various tasks
            if (selectedArray.includes('disableTelemetry')) {
                psScript += `
# Disable telemetry
Execute-Task "Disable Telemetry" {
    New-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" -Name "AllowTelemetry" -Value 0 -PropertyType DWord -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\DataCollection" -Name "AllowTelemetry" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\DataCollection" -Name "MaxTelemetryAllowed" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
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
    New-ItemProperty -Path "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search" -Name "BingSearchEnabled" -Value 0 -PropertyType DWord -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -Path "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Search" -Name "CortanaConsent" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
}
`;
            }

            if (selectedArray.includes('disableOneDrive')) {
                psScript += `
# Disable OneDrive
Execute-Task "Disable OneDrive" {
    # Stop OneDrive process
    Stop-Process -Name "OneDrive" -Force -ErrorAction SilentlyContinue
    Stop-Process -Name "OneDriveSetup" -Force -ErrorAction SilentlyContinue
    
    # Uninstall OneDrive
    if (Test-Path "\$env:SystemRoot\\SysWOW64\\OneDriveSetup.exe") {
        Start-Process "\$env:SystemRoot\\SysWOW64\\OneDriveSetup.exe" -ArgumentList "/uninstall" -Wait -ErrorAction SilentlyContinue
    }
    
    # Remove from startup
    Remove-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" -Name "OneDrive" -ErrorAction SilentlyContinue
    
    # Remove OneDrive folder
    \$oneDrivePath = "\$env:USERPROFILE\\OneDrive"
    if (Test-Path \$oneDrivePath) {
        Remove-Item -Path \$oneDrivePath -Recurse -Force -ErrorAction SilentlyContinue
    }
}
`;
            }

            if (selectedArray.includes('disableGameBar')) {
                psScript += `
# Disable Xbox Game Bar
Execute-Task "Disable Xbox Game Bar" {
    New-ItemProperty -Path "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR" -Name "AppCaptureEnabled" -Value 0 -PropertyType DWord -Force -ErrorAction SilentlyContinue
    New-ItemProperty -Path "HKCU:\\System\\GameConfigStore" -Name "GameDVR_Enabled" -Value 0 -PropertyType DWord -Force -ErrorAction SilentlyContinue
}
`;
            }

            // Search bar mode configuration
            if (searchBarMode !== null) {
                psScript += `
# Set search bar mode
Execute-Task "Set Search Bar Mode" {
    New-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search" -Name "SearchBoxTaskbarMode" -Value ${searchBarMode} -PropertyType DWord -Force -ErrorAction SilentlyContinue
}
`;
            }

            // Add additional tasks here based on your DEFAULT_DEBLOAT_CONFIG
            if (selectedArray.includes('disableActivityHistory')) {
                psScript += `
# Disable Activity History
Execute-Task "Disable Activity History" {
    New-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System" -Name "PublishUserActivities" -Value 0 -PropertyType DWord -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System" -Name "PublishUserActivities" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
}
`;
            }

            if (selectedArray.includes('disableTipsSuggestions')) {
                psScript += `
# Disable Tips and Suggestions
Execute-Task "Disable Tips and Suggestions" {
    New-ItemProperty -Path "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" -Name "ContentDeliveryAllowed" -Value 0 -PropertyType DWord -Force -ErrorAction SilentlyContinue
    New-ItemProperty -Path "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" -Name "OemPreInstalledAppsEnabled" -Value 0 -PropertyType DWord -Force -ErrorAction SilentlyContinue
    New-ItemProperty -Path "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" -Name "PreInstalledAppsEnabled" -Value 0 -PropertyType DWord -Force -ErrorAction SilentlyContinue
    New-ItemProperty -Path "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" -Name "SilentInstalledAppsEnabled" -Value 0 -PropertyType DWord -Force -ErrorAction SilentlyContinue
    New-ItemProperty -Path "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" -Name "SubscribedContent-338387Enabled" -Value 0 -PropertyType DWord -Force -ErrorAction SilentlyContinue
}
`;
            }

            // Final script section
            psScript += `
Write-Host ""
Write-Host "=== DEBLOAT OPERATIONS COMPLETED ===" -ForegroundColor Cyan
Write-Host "All operations finished!" -ForegroundColor Green
Write-Host "Some changes may require a restart to take full effect." -ForegroundColor Yellow

Write-Host "Restarting Explorer to apply changes..." -ForegroundColor Yellow
try {
    Stop-Process -Name "explorer" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    Write-Host "✓ Explorer restarted successfully" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Could not restart Explorer" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== DEBLOAT PROCESS COMPLETED SUCCESSFULLY ===" -ForegroundColor Green
Write-Host "All selected tasks have been executed." -ForegroundColor White
exit 0
`;

            // Write PowerShell script to temporary file
            const psFile = path.join(os.tmpdir(), `debloat_${Date.now()}.ps1`);
            fs.writeFileSync(psFile, psScript, 'utf8');
            
            console.log('PowerShell script created at:', psFile);
            
            // Execute with elevated privileges
            const escapedPsFile = psFile.replace(/"/g, '\\"');
            const command = `Start-Process -FilePath "powershell.exe" -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File "${escapedPsFile}"' -Verb RunAs -WindowStyle Normal -Wait`;
            
            console.log('Executing command:', command);
            
            const child = spawn('powershell.exe', ['-Command', command], {
                windowsHide: false,
                timeout: timeoutMs - 30000
            });

            let output = '';
            let errorOutput = '';

            child.stdout.on('data', (data) => {
                const text = data.toString();
                output += text;
                console.log('Debloat Output:', text);
            });

            child.stderr.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                console.error('Debloat Error:', text);
            });

            child.on('error', (err) => {
                clearTimeout(timeout);
                try { 
                    if (fs.existsSync(psFile)) fs.unlinkSync(psFile); 
                } catch (_) {}
                
                console.error('Child process error:', err);
                
                if (err.message.includes('denied') || err.code === 'UAC_DENIED') {
                    resolve({
                        success: false,
                        error: 'Administrator privileges required. Please accept the UAC prompt to run debloat tasks.',
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

            child.on('exit', (code, signal) => {
                clearTimeout(timeout);
                try { 
                    if (fs.existsSync(psFile)) fs.unlinkSync(psFile); 
                } catch (_) {}
                
                console.log(`Debloat process exited with code: ${code}, signal: ${signal}`);
                
                const fullOutput = output + errorOutput;
                
                if (code === 0) {
                    resolve({
                        success: true,
                        message: 'Debloat tasks completed successfully! Some changes may require a system restart to take full effect.',
                        output: fullOutput,
                        code: 'SUCCESS'
                    });
                } else {
                    resolve({
                        success: false,
                        error: `Debloat process exited with code ${code}. Please check if you accepted the UAC prompt and try again.`,
                        output: fullOutput,
                        code: 'EXIT_WITH_ERROR'
                    });
                }
            });

        } catch (err) {
            clearTimeout(timeout);
            console.error('Error in debloat handler:', err);
            resolve({
                success: false,
                error: 'Failed to initiate debloat process: ' + err.message,
                code: 'INIT_ERROR'
            });
        }
    });
});

// Password Manager Handlers
ipcMain.handle('open-password-manager', async () => {
    createPasswordManagerWindow();
    return { success: true };
});

ipcMain.handle('password-manager-has-master-password', async () => {
    try {
        console.log('Checking for master password...');
        if (!pmAuth.configPath) {
            console.log('Auth manager not initialized, initializing now...');
            pmAuth.initialize(PM_DIRECTORY);
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
            pmAuth.initialize(PM_DIRECTORY);
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
            pmAuth.initialize(PM_DIRECTORY);
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
        pmAuth.initialize();
        return { success: true };
    } catch (error) {
        console.error('Error resetting password manager:', error);
        return { success: false, error: error.message };
    }
});

// Update Management
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

// Legacy Handlers (for compatibility)
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

console.log('✅ Main process initialized successfully!');