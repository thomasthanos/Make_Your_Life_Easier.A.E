
const os = require('os');
const path = require('path');
const { escapeGlob, toSlash } = require('./glob');

const COLLAPSE_ROOTS = ['base', 'root', 'winDocuments', 'winLocalAppDataLow', 'winLocalAppData', 'winAppData', 'winProgramData', 'winPublic', 'home', 'winDir'];

const BACKUP_FOLDERS = {
  base: 'Game folder',
  root: 'Launcher folder',
  winDocuments: 'Documents',
  winLocalAppDataLow: 'AppData LocalLow',
  winLocalAppData: 'AppData Local',
  winAppData: 'AppData Roaming',
  winProgramData: 'ProgramData',
  winPublic: 'Public',
  home: 'User folder',
  winDir: 'Windows'
};

const WILDCARD_PLACEHOLDERS = new Set(['storeUserId', 'storeGameId']);

const COLLAPSED = /^<([a-zA-Z]+)>(?:\/(.*))?$/;

function currentUserName(env) {
  if (env.USERNAME) return env.USERNAME;
  try {
    return os.userInfo().username;
  } catch {
    return '';
  }
}

function machineVariables(env = process.env, { documents } = {}) {
  const home = env.USERPROFILE || os.homedir();
  const systemRoot = `${env.SystemDrive || 'C:'}\\`;
  return {
    home,
    winAppData: env.APPDATA || path.join(home, 'AppData', 'Roaming'),
    winLocalAppData: env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'),
    winLocalAppDataLow: path.join(home, 'AppData', 'LocalLow'),
    winDocuments: documents || path.join(home, 'Documents'),
    winPublic: env.PUBLIC || path.join(systemRoot, 'Users', 'Public'),
    winProgramData: env.ProgramData || env.ALLUSERSPROFILE || path.join(systemRoot, 'ProgramData'),
    winDir: env.WINDIR || env.SystemRoot || path.join(systemRoot, 'Windows'),
    osUserName: currentUserName(env)
  };
}

function expandTemplate(template, vars) {
  let unresolved = false;
  const pattern = String(template).replace(/<([a-zA-Z]+)>/g, (whole, name) => {
    if (WILDCARD_PLACEHOLDERS.has(name)) return '*';
    const value = vars && vars[name];
    if (typeof value !== 'string' || !value) {
      unresolved = true;
      return whole;
    }
    return escapeGlob(toSlash(value));
  });
  return unresolved ? null : pattern;
}

function collapsePath(filePath, vars) {
  const target = toSlash(path.resolve(filePath));
  const lowerTarget = target.toLowerCase();
  let best = null;
  for (const name of COLLAPSE_ROOTS) {
    const value = vars && vars[name];
    if (typeof value !== 'string' || !value) continue;
    const prefix = toSlash(path.resolve(value));
    const lowerPrefix = prefix.toLowerCase();
    const inside = lowerTarget === lowerPrefix || lowerTarget.startsWith(`${lowerPrefix}/`);
    if (inside && (!best || prefix.length > best.prefix.length)) best = { name, prefix };
  }
  if (!best) return null;
  const rest = target.slice(best.prefix.length).replace(/^\//, '');
  return rest ? `<${best.name}>/${rest}` : `<${best.name}>`;
}

function collapsedParts(collapsed) {
  const match = COLLAPSED.exec(String(collapsed));
  if (!match || !COLLAPSE_ROOTS.includes(match[1])) return null;
  const segments = (match[2] || '').split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..' || /[\\:]/.test(segment))) return null;
  return { root: match[1], segments };
}

function expandCollapsed(collapsed, vars) {
  const parts = collapsedParts(collapsed);
  const base = parts && vars && vars[parts.root];
  if (!parts || typeof base !== 'string' || !base) return null;
  return path.join(base, ...parts.segments);
}

function backupFilePath(collapsed) {
  const parts = collapsedParts(collapsed);
  if (!parts || parts.segments.length === 0) return null;
  return [BACKUP_FOLDERS[parts.root], ...parts.segments].join('/');
}

function backupRelativePath(collapsed) {
  const parts = collapsedParts(collapsed);
  if (!parts || parts.segments.length === 0) return null;
  return [parts.root, ...parts.segments].join('/');
}

module.exports = {
  BACKUP_FOLDERS,
  backupFilePath,
  backupRelativePath,
  collapsePath,
  expandCollapsed,
  expandTemplate,
  machineVariables
};
