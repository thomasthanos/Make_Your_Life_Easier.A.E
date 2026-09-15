/**
 * Manifest placeholders, in both directions.
 *
 * Expanding turns `<winAppData>/Game/*.sav` into a pattern for this machine.
 * Collapsing does the reverse for a file that was found, so a backup records
 * `<winAppData>/Game/slot1.sav` rather than `C:\Users\me\...` and can be
 * restored under a different user name or on another PC.
 */

const os = require('os');
const path = require('path');
const { escapeGlob, toSlash } = require('./glob');

// Roots a collapsed path may start with. The longest match wins; on equal
// length the earlier name does.
const COLLAPSE_ROOTS = ['base', 'root', 'winDocuments', 'winLocalAppData', 'winAppData', 'winProgramData', 'winPublic', 'home', 'winDir'];

// Steam and Ubisoft keep one folder per account; any account on this PC counts.
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

/**
 * Values for the placeholders that depend only on the machine and user.
 * @param {Object} [env=process.env] - Environment variables
 * @param {{documents?: string}} [options] - The real Documents folder, which
 *   may be redirected into OneDrive and so cannot be derived from the profile
 * @returns {Object} Placeholder name → absolute path
 */
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

/**
 * Substitute placeholders to get a glob pattern for this machine.
 * @param {string} template - Manifest path such as `<base>/Saves/*.sav`
 * @param {Object} vars - Placeholder values (machine variables plus base/root/game)
 * @returns {string|null} The pattern, or null when a placeholder has no value here
 */
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

/**
 * Express a real path relative to the most specific known root.
 * @param {string} filePath - Absolute path of a found file
 * @param {Object} vars - Placeholder values
 * @returns {string|null} e.g. `<winAppData>/Game/slot1.sav`, or null when outside every root
 */
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
  // A recorded path is data read back from a backup folder, which may live in
  // a synced cloud folder. It must not be able to climb out of its root.
  if (segments.some((segment) => segment === '.' || segment === '..' || /[\\:]/.test(segment))) return null;
  return { root: match[1], segments };
}

/**
 * Turn a collapsed path back into a real one on this machine.
 * @param {string} collapsed - Path produced by collapsePath()
 * @param {Object} vars - Placeholder values
 * @returns {string|null} Absolute path, or null when malformed or unresolvable
 */
function expandCollapsed(collapsed, vars) {
  const parts = collapsedParts(collapsed);
  const base = parts && vars && vars[parts.root];
  if (!parts || typeof base !== 'string' || !base) return null;
  return path.join(base, ...parts.segments);
}

/**
 * Where a file lives inside a game's backup folder: `winAppData/Game/slot1.sav`.
 * @param {string} collapsed - Path produced by collapsePath()
 * @returns {string|null} `/`-separated relative path, or null when malformed
 */
function backupRelativePath(collapsed) {
  const parts = collapsedParts(collapsed);
  if (!parts || parts.segments.length === 0) return null;
  return [parts.root, ...parts.segments].join('/');
}

module.exports = {
  backupRelativePath,
  collapsePath,
  expandCollapsed,
  expandTemplate,
  machineVariables
};
