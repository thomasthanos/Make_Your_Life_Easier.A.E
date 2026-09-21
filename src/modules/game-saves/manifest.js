
const path = require('path');
const { readJson, writeJsonAtomic } = require('./io');

const MANIFEST_URL = 'https://raw.githubusercontent.com/mtkennerly/ludusavi-manifest/master/data/manifest.yaml';
const CACHE_VERSION = 1;
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

const WINDOWS_OS = new Set(['windows', 'dos']);
const LINUX_ONLY_PLACEHOLDER = /<xdg(Data|Config)>/;
const ROOTED_TEMPLATE = /^(<[a-zA-Z]+>|[a-zA-Z]:[\\/])/;
const HKCU_PREFIX = 'HKEY_CURRENT_USER\\';

function cacheFiles(cacheDir) {
  return {
    data: path.join(cacheDir, 'manifest.json'),
    meta: path.join(cacheDir, 'manifest-meta.json')
  };
}

function windowsConditions(when) {
  if (!Array.isArray(when) || when.length === 0) return { applies: true, stores: null };
  let applies = false;
  let anyStore = false;
  const stores = new Set();
  for (const condition of when) {
    if (!condition || typeof condition !== 'object') continue;
    if (condition.os && !WINDOWS_OS.has(String(condition.os))) continue;
    applies = true;
    if (condition.store) stores.add(String(condition.store));
    else anyStore = true;
  }
  return { applies, stores: anyStore || stores.size === 0 ? null : [...stores] };
}

function compactTags(tags) {
  return Array.isArray(tags) ? tags.filter((tag) => tag === 'save' || tag === 'config') : [];
}

function compactFiles(files) {
  if (!files || typeof files !== 'object') return [];
  const out = [];
  for (const [template, info] of Object.entries(files)) {
    if (!ROOTED_TEMPLATE.test(template) || LINUX_ONLY_PLACEHOLDER.test(template)) continue;
    const { applies, stores } = windowsConditions(info && info.when);
    if (!applies) continue;
    const item = { path: template };
    const tags = compactTags(info && info.tags);
    if (tags.length) item.tags = tags;
    if (stores) item.stores = stores;
    out.push(item);
  }
  return out;
}

function compactRegistry(registry) {
  if (!registry || typeof registry !== 'object') return [];
  const out = [];
  for (const [rawKey, info] of Object.entries(registry)) {
    const key = String(rawKey).replace(/\//g, '\\').replace(/\\+$/, '');
    if (!key.toUpperCase().startsWith(HKCU_PREFIX) || key.length <= HKCU_PREFIX.length) continue;
    if (!windowsConditions(info && info.when).applies) continue;
    const item = { key: HKCU_PREFIX + key.slice(HKCU_PREFIX.length) };
    const tags = compactTags(info && info.tags);
    if (tags.length) item.tags = tags;
    out.push(item);
  }
  return out;
}

function idList(primary, extra) {
  const values = [primary, ...(Array.isArray(extra) ? extra : [])];
  return [...new Set(values
    .filter((value) => typeof value === 'number' || (typeof value === 'string' && value))
    .map(String))];
}

function compactManifest(raw) {
  const games = [];
  if (!raw || typeof raw !== 'object') return games;
  for (const [name, entry] of Object.entries(raw)) {
    if (!entry || typeof entry !== 'object' || entry.alias) continue;
    const files = compactFiles(entry.files);
    const registry = compactRegistry(entry.registry);
    if (files.length === 0 && registry.length === 0) continue;

    const game = { name, files, registry };
    if (entry.installDir && typeof entry.installDir === 'object') {
      const installDirs = Object.keys(entry.installDir).filter(Boolean);
      if (installDirs.length) game.installDirs = installDirs;
    }
    const ids = entry.id && typeof entry.id === 'object' ? entry.id : {};
    const steamIds = idList(entry.steam && entry.steam.id, ids.steamExtra);
    if (steamIds.length) game.steamIds = steamIds;
    const gogIds = idList(entry.gog && entry.gog.id, ids.gogExtra);
    if (gogIds.length) game.gogIds = gogIds;
    if (entry.cloud && typeof entry.cloud === 'object') {
      const cloud = Object.keys(entry.cloud).filter((store) => entry.cloud[store] === true);
      if (cloud.length) game.cloud = cloud;
    }
    games.push(game);
  }
  return games;
}

function parseManifestYaml(text) {
  const yaml = require('js-yaml');
  return yaml.load(text, { schema: yaml.CORE_SCHEMA, json: true });
}

function loadCachedManifest(cacheDir) {
  const files = cacheFiles(cacheDir);
  const meta = readJson(files.meta);
  if (!meta || meta.version !== CACHE_VERSION) return null;
  const data = readJson(files.data);
  if (!data || data.version !== CACHE_VERSION || !Array.isArray(data.games)) return null;
  return { games: data.games, meta };
}

function readManifestMeta(cacheDir) {
  const meta = readJson(cacheFiles(cacheDir).meta);
  return meta && meta.version === CACHE_VERSION ? meta : null;
}

async function ensureManifest({ cacheDir, force = false, now = Date.now(), fetchImpl = globalThis.fetch, parse = parseManifestYaml, onProgress } = {}) {
  const files = cacheFiles(cacheDir);
  const cached = loadCachedManifest(cacheDir);
  const checkedAt = cached ? Date.parse(cached.meta.checkedAt) : NaN;
  if (cached && !force && Number.isFinite(checkedAt) && now - checkedAt < REFRESH_INTERVAL_MS) {
    return { ...cached, source: 'cache' };
  }

  const stamp = new Date(now).toISOString();
  let games;
  let etag = null;
  try {
    if (onProgress) onProgress({ phase: 'manifest-download' });
    const headers = { 'User-Agent': 'MakeYourLifeEasier' };
    if (cached && cached.meta.etag) headers['If-None-Match'] = cached.meta.etag;
    const response = await fetchImpl(MANIFEST_URL, { headers, signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });

    if (response.status === 304 && cached) {
      const meta = { ...cached.meta, checkedAt: stamp };
      writeJsonAtomic(files.meta, meta);
      return { games: cached.games, meta, source: 'cache' };
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    if (onProgress) onProgress({ phase: 'manifest-parse' });
    games = compactManifest(parse(text));
    if (games.length === 0) throw new Error('the download was empty');
    etag = response.headers.get('etag');
  } catch (err) {
    if (cached) return { ...cached, source: 'cache', offline: true };
    throw new Error(`Could not download the game save database: ${err.message}`);
  }

  const meta = { version: CACHE_VERSION, etag: etag || null, checkedAt: stamp, updatedAt: stamp, gameCount: games.length };
  writeJsonAtomic(files.data, { version: CACHE_VERSION, games }, { pretty: false });
  writeJsonAtomic(files.meta, meta);
  return { games, meta, source: 'network' };
}

module.exports = {
  MANIFEST_URL,
  compactManifest,
  ensureManifest,
  loadCachedManifest,
  parseManifestYaml,
  readManifestMeta
};
