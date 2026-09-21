
const { clientFor } = require('./http-utils');

const REQUEST_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 5;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const USER_AGENT = 'MakeYourLifeEasier';

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

const RESOLVERS = {
  'nvidia-app': async () => {
    const html = await httpGetText('https://www.nvidia.com/en-us/software/nvidia-app/');
    const url = pickNewestUrl(
      html,
      /https:\/\/[a-z0-9.]*download\.nvidia\.com\/nvapp\/client\/[\d.]+\/NVIDIA_app_v[\d._]+\.exe/gi,
      /\/nvapp\/client\/([\d.]+)\//i
    );
    return url ? { url } : null;
  },

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
    const asset = (release && release.assets || []).find((a) => /windows.*\.exe$/i.test(a.name || ''));
    return asset ? { url: asset.browser_download_url } : null;
  },

  'cursor': async () => {
    const data = await httpGetJson('https://cursor.com/api/download?platform=win32-x64-user&releaseTrack=stable');
    return data && data.downloadUrl ? { url: data.downloadUrl } : null;
  }
};

const ALLOWED_DOWNLOAD_HOSTS = {
  'nvidia-app': ['nvidia.com'],
  'amd-adrenalin': ['amd.com'],
  'betterdiscord': ['github.com', 'githubusercontent.com'],
  'cursor': ['cursor.com', 'cursor.sh', 'cloudfront.net']
};

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
