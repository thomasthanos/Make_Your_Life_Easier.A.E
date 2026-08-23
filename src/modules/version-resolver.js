/**
 * Version Resolver Module
 * Resolves the current download URL for vendor apps whose installer links carry
 * a version in the path. Without this, CUSTOM_APPS entries rot: the hardcoded
 * URL keeps installing whatever build was current when it was written.
 *
 * Runs in the main process on purpose — vendor sites send no CORS headers, so a
 * renderer-side fetch would be blocked.
 */

const { clientFor } = require('./http-utils');

const REQUEST_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 5;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — a bulk install shouldn't refetch per app

const USER_AGENT = 'MakeYourLifeEasier';

/**
 * GET a URL and return the body as text, following redirects
 * @param {string} url
 * @param {number} redirectsLeft
 * @returns {Promise<string>}
 */
function httpGetText(url, redirectsLeft = MAX_REDIRECTS) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, val) => { if (!settled) { settled = true; fn(val); } };

    const options = { headers: { 'User-Agent': USER_AGENT, 'Accept': '*/*' } };
    const req = clientFor(url).get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) { done(reject, new Error('Too many redirects')); return; }
        const nextUrl = new URL(res.headers.location, url).toString();
        done(resolve, httpGetText(nextUrl, redirectsLeft - 1));
        return;
      }

      if (res.statusCode !== 200) {
        res.resume();
        done(reject, new Error(`HTTP ${res.statusCode}`));
        return;
      }

      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => done(resolve, body));
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      done(reject, new Error('Request timed out after 15 seconds'));
    });

    req.on('error', (err) => done(reject, new Error('Network error: ' + err.message)));
  });
}

async function httpGetJson(url) {
  const body = await httpGetText(url);
  return JSON.parse(body);
}

/**
 * Compare two dotted version strings numerically
 * @param {string} a
 * @param {string} b
 * @returns {number} negative if a < b
 */
function compareVersions(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Pull the newest matching download link out of a vendor page
 * @param {string} html
 * @param {RegExp} pattern - global regex matching full URLs
 * @param {RegExp} [versionPattern] - captures a version from the URL for ranking
 * @returns {string|null}
 */
function pickNewestUrl(html, pattern, versionPattern) {
  const matches = [...new Set(String(html).match(pattern) || [])];
  if (!matches.length) return null;
  if (!versionPattern) return matches[0];

  return matches.sort((a, b) => {
    const va = (a.match(versionPattern) || [])[1] || '0';
    const vb = (b.match(versionPattern) || [])[1] || '0';
    return compareVersions(vb, va);
  })[0];
}

/**
 * Per-vendor strategies. Each returns `{ url, headers? }` for the current
 * installer, or null when the page/API shape changed and nothing could be
 * extracted. `headers` covers CDNs that reject requests lacking a Referer.
 */
const RESOLVERS = {
  // GeForce Experience is EOL; the NVIDIA App download page always links the current build.
  'nvidia-app': async () => {
    const html = await httpGetText('https://www.nvidia.com/en-us/software/nvidia-app/');
    const url = pickNewestUrl(
      html,
      /https:\/\/[a-z0-9.]*download\.nvidia\.com\/nvapp\/client\/[\d.]+\/NVIDIA_app_v[\d._]+\.exe/gi,
      /\/nvapp\/client\/([\d.]+)\//i
    );
    return url ? { url } : null;
  },

  // AMD's support page links the "Auto-Detect and Install" minimal setup for the
  // current release. drivers.amd.com redirects to an error page without a Referer.
  'amd-adrenalin': async () => {
    const html = await httpGetText('https://www.amd.com/en/support/download/drivers.html');
    const url = pickNewestUrl(
      html,
      /https:\/\/drivers\.amd\.com\/drivers\/installer\/[^"'<>\s]+_web\.exe/gi,
      /adrenalin-edition-([\d.]+)-/i
    );
    return url ? { url, headers: { Referer: 'https://www.amd.com/' } } : null;
  },

  'betterdiscord': async () => {
    const release = await httpGetJson('https://api.github.com/repos/BetterDiscord/Installer/releases/latest');
    const asset = (release && release.assets || []).find((a) => a.name === 'BetterDiscord-Windows.exe');
    return asset ? { url: asset.browser_download_url } : null;
  },

  'cursor': async () => {
    const data = await httpGetJson('https://cursor.com/api/download?platform=win32-x64-user&releaseTrack=stable');
    return data && data.downloadUrl ? { url: data.downloadUrl } : null;
  }
};

/**
 * Hosts each resolver is allowed to hand back a download URL for.
 *
 * The nvidia and amd resolvers pin their host in the scraping regex already; the
 * two API-driven ones did not, so whatever `downloadUrl` the vendor's JSON
 * contained was downloaded and run. Anything not on this list falls back to the
 * pinned URL rather than being fetched.
 */
const ALLOWED_DOWNLOAD_HOSTS = {
  'nvidia-app': ['nvidia.com'],
  'amd-adrenalin': ['amd.com'],
  'betterdiscord': ['github.com', 'githubusercontent.com'],
  'cursor': ['cursor.com', 'cursor.sh', 'cloudfront.net']
};

/**
 * Whether a resolved URL is one this resolver is permitted to return.
 * Matches the registrable domain or any subdomain of it — never a bare substring,
 * so `evil-cursor.com.attacker.net` does not pass as `cursor.com`.
 * @param {string} key - Resolver key
 * @param {string} url - URL the resolver produced
 * @returns {boolean} True when the URL is https and sits on an allowed host
 */
function isAllowedDownloadUrl(key, url) {
  const allowed = ALLOWED_DOWNLOAD_HOSTS[key];
  if (!allowed) return true;
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'https:') return false;
    const host = hostname.toLowerCase();
    return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

const cache = new Map();

/**
 * Resolve the current download URL for a vendor app.
 * Never throws — callers get the static fallback when the lookup fails, so an
 * offline machine or a redesigned vendor page degrades to the old behaviour.
 *
 * @param {string} key - resolver key (see RESOLVERS)
 * @param {string} fallbackUrl - static URL to use when resolution fails
 * @returns {Promise<{url: string, headers?: Object, resolved: boolean, error?: string}>}
 */
async function resolveDownloadUrl(key, fallbackUrl) {
  const resolver = RESOLVERS[key];
  if (!resolver) {
    return { url: fallbackUrl, resolved: false, error: `Unknown resolver: ${key}` };
  }

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { url: cached.url, headers: cached.headers, resolved: true };
  }

  try {
    const found = await resolver();
    if (!found || !found.url) throw new Error('No download URL found in vendor response');
    if (!isAllowedDownloadUrl(key, found.url)) {
      throw new Error(`Resolver returned a URL outside its allowed hosts: ${found.url}`);
    }
    cache.set(key, { url: found.url, headers: found.headers, at: Date.now() });
    return { url: found.url, headers: found.headers, resolved: true };
  } catch (err) {
    return { url: fallbackUrl, resolved: false, error: err.message };
  }
}

module.exports = {
  resolveDownloadUrl,
  compareVersions
};
