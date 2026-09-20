
const fs = require('fs');
const path = require('path');

function parseLibraryFolders(text) {
  if (typeof text !== 'string' || !text) return [];
  const paths = [];
  const pattern = /"path"\s*"([^"]+)"/gi;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    paths.push(match[1].replace(/\\\\/g, '\\'));
  }
  return paths;
}

function acfField(text, name) {
  const match = new RegExp(`"${name}"\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'i').exec(text);
  return match ? match[1].replace(/\\(.)/g, '$1') : '';
}

function parseAcf(text) {
  if (typeof text !== 'string' || !text) return null;
  const appId = acfField(text, 'appid');
  const installDir = acfField(text, 'installdir');
  if (!/^\d+$/.test(appId) || !installDir) return null;
  return { appId, installDir, name: acfField(text, 'name') };
}

function parseEpicItem(text) {
  try {
    const item = JSON.parse(text);
    if (!item || typeof item.InstallLocation !== 'string' || !item.InstallLocation) return null;
    return { name: String(item.DisplayName || item.AppName || ''), installPath: item.InstallLocation };
  } catch {
    return null;
  }
}

function isDirectory(fsImpl, dir) {
  try {
    return fsImpl.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function readText(fsImpl, file) {
  try {
    return fsImpl.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function readDirNames(fsImpl, dir) {
  try {
    return fsImpl.readdirSync(dir);
  } catch {
    return [];
  }
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function detectSteam({ steamPath, env, fsImpl }) {
  const root = [
    steamPath,
    path.join(env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Steam'),
    path.join(env.ProgramFiles || 'C:\\Program Files', 'Steam')
  ]
    .filter((candidate) => typeof candidate === 'string' && candidate)
    .map((candidate) => path.normalize(candidate))
    .find((candidate) => isDirectory(fsImpl, candidate));
  if (!root) return null;

  const libraries = [path.join(root, 'steamapps')];
  const vdf = readText(fsImpl, path.join(root, 'steamapps', 'libraryfolders.vdf'));
  for (const libraryPath of parseLibraryFolders(vdf)) {
    const steamapps = path.join(libraryPath, 'steamapps');
    if (!libraries.some((known) => known.toLowerCase() === steamapps.toLowerCase())) libraries.push(steamapps);
  }

  const apps = [];
  for (const library of libraries) {
    for (const name of readDirNames(fsImpl, library)) {
      if (!/^appmanifest_\d+\.acf$/i.test(name)) continue;
      const manifest = parseAcf(readText(fsImpl, path.join(library, name)));
      if (!manifest) continue;
      apps.push({
        appId: manifest.appId,
        name: manifest.name,
        installPath: path.join(library, 'common', manifest.installDir)
      });
    }
  }
  return { root, libraries, apps };
}

function detectEpic({ env, fsImpl }) {
  const dir = path.join(env.ProgramData || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
  const games = [];
  for (const name of readDirNames(fsImpl, dir)) {
    if (!/\.item$/i.test(name)) continue;
    const item = parseEpicItem(readText(fsImpl, path.join(dir, name)));
    if (item && isDirectory(fsImpl, item.installPath)) games.push(item);
  }
  return games;
}

function detectGog({ entries, fsImpl }) {
  return asArray(entries)
    .filter((entry) => entry && typeof entry.path === 'string' && entry.path && isDirectory(fsImpl, entry.path))
    .map((entry) => ({ id: String(entry.id || ''), name: String(entry.name || ''), installPath: entry.path }));
}

function detectUbisoft({ installDir, env, fsImpl }) {
  const root = [
    installDir,
    path.join(env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Ubisoft', 'Ubisoft Game Launcher')
  ].find((candidate) => typeof candidate === 'string' && candidate && isDirectory(fsImpl, candidate));
  return root ? { root: path.normalize(root) } : null;
}

function detectLaunchers({ probe = {}, env = process.env, fsImpl = fs } = {}) {
  return {
    steam: detectSteam({ steamPath: probe.steam, env, fsImpl }),
    epic: detectEpic({ env, fsImpl }),
    gog: detectGog({ entries: probe.gog, fsImpl }),
    ubisoft: detectUbisoft({ installDir: probe.ubisoft, env, fsImpl })
  };
}

module.exports = {
  asArray,
  detectLaunchers,
  parseAcf,
  parseEpicItem,
  parseLibraryFolders
};
