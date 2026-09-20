
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { GlobWalker } = require('./glob');
const { expandTemplate } = require('./paths');
const { isWithin } = require('../security');

const MAX_FILES_PER_GAME = 5000;
const MAX_WALK_DEPTH = 12;
const PROGRESS_EVERY = 250;
const STEAM_CLOUD_MARKER = 'steam_autocloud.vdf';

const SAVE_DIR_NAME = /^(saves?|save[ _-]?games?|saved[ _-]?games?|save[ _-]?data|save[ _-]?files?)$/i;
const SAVE_FILE_NAME = /(^save|\.(sav|save|savegame|sl2|ess|fos)$)/i;
const SUGGESTION_DEPTH = 3;
const SUGGESTION_FILE_LIMIT = 2000;

function isDirectory(fsImpl, dir) {
  try {
    return fsImpl.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function childDirs(fsImpl, dir) {
  try {
    return fsImpl.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
      .map((entry) => ({ name: entry.name, path: path.join(dir, entry.name) }));
  } catch {
    return [];
  }
}

function hasEntry(walker, dir, name) {
  const listing = walker.list(dir);
  return Boolean(listing && listing.has(name));
}

function addFile(files, filePath, stat, context) {
  if (context.excludedRoots.some((dir) => isWithin(filePath, dir))) return;
  const key = filePath.toLowerCase();
  const existing = files.get(key);
  if (existing) {
    for (const tag of context.tags || []) if (!existing.tags.includes(tag)) existing.tags.push(tag);
    return;
  }
  const file = { path: filePath, size: stat.size, mtimeMs: stat.mtimeMs, tags: [...(context.tags || [])] };
  if (context.base) file.base = context.base;
  if (context.root) file.root = context.root;
  files.set(key, file);
}

function collectInto(files, target, context, fsImpl) {
  let stat;
  try {
    stat = fsImpl.statSync(target);
  } catch {
    return null;
  }
  if (stat.isFile()) {
    addFile(files, target, stat, context);
    return 'file';
  }
  if (!stat.isDirectory()) return null;

  const stack = [[target, 0]];
  while (stack.length && files.size < MAX_FILES_PER_GAME) {
    const [dir, depth] = stack.pop();
    let entries;
    try {
      entries = fsImpl.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth < MAX_WALK_DEPTH) stack.push([full, depth + 1]);
      } else if (entry.isFile()) {
        try {
          addFile(files, full, fsImpl.statSync(full), context);
        } catch {  }
        if (files.size >= MAX_FILES_PER_GAME) break;
      }
    }
  }
  return 'dir';
}

function buildInstallIndex(launchers, customRoots, fsImpl) {
  const bySteamId = new Map();
  const byGogId = new Map();
  const byFolder = new Map();
  const addFolder = (installPath, store) => {
    const key = path.basename(installPath).toLowerCase();
    if (!byFolder.has(key)) byFolder.set(key, []);
    byFolder.get(key).push({ path: installPath, store });
  };

  for (const app of (launchers.steam && launchers.steam.apps) || []) {
    bySteamId.set(app.appId, { path: app.installPath, store: 'steam' });
    addFolder(app.installPath, 'steam');
  }
  for (const game of launchers.gog || []) {
    if (game.id) byGogId.set(game.id, { path: game.installPath, store: 'gog' });
    addFolder(game.installPath, 'gog');
  }
  for (const game of launchers.epic || []) addFolder(game.installPath, 'epic');
  for (const root of customRoots || []) {
    for (const child of childDirs(fsImpl, root)) addFolder(child.path, 'other');
  }
  return { bySteamId, byGogId, byFolder };
}

function basesForGame(game, index) {
  const bases = new Map();
  const add = (base) => {
    if (base) bases.set(base.path.toLowerCase(), base);
  };
  for (const id of game.steamIds || []) add(index.bySteamId.get(id));
  for (const id of game.gogIds || []) add(index.byGogId.get(id));
  if (bases.size === 0) {
    for (const dir of game.installDirs || []) {
      for (const base of index.byFolder.get(dir.toLowerCase()) || []) add(base);
    }
  }
  return [...bases.values()];
}

function storeRoots(launchers) {
  const roots = [];
  if (launchers.steam) roots.push({ path: launchers.steam.root, store: 'steam' });
  if (launchers.ubisoft) roots.push({ path: launchers.ubisoft.root, store: 'uplay' });
  return roots;
}

function storeAllowed(stores, store) {
  return !stores || store === 'other' || stores.includes(store);
}

function templateVariants(entry, bases, roots) {
  const needsBase = /<(base|game)>/.test(entry.path);
  const needsRoot = entry.path.includes('<root>');
  if (!needsBase && !needsRoot) return [{}];

  const baseVariants = needsBase
    ? bases.filter((base) => storeAllowed(entry.stores, base.store)).map((base) => ({ base: base.path, game: path.basename(base.path) }))
    : [{}];
  if (!needsRoot) return baseVariants;

  const rootPaths = roots.filter((root) => storeAllowed(entry.stores, root.store)).map((root) => root.path);
  return baseVariants.flatMap((variant) => rootPaths.map((root) => ({ ...variant, root })));
}

function broadPaths(vars, launchers, bases) {
  const set = new Set();
  const add = (value) => {
    if (typeof value === 'string' && value) set.add(path.resolve(value).toLowerCase());
  };
  ['home', 'winAppData', 'winLocalAppData', 'winLocalAppDataLow', 'winDocuments', 'winPublic', 'winProgramData', 'winDir']
    .forEach((name) => add(vars[name]));
  add(path.join(vars.winDocuments || '', 'My Games'));
  add(path.join(vars.home || '', 'Saved Games'));
  if (launchers.steam) {
    add(launchers.steam.root);
    launchers.steam.libraries.forEach((library) => {
      add(library);
      add(path.join(library, 'common'));
    });
  }
  if (launchers.ubisoft) add(launchers.ubisoft.root);
  bases.forEach((base) => add(base.path));
  return set;
}

function finishGame(record, files) {
  const list = [...files.values()];
  return {
    ...record,
    files: list,
    fileCount: list.length,
    totalSize: list.reduce((sum, file) => sum + file.size, 0),
    lastModified: list.reduce((latest, file) => Math.max(latest, file.mtimeMs), 0)
  };
}

function scanManifestGame(game, context) {
  const bases = basesForGame(game, context.index);
  const files = new Map();
  const locations = new Map();
  let steamCloud = false;

  for (const entry of game.files) {
    for (const variant of templateVariants(entry, bases, context.roots)) {
      const pattern = expandTemplate(entry.path, { ...context.vars, ...variant });
      if (!pattern) continue;
      for (const hit of context.walker.match(pattern)) {
        const resolved = path.resolve(hit).toLowerCase();
        if (context.broad.has(resolved) || bases.some((base) => base.path.toLowerCase() === resolved)) continue;
        const before = files.size;
        const kind = collectInto(files, hit, {
          tags: entry.tags,
          base: variant.base,
          root: variant.root,
          excludedRoots: context.excludedRoots
        }, context.fsImpl);
        if (!kind) continue;
        const location = kind === 'file' ? path.dirname(hit) : hit;
        if (!steamCloud && hasEntry(context.walker, location, STEAM_CLOUD_MARKER)) steamCloud = true;
        if (files.size > before && locations.size < 5) locations.set(location.toLowerCase(), location);
      }
    }
  }

  const registry = (game.registry || []).filter((item) => context.registryKeys.has(item.key.toLowerCase()));
  if (files.size === 0 && registry.length === 0) return null;
  if (!steamCloud) steamCloud = [...files.values()].some((file) => path.basename(file.path).toLowerCase() === STEAM_CLOUD_MARKER);
  return finishGame({
    id: game.name,
    name: game.name,
    kind: 'manifest',
    registry,
    steamCloud: steamCloud && files.size > 0,
    installed: bases.length > 0,
    cloud: game.cloud || [],
    locations: [...locations.values()]
  }, files);
}

function scanCustomGame(custom, context) {
  const files = new Map();
  if (context.broad.has(path.resolve(custom.path).toLowerCase())) return null;
  collectInto(files, custom.path, { tags: ['save'], excludedRoots: context.excludedRoots }, context.fsImpl);
  if (files.size === 0) return null;
  return finishGame({
    id: `custom:${custom.name}`,
    name: custom.name,
    kind: 'custom',
    customPath: custom.path,
    steamCloud: hasEntry(context.walker, custom.path, STEAM_CLOUD_MARKER),
    registry: [],
    installed: false,
    cloud: [],
    locations: [custom.path]
  }, files);
}

function scanGames({ games, vars, launchers, config = {}, registryKeys = new Set(), excludedRoots = [], fsImpl = fs, onProgress }) {
  const index = buildInstallIndex(launchers, config.customRoots, fsImpl);
  const allBases = [...index.bySteamId.values(), ...index.byGogId.values(), ...[...index.byFolder.values()].flat()];
  const context = {
    walker: new GlobWalker({ fsImpl }),
    index,
    roots: storeRoots(launchers),
    broad: broadPaths(vars, launchers, allBases),
    vars,
    registryKeys,
    excludedRoots: excludedRoots.filter(Boolean),
    fsImpl
  };

  const results = [];
  games.forEach((game, i) => {
    if (onProgress && i % PROGRESS_EVERY === 0) onProgress({ phase: 'scan', current: i, total: games.length });
    const found = scanManifestGame(game, context);
    if (found) results.push(found);
  });
  for (const custom of config.customGames || []) {
    const found = scanCustomGame(custom, context);
    if (found) results.push(found);
  }
  results.sort((a, b) => b.lastModified - a.lastModified || a.name.localeCompare(b.name));
  return results;
}

function suggestionCandidates(vars, fsImpl) {
  const candidates = [];
  const push = (name, dir, needsEvidence) => candidates.push({ name, path: dir, needsEvidence });

  for (const child of childDirs(fsImpl, path.join(vars.winDocuments, 'My Games'))) push(child.name, child.path, false);
  for (const child of childDirs(fsImpl, path.join(vars.home, 'Saved Games'))) push(child.name, child.path, false);
  for (const child of childDirs(fsImpl, vars.winLocalAppData)) {
    const saveGames = path.join(child.path, 'Saved', 'SaveGames');
    if (isDirectory(fsImpl, saveGames)) push(child.name, saveGames, false);
  }
  for (const child of childDirs(fsImpl, vars.winAppData)) {
    const saveDir = childDirs(fsImpl, child.path).find((grandchild) => SAVE_DIR_NAME.test(grandchild.name));
    if (saveDir) push(child.name, saveDir.path, false);
  }
  for (const company of childDirs(fsImpl, vars.winLocalAppDataLow)) {
    for (const game of childDirs(fsImpl, company.path)) push(game.name, game.path, true);
  }
  for (const child of childDirs(fsImpl, vars.winDocuments)) {
    if (child.name.toLowerCase() !== 'my games') push(child.name, child.path, true);
  }
  return candidates;
}

function inspectCandidate(fsImpl, dir) {
  const files = [];
  let saveLike = false;
  const stack = [[dir, 0]];
  while (stack.length && files.length < SUGGESTION_FILE_LIMIT) {
    const [current, depth] = stack.pop();
    let entries;
    try {
      entries = fsImpl.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (SAVE_DIR_NAME.test(entry.name)) saveLike = true;
        if (depth < SUGGESTION_DEPTH) stack.push([path.join(current, entry.name), depth + 1]);
      } else if (entry.isFile()) {
        if (SAVE_FILE_NAME.test(entry.name)) saveLike = true;
        files.push(path.join(current, entry.name));
      }
    }
  }
  return { files, saveLike };
}

function findSuggestions({ vars, games, config = {}, excludedRoots = [], fsImpl = fs }) {
  const covered = games.flatMap((game) => game.files.map((file) => file.path.toLowerCase()));
  const ignored = config.ignoredSuggestions || [];
  const customPaths = (config.customGames || []).map((game) => game.path);
  const roots = excludedRoots.filter(Boolean);
  const suggestions = [];
  const seen = new Set();

  for (const candidate of suggestionCandidates(vars, fsImpl)) {
    const key = path.resolve(candidate.path).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (roots.some((dir) => isWithin(candidate.path, dir) || isWithin(dir, candidate.path))) continue;
    if (ignored.some((dir) => isWithin(candidate.path, dir))) continue;
    if (customPaths.some((dir) => isWithin(candidate.path, dir) || isWithin(dir, candidate.path))) continue;
    const prefix = key.endsWith(path.sep) ? key : key + path.sep;
    if (covered.some((file) => file.startsWith(prefix))) continue;

    const inspection = inspectCandidate(fsImpl, candidate.path);
    if (inspection.files.length === 0 || (candidate.needsEvidence && !inspection.saveLike)) continue;

    let totalSize = 0;
    let lastModified = 0;
    for (const file of inspection.files) {
      try {
        const stat = fsImpl.statSync(file);
        totalSize += stat.size;
        lastModified = Math.max(lastModified, stat.mtimeMs);
      } catch {  }
    }
    suggestions.push({
      id: `suggestion:${crypto.createHash('sha1').update(key).digest('hex').slice(0, 16)}`,
      name: candidate.name,
      path: candidate.path,
      fileCount: inspection.files.length,
      totalSize,
      lastModified
    });
  }
  return suggestions.sort((a, b) => b.lastModified - a.lastModified);
}

module.exports = {
  basesForGame,
  buildInstallIndex,
  findSuggestions,
  scanGames,
  storeRoots,
  templateVariants
};
