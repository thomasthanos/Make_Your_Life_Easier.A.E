/**
 * Copy a game's saves into its backup folder, and put them back.
 *
 * Each game gets one folder under the backup root:
 *
 *   <Game>/mapping.json            what was copied, with collapsed paths
 *   <Game>/files/winAppData/...    the files, laid out by the root they came from
 *   <Game>/registry/0.reg          exported registry keys
 *
 * The folder mirrors the saves' current state; it is not a history. Restoring
 * first copies whatever it is about to overwrite into _before-restore, so a
 * mistaken restore can still be undone by hand.
 *
 * The backup root may live in a synced cloud folder that other people or
 * devices can write to, so a restore trusts nothing it reads there: every
 * destination must fall inside one of the game's own manifest save locations on
 * this PC, and a registry file may only touch the game's own keys.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { backupRelativePath, collapsePath, expandCollapsed, expandTemplate } = require('./paths');
const { isCoveredByPattern } = require('./glob');
const { readJson, writeJsonAtomic } = require('./io');
const { isWithin, validatePath } = require('../security');

const MAPPING_FILE = 'mapping.json';
const MAPPING_VERSION = 1;
const FILES_DIR = 'files';
const REGISTRY_DIR = 'registry';
const BEFORE_RESTORE_DIR = '_before-restore';
const PART_SUFFIX = '.myle-part';

// Save data is never executable. Refusing these on restore means a tampered
// backup cannot plant a program or script, even inside a genuine save folder.
const BLOCKED_RESTORE_EXTENSIONS = new Set([
  '.exe', '.dll', '.sys', '.com', '.scr', '.cpl', '.msi', '.msp', '.bat', '.cmd', '.ps1', '.psm1',
  '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.hta', '.lnk', '.url', '.reg', '.jar'
]);
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * A Windows-safe folder name for a game.
 * @param {string} name - Game name
 * @returns {string} Folder name
 */
function gameFolderName(name) {
  let folder = String(name)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .trim()
    .slice(0, 120)
    .replace(/[. ]+$/, '');
  if (!folder || /^\.+$/.test(folder)) folder = 'Game';
  if (RESERVED_NAMES.test(folder) || folder.toLowerCase() === BEFORE_RESTORE_DIR) folder = `${folder}_`;
  return folder;
}

function readMappingAt(dir) {
  const mapping = readJson(path.join(dir, MAPPING_FILE));
  return mapping && mapping.version === MAPPING_VERSION && Array.isArray(mapping.files) ? mapping : null;
}

/**
 * The backup folder of a game. Two names that sanitise to the same folder, or a
 * confirmed folder named like a manifest game, are told apart by the name and
 * kind recorded in mapping.json.
 * @param {string} backupRoot - Backup root
 * @param {string} name - Game name
 * @param {'manifest'|'custom'} [kind='manifest'] - Where the game came from
 * @returns {string} Absolute folder path
 */
function gameBackupDir(backupRoot, name, kind = 'manifest') {
  const root = path.resolve(backupRoot);
  const primary = path.join(root, gameFolderName(name));
  const existing = readMappingAt(primary);
  const taken = existing && (existing.name !== name || (existing.kind || 'manifest') !== kind);
  const dir = taken
    ? `${primary} (${crypto.createHash('sha1').update(`${kind}:${name}`).digest('hex').slice(0, 6)})`
    : primary;
  if (!isWithin(dir, root) || path.resolve(dir) === root) throw new Error('Invalid backup folder name.');
  return dir;
}

/**
 * @returns {Object|null} The game's mapping.json, or null when never backed up
 */
function readMapping(backupRoot, name, kind = 'manifest') {
  if (!backupRoot) return null;
  try {
    return readMappingAt(gameBackupDir(backupRoot, name, kind));
  } catch {
    return null;
  }
}

/**
 * Every game with a backup under the root, including games whose saves are
 * gone from this PC — the case restoring exists for.
 * @param {string} backupRoot - Backup root
 * @returns {Array<Object>} The mapping.json of each backed-up game
 */
function listBackups(backupRoot) {
  if (!backupRoot) return [];
  let entries;
  try {
    entries = fs.readdirSync(backupRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory() && entry.name.toLowerCase() !== BEFORE_RESTORE_DIR)
    .map((entry) => readMappingAt(path.join(backupRoot, entry.name)))
    .filter((mapping) => mapping && typeof mapping.name === 'string' && mapping.name);
}

function fileVars(vars, file) {
  return { ...vars, base: file.base, root: file.root };
}

function statOrNull(file) {
  try {
    return fs.statSync(file);
  } catch {
    return null;
  }
}

/**
 * How a scanned game compares with its backup.
 * @param {Object} game - A game from scanGames()
 * @param {Object|null} mapping - Its mapping.json
 * @param {Object} vars - Machine placeholder values used for the scan
 * @returns {'new'|'changed'|'up-to-date'}
 */
function backupStatus(game, mapping, vars) {
  if (!mapping) return 'new';
  const recorded = new Map(mapping.files.map((entry) => [String(entry.path).toLowerCase(), entry]));
  if (recorded.size !== game.files.length) return 'changed';
  for (const file of game.files) {
    const collapsed = collapsePath(file.path, fileVars(vars, file));
    const entry = collapsed && recorded.get(collapsed.toLowerCase());
    if (!entry || entry.size !== file.size || Math.floor(entry.mtimeMs) !== Math.floor(file.mtimeMs)) return 'changed';
  }
  const keys = new Set((mapping.registry || []).map((item) => String(item.key).toLowerCase()));
  if (keys.size !== game.registry.length || game.registry.some((item) => !keys.has(item.key.toLowerCase()))) return 'changed';
  return 'up-to-date';
}

function copyFileAtomic(source, destination, mtimeMs) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temp = destination + PART_SUFFIX;
  try {
    fs.copyFileSync(source, temp);
    if (Number.isFinite(mtimeMs)) {
      const time = new Date(mtimeMs);
      fs.utimesSync(temp, time, time);
    }
    fs.renameSync(temp, destination);
  } catch (err) {
    try { fs.unlinkSync(temp); } catch { /* never created */ }
    throw err;
  }
}

function listFilesRelative(dir) {
  const out = [];
  const stack = [''];
  while (stack.length) {
    const relative = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(path.join(dir, relative), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const child = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) stack.push(child);
      else out.push(child);
    }
  }
  return out;
}

function removeEmptyDirs(dir, keepRoot = true) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) removeEmptyDirs(path.join(dir, entry.name), false);
  }
  if (!keepRoot) {
    try { fs.rmdirSync(dir); } catch { /* not empty */ }
  }
}

function removeStaleFiles(filesDir, keep) {
  let removed = 0;
  for (const relative of listFilesRelative(filesDir)) {
    if (keep.has(relative.toLowerCase())) continue;
    try {
      fs.unlinkSync(path.join(filesDir, ...relative.split('/')));
      if (!relative.endsWith(PART_SUFFIX)) removed++;
    } catch { /* locked; next run tries again */ }
  }
  removeEmptyDirs(filesDir);
  return removed;
}

async function exportRegistry(game, gameDir, registry, summary) {
  const registryDir = path.join(gameDir, REGISTRY_DIR);
  const entries = [];
  const keys = game.registry || [];
  if (keys.length) fs.mkdirSync(registryDir, { recursive: true });

  for (let i = 0; i < keys.length; i++) {
    const name = `${i}.reg`;
    const file = path.join(registryDir, name);
    const temp = file + PART_SUFFIX;
    const result = await registry.exportKey(keys[i].key, temp);
    if (result.success) {
      fs.renameSync(temp, file);
      entries.push({ key: keys[i].key, file: `${REGISTRY_DIR}/${name}` });
    } else {
      try { fs.unlinkSync(temp); } catch { /* never created */ }
      summary.errors.push({ path: keys[i].key, error: result.error || 'Registry export failed.' });
    }
  }

  let names = [];
  try { names = fs.readdirSync(registryDir); } catch { /* no registry folder */ }
  for (const name of names) {
    if (!entries.some((entry) => entry.file === `${REGISTRY_DIR}/${name}`)) {
      try { fs.unlinkSync(path.join(registryDir, name)); } catch { /* locked */ }
    }
  }
  return entries;
}

/**
 * Mirror one game's saves into its backup folder, copying only what changed.
 * @param {Object} game - A game from scanGames()
 * @param {Object} options
 * @param {string} options.backupRoot - Backup root
 * @param {Object} options.vars - Machine placeholder values used for the scan
 * @param {Object} options.registry - { exportKey } (see system.js)
 * @returns {Promise<{name: string, copied: number, unchanged: number, removed: number, bytes: number, errors: Array}>}
 */
async function backupGame(game, { backupRoot, vars, registry }) {
  const gameDir = gameBackupDir(backupRoot, game.name, game.kind || 'manifest');
  const filesDir = path.join(gameDir, FILES_DIR);
  const previous = readMappingAt(gameDir);
  const previousByPath = new Map((previous ? previous.files : []).map((entry) => [String(entry.path).toLowerCase(), entry]));
  const summary = { name: game.name, copied: 0, unchanged: 0, removed: 0, bytes: 0, errors: [] };
  const entries = [];
  const keep = new Set();

  for (const file of game.files) {
    const collapsed = collapsePath(file.path, fileVars(vars, file));
    const relative = collapsed && backupRelativePath(collapsed);
    const destination = relative && path.join(filesDir, ...relative.split('/'));
    if (!destination || !isWithin(destination, filesDir)) {
      summary.errors.push({ path: file.path, error: 'This location cannot be backed up.' });
      continue;
    }

    const entry = { path: collapsed, size: file.size, mtimeMs: file.mtimeMs };
    if (file.tags && file.tags.length) entry.tags = file.tags;
    const before = previousByPath.get(collapsed.toLowerCase());
    const copy = statOrNull(destination);
    if (before && before.size === file.size && Math.floor(before.mtimeMs) === Math.floor(file.mtimeMs) && copy && copy.size === file.size) {
      entries.push(entry);
      keep.add(relative.toLowerCase());
      summary.unchanged++;
      continue;
    }

    try {
      copyFileAtomic(file.path, destination, file.mtimeMs);
      entries.push(entry);
      keep.add(relative.toLowerCase());
      summary.copied++;
      summary.bytes += file.size;
    } catch (err) {
      summary.errors.push({ path: file.path, error: err.message });
      // A locked save keeps the copy from the last run, and it stays restorable.
      if (before && copy) {
        entries.push(before);
        keep.add(relative.toLowerCase());
      }
    }
  }

  const registryEntries = await exportRegistry(game, gameDir, registry, summary);
  // Nothing usable this time: leave the previous backup exactly as it was.
  if (entries.length === 0 && registryEntries.length === 0) return summary;

  summary.removed = removeStaleFiles(filesDir, keep);
  const mapping = {
    version: MAPPING_VERSION,
    name: game.name,
    kind: game.kind || 'manifest',
    backedUpAt: new Date().toISOString(),
    computer: os.hostname(),
    totalSize: entries.reduce((sum, item) => sum + item.size, 0),
    files: entries,
    registry: registryEntries
  };
  if (game.customPath) {
    mapping.customPath = game.customPath;
    // The collapsed form lets another PC, or another user name, find the folder.
    mapping.customPathCollapsed = collapsePath(game.customPath, vars);
  }
  writeJsonAtomic(path.join(gameDir, MAPPING_FILE), mapping);
  return summary;
}

function timestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function registryKeyWithin(key, allowed) {
  const k = String(key).toLowerCase();
  const a = String(allowed).toLowerCase();
  return k === a || k.startsWith(`${a}\\`);
}

function resolveRestoreTarget(collapsed, allowed) {
  for (const { vars, patterns } of allowed) {
    const target = expandCollapsed(collapsed, vars);
    if (!target) continue;
    const check = validatePath(target);
    if (check.valid && patterns.some((pattern) => isCoveredByPattern(check.normalized, pattern))) return check.normalized;
  }
  return null;
}

/**
 * Put a game's backed-up saves back where the game looks for them.
 * @param {Object} options
 * @param {string} options.name - Game name
 * @param {'manifest'|'custom'} [options.kind='manifest'] - Where the game came from
 * @param {string} options.backupRoot - Backup root
 * @param {{files: Array<{path: string}>, registry?: Array<{key: string}>}} options.game -
 *   The game's manifest locations (for a custom game, its folder as a literal pattern)
 * @param {Array<Object>} options.variants - Placeholder value sets to try, machine variables first
 * @param {Object} options.registry - { exportKey, importFile, readFileKeys } (see system.js)
 * @returns {Promise<{name: string, restored: number, errors: Array, safetyDir: string|null}>}
 */
async function restoreGame({ name, kind = 'manifest', backupRoot, game, variants, registry, now = new Date() }) {
  const gameDir = gameBackupDir(backupRoot, name, kind);
  const mapping = readMappingAt(gameDir);
  if (!mapping) throw new Error('There is no backup of this game.');

  const summary = { name, restored: 0, errors: [], safetyDir: null };
  const safetyDir = path.join(path.resolve(backupRoot), BEFORE_RESTORE_DIR, path.basename(gameDir), timestamp(now));
  const filesDir = path.join(gameDir, FILES_DIR);
  const allowed = variants.map((vars) => ({
    vars,
    patterns: (game.files || []).map((file) => expandTemplate(file.path, vars)).filter(Boolean)
  }));

  for (const entry of mapping.files) {
    const relative = backupRelativePath(entry.path);
    const source = relative && path.join(filesDir, ...relative.split('/'));
    if (!source || !isWithin(source, filesDir) || !statOrNull(source)) {
      summary.errors.push({ path: String(entry.path), error: 'Missing from the backup.' });
      continue;
    }
    const target = resolveRestoreTarget(entry.path, allowed);
    if (!target) {
      summary.errors.push({ path: String(entry.path), error: "Not one of this game's save locations on this PC." });
      continue;
    }
    if (BLOCKED_RESTORE_EXTENSIONS.has(path.extname(target).toLowerCase())) {
      summary.errors.push({ path: target, error: 'Executable files are never restored.' });
      continue;
    }
    try {
      if (statOrNull(target)) {
        const safetyCopy = path.join(safetyDir, FILES_DIR, ...relative.split('/'));
        fs.mkdirSync(path.dirname(safetyCopy), { recursive: true });
        fs.copyFileSync(target, safetyCopy);
        summary.safetyDir = safetyDir;
      }
      copyFileAtomic(source, target, entry.mtimeMs);
      summary.restored++;
    } catch (err) {
      summary.errors.push({ path: target, error: err.message });
    }
  }

  const allowedKeys = (game.registry || []).map((item) => item.key);
  for (const item of mapping.registry || []) {
    const file = path.join(gameDir, ...String(item.file).split('/'));
    let keys = null;
    try {
      if (isWithin(file, path.join(gameDir, REGISTRY_DIR))) keys = registry.readFileKeys(file);
    } catch { /* unreadable */ }
    if (!keys || keys.length === 0 || !keys.every((key) => allowedKeys.some((allowedKey) => registryKeyWithin(key, allowedKey)))) {
      summary.errors.push({ path: String(item.key), error: "The registry file touches keys outside this game's own." });
      continue;
    }
    const safetyFile = path.join(safetyDir, REGISTRY_DIR, path.basename(file));
    fs.mkdirSync(path.dirname(safetyFile), { recursive: true });
    // Exporting a key that does not exist yet fails, and that is fine.
    if ((await registry.exportKey(item.key, safetyFile)).success) summary.safetyDir = safetyDir;
    const result = await registry.importFile(file);
    if (result.success) summary.restored++;
    else summary.errors.push({ path: String(item.key), error: result.error || 'Registry import failed.' });
  }

  if (!summary.safetyDir) {
    try { fs.rmSync(safetyDir, { recursive: true, force: true }); } catch { /* nothing was created */ }
  }
  return summary;
}

module.exports = {
  BEFORE_RESTORE_DIR,
  backupGame,
  backupStatus,
  gameBackupDir,
  gameFolderName,
  listBackups,
  readMapping,
  restoreGame
};
