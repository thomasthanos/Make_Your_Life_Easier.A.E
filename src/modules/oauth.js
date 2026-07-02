/**
 * OAuth Module
 * Handles OAuth authentication flows for Google and Discord
 */

const { BrowserWindow, BrowserView } = require('electron');
const { supabase } = require('./supabase');

const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'http://localhost:5252';

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
        const expected = new URL(redirectUri);
        const isValid = target.origin === expected.origin && target.pathname === expected.pathname;
        if (!settled && isValid) {
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
 * Map a Supabase session user to the app's profile shape
 * @param {Object} user - Supabase auth user
 * @param {string} provider - 'google' or 'discord'
 * @returns {Object}
 */
function toProfile(user, provider) {
  const meta = (user && user.user_metadata) || {};
  return {
    name: meta.full_name || meta.name || meta.user_name || user?.email || 'User',
    avatar: meta.avatar_url || meta.picture || null,
    provider
  };
}

/**
 * Run an OAuth login through Supabase for the given provider
 * @param {string} provider - 'google' or 'discord'
 * @param {BrowserWindow} parentWindow - Parent window reference
 * @returns {Promise<Object|null>}
 */
async function loginWith(provider, parentWindow) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: REDIRECT_URI, skipBrowserRedirect: true }
  });

  if (error) throw new Error(error.message);
  if (!data?.url) throw new Error(`Failed to start ${provider} OAuth`);

  return openAuthWindow(data.url, REDIRECT_URI, async (redirectUrl) => {
    const code = redirectUrl.searchParams.get('code');
    const oauthError = redirectUrl.searchParams.get('error_description') || redirectUrl.searchParams.get('error');

    if (oauthError) throw new Error(oauthError);
    if (!code) throw new Error('No authorization code received');

    const { data: exchange, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw new Error(exchangeError.message);

    const user = exchange?.session?.user;
    if (!user) throw new Error('Failed to obtain Supabase session');

    return toProfile(user, provider);
  }, parentWindow);
}

/**
 * Perform Google OAuth login via Supabase
 * @param {BrowserWindow} parentWindow - Parent window reference
 * @returns {Promise<Object|null>}
 */
function loginGoogle(parentWindow) {
  return loginWith('google', parentWindow);
}

/**
 * Perform Discord OAuth login via Supabase
 * @param {BrowserWindow} parentWindow - Parent window reference
 * @returns {Promise<Object|null>}
 */
function loginDiscord(parentWindow) {
  return loginWith('discord', parentWindow);
}

module.exports = {
  openAuthWindow,
  loginGoogle,
  loginDiscord,
  toProfile
};
