/**
 * OAuth Module
 * Handles OAuth authentication flows for Google and Discord
 */

const { BrowserWindow, BrowserView } = require('electron');
const { postForm, getJson } = require('./http-utils');

// OAuth credentials
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '389774067739-qnshev3gbck4firdc787iqhd44omiajs.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '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';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5252';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1329887230482845797';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'ZPK2i6WmbGnBhv7LmyzLwTOoKbaH8nDV';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5252';

/**
 * Open an OAuth authentication window
 * @param {string} authUrl - The OAuth authorization URL
 * @param {string} redirectUri - The redirect URI to watch for
 * @param {Function} handleCallback - Callback to handle the redirect
 * @param {BrowserWindow} parentWindow - Parent window reference
 * @returns {Promise<Object|null>}
 */
function openAuthWindow(authUrl, redirectUri, handleCallback, parentWindow) {
  return new Promise((resolve, reject) => {
    let settled = false;  // Prevent double resolution race condition

    const windowOpts = {
      width: 600,
      height: 700,
      show: true,
      parent: parentWindow,
      modal: true,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    };
    
    const authWindow = new BrowserWindow(windowOpts);

    // Create loader view
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
      } catch { }
    };
    
    authWindow.webContents.once('did-finish-load', removeLoaderView);
    authWindow.once('closed', removeLoaderView);

    const cleanup = () => {
      if (!authWindow.isDestroyed()) authWindow.close();
    };

    function handleUrl(url) {
      try {
        const target = new URL(url);
        if (!settled && url.startsWith(redirectUri)) {
          handleCallback(target)
            .then((result) => {
              if (settled) return;
              settled = true;
              cleanup();
              resolve(result);
            })
            .catch((err) => {
              if (settled) return;
              settled = true;
              cleanup();
              reject(err);
            });
        }
      } catch {
        // Ignore malformed URLs
      }
    }

    // Apply Discord accessibility fix
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
      } catch { }
    };

    authWindow.webContents.on('will-redirect', (event, url) => handleUrl(url));
    authWindow.webContents.on('will-navigate', (event, url) => handleUrl(url));
    authWindow.webContents.on('did-navigate', (event, url) => handleUrl(url));
    authWindow.webContents.on('did-finish-load', applyDiscordAccessibilityFix);
    authWindow.webContents.on('did-navigate', applyDiscordAccessibilityFix);
    authWindow.webContents.on('frame-loaded', applyDiscordAccessibilityFix);

    authWindow.on('closed', () => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    });

    authWindow.loadURL(authUrl);
  });
}

/**
 * Perform Google OAuth login
 * @param {BrowserWindow} parentWindow - Parent window reference
 * @returns {Promise<Object>}
 */
async function loginGoogle(parentWindow) {
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
  
  return openAuthWindow(authUrl, GOOGLE_REDIRECT_URI, async (redirectUrl) => {
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
    
    return {
      name: profile.name || profile.email || 'User',
      avatar: profile.picture || null,
      provider: 'google'
    };
  }, parentWindow);
}

/**
 * Perform Discord OAuth login
 * @param {BrowserWindow} parentWindow - Parent window reference
 * @returns {Promise<Object>}
 */
async function loginDiscord(parentWindow) {
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
  
  return openAuthWindow(authUrl, DISCORD_REDIRECT_URI, async (redirectUrl) => {
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
    
    return {
      name: profile.username + (profile.discriminator ? `#${profile.discriminator}` : ''),
      avatar: avatarUrl,
      provider: 'discord'
    };
  }, parentWindow);
}

module.exports = {
  openAuthWindow,
  loginGoogle,
  loginDiscord
};
