
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { BACKUP_FOLDERS, backupFilePath, backupRelativePath, collapsePath, expandCollapsed, expandTemplate } = require('./paths');
const { isCoveredByPattern } = require('./glob');
const { readJson, writeJsonAtomic } = require('./io');
const { isWithin, validatePath } = require('../security');

const MAPPING_FILE = 'mapping.json';
const MAPPING_VERSION = 1;
const LEGACY_FILES_DIR = 'files';
const DEFAULT_ROOT_NAME = 'MYLE Game Saves';
const FILE_FOLDER_NAMES = [...Object.values(BACKUP_FOLDERS), LEGACY_FILES_DIR];
const FILE_FOLDERS = new Set(FILE_FOLDER_NAMES.map((name) => name.toLowerCase()));
const REGISTRY_DIR = 'registry';
const BEFORE_RESTORE_DIR = '_before-restore';
const PART_SUFFIX = '.myle-part';
const COPY_RETRY_CODES = new Set(['UNKNOWN', 'EPERM', 'EACCES', 'EINVAL', 'ENOTSUP', 'EIO']);

function oneDriveRoots(env = process.env) {
  return [...new Set([env.OneDrive, env.OneDriveConsumer, env.OneDriveCommercial].filter(Boolean))];
}

function copyFailure(err, paths, cloudRoots) {
  const code = err && err.code;
  if (code === 'EBUSY') {
    return { code: 'in-use', error: 'The file is in use. Close the game and try again.' };
  }
  if (code === 'UNKNOWN' && paths.some((file) => cloudRoots.some((root) => isWithin(file, root)))) {
    return {
      code: 'cloud-unavailable',
      error: 'OneDrive could not provide or store this file. It may be online-only while OneDrive is paused, signed out or closed.'
    };
  }
  return { error: (err && err.message) || String(err) };
}

const BLOCKED_RESTORE_EXTENSIONS = new Set([
  '.exe', '.dll', '.sys', '.com', '.scr', '.cpl', '.msi', '.msp', '.bat', '.cmd', '.ps1', '.psm1',
  '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.hta', '.lnk', '.url', '.reg', '.jar'
]);
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

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

function readMapping(backupRoot, name, kind = 'manifest') {
  if (!backupRoot) return null;
  try {
    return readMappingAt(gameBackupDir(backupRoot, name, kind));
  } catch {
    return null;
  }
}

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

function recordedByKey(entries, vars) {
  return new Map(entries.map((entry) => {
    const expanded = expandCollapsed(entry.path, vars);
    const key = (expanded && collapsePath(expanded, vars)) || String(entry.path);
    return [key.toLowerCase(), entry];
  }));
}

function sameVersion(entry, file) {
  return entry.size === file.size && Math.floor(entry.mtimeMs) === Math.floor(file.mtimeMs);
}

function recordedFile(entry) {
  if (!entry) return null;
  if (typeof entry.file !== 'string') {
    const legacy = backupRelativePath(entry.path);
    return legacy ? `${LEGACY_FILES_DIR}/${legacy}` : null;
  }
  const segments = entry.file.split('/');
  const valid = segments.length > 1
    && FILE_FOLDERS.has(segments[0].toLowerCase())
    && segments.every((segment) => segment && segment !== '.' && segment !== '..' && !/[\\:]/.test(segment));
  return valid ? entry.file : null;
}

function describeBackupRoot(dir) {
  let latest = null;
  const mappings = listBackups(dir);
  for (const mapping of mappings) {
    if (mapping.backedUpAt && (!latest || mapping.backedUpAt > latest.backedUpAt)) latest = mapping;
  }
  return {
    games: mappings.length,
    lastBackup: latest ? latest.backedUpAt : null,
    computer: latest && latest.computer ? latest.computer : null
  };
}

function mappingSummary(mapping) {
  if (!mapping) return null;
  return {
    backedUpAt: mapping.backedUpAt || null,
    computer: typeof mapping.computer === 'string' ? mapping.computer : null,
    fileCount: mapping.files.length,
    totalSize: Number(mapping.totalSize) || 0,
    registryCount: Array.isArray(mapping.registry) ? mapping.registry.length : 0,
    newestMtime: mapping.files.reduce((latest, entry) => Math.max(latest, Number(entry.mtimeMs) || 0), 0)
  };
}

function resolveBackupRootChoice(dir) {
  if (readMappingAt(dir)) return path.dirname(dir);
  const nested = path.join(dir, DEFAULT_ROOT_NAME);
  if (listBackups(dir).length === 0 && listBackups(nested).length > 0) return nested;
  return dir;
}

function restoreLocations(mapping, vars) {
  const dirs = new Map();
  for (const entry of mapping.files.slice(0, 500)) {
    const target = expandCollapsed(entry.path, vars);
    if (target) dirs.set(path.dirname(target).toLowerCase(), path.dirname(target));
  }
  const tops = [];
  for (const dir of [...dirs.values()].sort((a, b) => a.length - b.length)) {
    if (!tops.some((top) => isWithin(dir, top))) tops.push(dir);
    if (tops.length === 3) break;
  }
  return tops;
}

function statOrNull(file) {
  try {
    return fs.statSync(file);
  } catch {
    return null;
  }
}

function backupStatus(game, mapping, vars) {
  if (!mapping) return 'new';
  const recorded = recordedByKey(mapping.files, vars);
  if (recorded.size !== game.files.length) return 'changed';
  for (const file of game.files) {
    const collapsed = collapsePath(file.path, fileVars(vars, file));
    const entry = collapsed && recorded.get(collapsed.toLowerCase());
    if (!entry || !sameVersion(entry, file)) return 'changed';
  }
  const keys = new Set((mapping.registry || []).map((item) => String(item.key).toLowerCase()));
  if (keys.size !== game.registry.length || game.registry.some((item) => !keys.has(item.key.toLowerCase()))) return 'changed';
  return 'up-to-date';
}

function pcFileState(entry, file) {
  if (!entry) return 'new';
  return sameVersion(entry, file) ? 'same' : 'changed';
}

function backupFileState(entry, file) {
  if (!file) return 'missing';
  if (sameVersion(entry, file)) return 'same';
  return file.mtimeMs > entry.mtimeMs ? 'pc-newer' : 'different';
}

function compareWithBackup(game, mapping, vars) {
  const recorded = recordedByKey(mapping ? mapping.files : [], vars);
  const onPc = new Map();
  const pc = (game.files || []).map((file) => {
    const collapsed = collapsePath(file.path, fileVars(vars, file));
    const key = collapsed ? collapsed.toLowerCase() : null;
    if (key) onPc.set(key, file);
    return { path: file.path, size: file.size, mtimeMs: file.mtimeMs, state: pcFileState(key && recorded.get(key), file) };
  });
  const backup = [...recorded.entries()].map(([key, entry]) => {
    const file = onPc.get(key);
    return {
      path: file ? file.path : expandCollapsed(entry.path, vars) || backupFilePath(entry.path) || String(entry.path),
      size: Number(entry.size) || 0,
      mtimeMs: Number(entry.mtimeMs) || 0,
      state: backupFileState(entry, file)
    };
  });
  return { pc, backup };
}

function copyBytes(source, destination) {
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const input = fs.openSync(source, 'r');
  try {
    const output = fs.openSync(destination, 'w');
    try {
      let read;
      while ((read = fs.readSync(input, buffer, 0, buffer.length, null)) > 0) {
        let written = 0;
        while (written < read) written += fs.writeSync(output, buffer, written, read - written);
      }
    } finally {
      fs.closeSync(output);
    }
  } finally {
    fs.closeSync(input);
  }
}

function copyFileAtomic(source, destination, mtimeMs) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temp = destination + PART_SUFFIX;
  try {
    try {
      fs.copyFileSync(source, temp);
    } catch (err) {
      if (!COPY_RETRY_CODES.has(err.code)) throw err;
      copyBytes(source, temp);
    }
    if (Number.isFinite(mtimeMs)) {
      const time = new Date(mtimeMs);
      fs.utimesSync(temp, time, time);
    }
    fs.renameSync(temp, destination);
  } catch (err) {
    try { fs.unlinkSync(temp); } catch {  }
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
    try { fs.rmdirSync(dir); } catch {  }
  }
}

function removeStaleFiles(gameDir, keep) {
  let removed = 0;
  for (const relative of listFilesRelative(gameDir)) {
    const lower = relative.toLowerCase();
    if (keep.has(lower) || !lower.includes('/') || !FILE_FOLDERS.has(lower.split('/')[0])) continue;
    try {
      fs.unlinkSync(path.join(gameDir, ...relative.split('/')));
      if (!relative.endsWith(PART_SUFFIX)) removed++;
    } catch {  }
  }
  for (const name of FILE_FOLDER_NAMES) removeEmptyDirs(path.join(gameDir, name), false);
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
      try { fs.unlinkSync(temp); } catch {  }
      summary.errors.push({ path: keys[i].key, error: result.error || 'Registry export failed.' });
    }
  }

  let names = [];
  try { names = fs.readdirSync(registryDir); } catch {  }
  for (const name of names) {
    if (!entries.some((entry) => entry.file === `${REGISTRY_DIR}/${name}`)) {
      try { fs.unlinkSync(path.join(registryDir, name)); } catch {  }
    }
  }
  return entries;
}

async function backupGame(game, { backupRoot, vars, registry, cloudRoots = oneDriveRoots() }) {
  const gameDir = gameBackupDir(backupRoot, game.name, game.kind || 'manifest');
  const previous = readMappingAt(gameDir);
  const previousByPath = recordedByKey(previous ? previous.files : [], vars);
  const summary = { name: game.name, copied: 0, unchanged: 0, removed: 0, bytes: 0, errors: [] };
  const entries = [];
  const keep = new Set();

  for (const file of game.files) {
    const collapsed = collapsePath(file.path, fileVars(vars, file));
    const relative = collapsed && backupFilePath(collapsed);
    const destination = relative && path.join(gameDir, ...relative.split('/'));
    if (!destination || !isWithin(destination, gameDir)) {
      summary.errors.push({ path: file.path, error: 'This location cannot be backed up.' });
      continue;
    }

    const entry = { path: collapsed, file: relative, size: file.size, mtimeMs: file.mtimeMs };
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
      summary.errors.push({ path: file.path, ...copyFailure(err, [file.path, destination], cloudRoots) });
      const previousFile = before && recordedFile(before);
      if (previousFile && statOrNull(path.join(gameDir, ...previousFile.split('/')))) {
        entries.push(before);
        keep.add(previousFile.toLowerCase());
      }
    }
  }

  const registryEntries = await exportRegistry(game, gameDir, registry, summary);
  if (entries.length === 0 && registryEntries.length === 0) return summary;

  summary.removed = removeStaleFiles(gameDir, keep);
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

async function restoreGame({ name, kind = 'manifest', backupRoot, game, variants, registry, cloudRoots = oneDriveRoots(), now = new Date() }) {
  const gameDir = gameBackupDir(backupRoot, name, kind);
  const mapping = readMappingAt(gameDir);
  if (!mapping) throw new Error('There is no backup of this game.');

  const summary = { name, restored: 0, errors: [], safetyDir: null };
  const safetyDir = path.join(path.resolve(backupRoot), BEFORE_RESTORE_DIR, path.basename(gameDir), timestamp(now));
  const allowed = variants.map((vars) => ({
    vars,
    patterns: (game.files || []).map((file) => expandTemplate(file.path, vars)).filter(Boolean)
  }));

  for (const entry of mapping.files) {
    const relative = recordedFile(entry);
    const source = relative && path.join(gameDir, ...relative.split('/'));
    if (!source || !isWithin(source, gameDir) || !statOrNull(source)) {
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
        const safetyCopy = path.join(safetyDir, ...(backupFilePath(entry.path) || relative).split('/'));
        fs.mkdirSync(path.dirname(safetyCopy), { recursive: true });
        fs.copyFileSync(target, safetyCopy);
        summary.safetyDir = safetyDir;
      }
      copyFileAtomic(source, target, entry.mtimeMs);
      summary.restored++;
    } catch (err) {
      summary.errors.push({ path: target, ...copyFailure(err, [source, target], cloudRoots) });
    }
  }

  const allowedKeys = (game.registry || []).map((item) => item.key);
  for (const item of mapping.registry || []) {
    const file = path.join(gameDir, ...String(item.file).split('/'));
    let keys = null;
    try {
      if (isWithin(file, path.join(gameDir, REGISTRY_DIR))) keys = registry.readFileKeys(file);
    } catch {  }
    if (!keys || keys.length === 0 || !keys.every((key) => allowedKeys.some((allowedKey) => registryKeyWithin(key, allowedKey)))) {
      summary.errors.push({ path: String(item.key), error: "The registry file touches keys outside this game's own." });
      continue;
    }
    const safetyFile = path.join(safetyDir, REGISTRY_DIR, path.basename(file));
    fs.mkdirSync(path.dirname(safetyFile), { recursive: true });
    if ((await registry.exportKey(item.key, safetyFile)).success) summary.safetyDir = safetyDir;
    const result = await registry.importFile(file);
    if (result.success) summary.restored++;
    else summary.errors.push({ path: String(item.key), error: result.error || 'Registry import failed.' });
  }

  if (!summary.safetyDir) {
    try { fs.rmSync(safetyDir, { recursive: true, force: true }); } catch {  }
  }
  return summary;
}

module.exports = {
  BEFORE_RESTORE_DIR,
  DEFAULT_ROOT_NAME,
  backupGame,
  backupStatus,
  compareWithBackup,
  describeBackupRoot,
  gameBackupDir,
  gameFolderName,
  listBackups,
  mappingSummary,
  readMapping,
  resolveBackupRootChoice,
  restoreGame,
  restoreLocations
};
