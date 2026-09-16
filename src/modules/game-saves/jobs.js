/**
 * The long-running game-saves operations, free of any Electron dependency.
 *
 * worker.js runs them in a utility process so a scan never blocks the main
 * process. They take plain data and return plain data.
 */

const fs = require('fs');
const path = require('path');
const { backupGame, backupStatus, listBackups, mappingSummary, readMapping, restoreGame, restoreLocations } = require('./backup');
const { escapeGlob, toSlash } = require('./glob');
const { detectLaunchers } = require('./launchers');
const { ensureManifest, loadCachedManifest } = require('./manifest');
const { expandCollapsed, machineVariables } = require('./paths');
const { basesForGame, buildInstallIndex, findSuggestions, scanGames, storeRoots } = require('./scanner');
const system = require('./system');
const { isWithin } = require('../security');

function cacheDirFor(userDataPath) {
  return path.join(userDataPath, 'game-saves');
}

function requireBackupRoot(config) {
  let available = false;
  try {
    available = Boolean(config.backupRoot) && fs.statSync(config.backupRoot).isDirectory();
  } catch { /* missing or on a disconnected drive */ }
  if (!available) throw new Error('The backup folder is not available. Choose it again, or connect its drive.');
}

/**
 * Registry keys worth testing. Almost every manifest key sits under
 * HKCU\Software\<Vendor>, and one listing of HKCU\Software rules out the
 * vendors that were never installed — thousands of keys down to a handful.
 * @param {Array<Object>} games - Compact manifest games
 * @param {string[]} hkcuSoftware - Subkey names of HKCU\Software
 * @returns {string[]} Keys to test
 */
function candidateRegistryKeys(games, hkcuSoftware) {
  const vendors = new Set(hkcuSoftware.map((name) => name.toLowerCase()));
  const keys = new Set();
  for (const game of games) {
    for (const item of game.registry || []) {
      const parts = item.key.split('\\');
      if (parts.length > 2 && parts[1].toLowerCase() === 'software' && !vendors.has(parts[2].toLowerCase())) continue;
      keys.add(item.key);
    }
  }
  return [...keys];
}

async function detectMachine() {
  const probe = await system.probeSystem();
  return {
    probe,
    vars: machineVariables(process.env, { documents: probe.documents }),
    launchers: detectLaunchers({ probe })
  };
}

async function scan({ userDataPath, config, refreshManifest = false, withSuggestions = true }, { onProgress = () => {} } = {}) {
  const manifest = await ensureManifest({ cacheDir: cacheDirFor(userDataPath), force: refreshManifest, onProgress });
  onProgress({ phase: 'detect' });
  const { probe, vars, launchers } = await detectMachine();
  const registryKeys = await system.findExistingRegistryKeys(candidateRegistryKeys(manifest.games, probe.hkcuSoftware));
  const excludedRoots = config.backupRoot ? [config.backupRoot] : [];
  const games = scanGames({ games: manifest.games, vars, launchers, config, registryKeys, excludedRoots, onProgress });

  for (const game of games) {
    const mapping = readMapping(config.backupRoot, game.name, game.kind);
    game.status = backupStatus(game, mapping, vars);
    game.backup = mappingSummary(mapping);
    game.backedUpAt = game.backup ? game.backup.backedUpAt : null;
  }

  // Backed-up games whose saves are not on this PC (a new PC, a reinstall).
  const cloudByName = new Map(manifest.games.filter((game) => game.cloud).map((game) => [game.name, game.cloud]));
  for (const mapping of listBackups(config.backupRoot)) {
    const kind = mapping.kind === 'custom' ? 'custom' : 'manifest';
    const id = kind === 'custom' ? `custom:${mapping.name}` : mapping.name;
    if (games.some((game) => game.id === id)) continue;
    games.push({
      id,
      name: mapping.name,
      kind,
      status: 'backup-only',
      backedUpAt: mapping.backedUpAt || null,
      backup: mappingSummary(mapping),
      customPath: kind === 'custom' ? mapping.customPath : undefined,
      customPathCollapsed: kind === 'custom' ? mapping.customPathCollapsed : undefined,
      files: [],
      registry: [],
      fileCount: mapping.files.length,
      totalSize: Number(mapping.totalSize) || 0,
      lastModified: 0,
      installed: false,
      steamCloud: false,
      cloud: cloudByName.get(mapping.name) || [],
      // Where the saves will go, so the list can say so before restoring.
      locations: kind === 'custom'
        ? [expandCollapsed(mapping.customPathCollapsed, vars) || mapping.customPath].filter(Boolean)
        : restoreLocations(mapping, vars)
    });
  }

  onProgress({ phase: 'suggestions' });
  return {
    scannedAt: new Date().toISOString(),
    vars,
    games,
    suggestions: withSuggestions ? findSuggestions({ vars, games, config, excludedRoots }) : [],
    manifest: {
      gameCount: manifest.meta.gameCount,
      updatedAt: manifest.meta.updatedAt,
      offline: Boolean(manifest.offline)
    },
    launchers: {
      steam: Boolean(launchers.steam),
      epic: launchers.epic.length,
      gog: launchers.gog.length,
      ubisoft: Boolean(launchers.ubisoft)
    }
  };
}

async function backup({ config, games, vars }, { onProgress = () => {} } = {}) {
  requireBackupRoot(config);
  const results = [];
  for (let i = 0; i < games.length; i++) {
    onProgress({ phase: 'backup', current: i, total: games.length, label: games[i].name });
    try {
      results.push(await backupGame(games[i], { backupRoot: config.backupRoot, vars, registry: system.registry }));
    } catch (err) {
      results.push({ name: games[i].name, copied: 0, unchanged: 0, removed: 0, bytes: 0, errors: [{ path: '', error: err.message }] });
    }
  }
  return { results, finishedAt: new Date().toISOString() };
}

function restoreDefinition(item, gamesByName, vars) {
  if (item.kind === 'custom') {
    // The folder can come from the backup itself (made on another PC), so it
    // is held to this user's own profile.
    const dir = typeof item.customPath === 'string' && path.isAbsolute(item.customPath) ? path.resolve(item.customPath) : '';
    const insideProfile = [vars.home, vars.winDocuments].some((root) => isWithin(dir, root) && path.resolve(root) !== dir);
    if (!dir || !insideProfile) throw new Error('This folder is outside your user profile, so nothing is restored there.');
    return { files: [{ path: escapeGlob(toSlash(dir)) }], registry: [] };
  }
  const game = gamesByName.get(item.name);
  if (!game) throw new Error('This game is not in the save database.');
  return game;
}

function restoreVariants(definition, vars, index, roots) {
  const variants = [{ ...vars }];
  for (const base of basesForGame(definition, index)) {
    const withBase = { ...vars, base: base.path, game: path.basename(base.path) };
    variants.push(withBase);
    for (const root of roots) variants.push({ ...withBase, root: root.path });
  }
  for (const root of roots) variants.push({ ...vars, root: root.path });
  return variants;
}

async function restore({ userDataPath, config, items }, { onProgress = () => {} } = {}) {
  requireBackupRoot(config);
  const manifest = loadCachedManifest(cacheDirFor(userDataPath));
  const gamesByName = new Map((manifest ? manifest.games : []).map((game) => [game.name, game]));
  const { vars, launchers } = await detectMachine();
  const index = buildInstallIndex(launchers, config.customRoots, fs);
  const roots = storeRoots(launchers);

  const results = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress({ phase: 'restore', current: i, total: items.length, label: item.name });
    try {
      const definition = restoreDefinition(item, gamesByName, vars);
      results.push(await restoreGame({
        name: item.name,
        kind: item.kind,
        backupRoot: config.backupRoot,
        game: definition,
        variants: restoreVariants(definition, vars, index, roots),
        registry: system.registry
      }));
    } catch (err) {
      results.push({ name: item.name, restored: 0, errors: [{ path: '', error: err.message }], safetyDir: null });
    }
  }
  return { results, finishedAt: new Date().toISOString() };
}

async function scheduled({ userDataPath, config }, hooks = {}) {
  requireBackupRoot(config);
  const found = await scan({ userDataPath, config, withSuggestions: false }, hooks);
  const excluded = new Set(config.excludedGames);
  const targets = found.games.filter((game) => (game.status === 'new' || game.status === 'changed') && !excluded.has(game.id));
  const done = targets.length
    ? await backup({ config, games: targets, vars: found.vars }, hooks)
    : { results: [], finishedAt: new Date().toISOString() };
  return {
    scan: found,
    gamesFound: found.games.filter((game) => game.status !== 'backup-only').length,
    backedUp: targets.length,
    results: done.results,
    finishedAt: done.finishedAt
  };
}

const JOBS = { scan, backup, restore, scheduled };

/**
 * @param {'scan'|'backup'|'restore'|'scheduled'} type - Job to run
 * @param {Object} payload - Job input
 * @param {{onProgress?: Function}} [hooks]
 * @returns {Promise<Object>} Job result
 */
function runJob(type, payload, hooks) {
  const job = JOBS[type];
  if (!job) return Promise.reject(new Error(`Unknown game saves job: ${type}`));
  return job(payload || {}, hooks);
}

module.exports = {
  candidateRegistryKeys,
  restoreDefinition,
  runJob
};
