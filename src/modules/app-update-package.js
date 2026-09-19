/**
 * App Update Package Module
 * The small "app-only" update: the resources/ folder of a build plus a manifest
 * of the Electron runtime it was built against. When an install's runtime
 * matches that manifest, the updater downloads this (~3 MB) instead of the
 * whole app (~130 MB) and copies the unchanged runtime files over locally.
 *
 * Shared by the build scripts (plain Node) and the in-app updater, so it never
 * requires electron. Functions that touch an install take the fs module as a
 * parameter: the updater passes original-fs, because Electron's patched fs
 * opens any app.asar it looks at and keeps it open, and the swapper can then
 * no longer move the folder.
 */

const nodeFs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RUNTIME_MANIFEST = 'runtime-manifest.json';
const APP_DIR = 'resources';

/**
 * File name of a release's app-only update package
 * @param {string} productName - build.productName from package.json
 * @param {string} version - Release version
 * @returns {string} e.g. MakeYourLifeEasier-app-4.7.2.zip
 */
function appPackageName(productName, version) {
  return `${productName}-app-${version}.zip`;
}

/**
 * SHA-256 of a file, streamed
 * @param {string} filePath - File to hash
 * @param {Object} [fs] - fs module to read with
 * @returns {Promise<string>} Lowercase hex digest
 */
function hashFile(filePath, fs = nodeFs) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Every file under a folder, as paths relative to it with forward slashes
 * @param {string} dir - Folder to walk
 * @param {string} [prefix] - Sub-path reached so far
 * @returns {string[]} Relative file paths
 */
function listFiles(dir, prefix = '') {
  const out = [];
  for (const entry of nodeFs.readdirSync(path.join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(dir, rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

const sameName = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const isAppPath = (rel) => sameName(rel, APP_DIR) || String(rel).toLowerCase().startsWith(`${APP_DIR}/`);

/**
 * Describe the Electron runtime of a built app: every file outside resources/
 * except the main exe, which electron-builder stamps with the app version and
 * re-signs on every build even when the Electron inside it is unchanged.
 * @param {string} appDir - The build's unpacked app folder (win-unpacked)
 * @param {{exeName: string, version: string, electron: string, updateShellVersion: number}} build
 * @returns {Promise<Object>} The runtime manifest
 */
async function buildRuntimeManifest(appDir, { exeName, version, electron, updateShellVersion }) {
  const files = [];
  for (const rel of listFiles(appDir).sort()) {
    if (isAppPath(rel) || sameName(rel, exeName)) continue;
    const full = path.join(appDir, rel);
    files.push({ path: rel, size: nodeFs.statSync(full).size, sha256: await hashFile(full) });
  }
  return { version, electron, updateShellVersion, exe: exeName, files };
}

/**
 * The app-only package a feed offers, when this install can take it: same
 * Electron and same shell version, so its exe and runtime can stay as they are.
 * @param {Object} info - Parsed latest.yml
 * @param {{electron: string, updateShellVersion: number}} local - What this install runs
 * @returns {{url: string, sha512: string, size: number}|null} The package, or null for a full update
 */
function pickAppUpdate(info, local) {
  const pkg = info && info.appUpdate;
  if (!pkg || typeof pkg.url !== 'string' || !pkg.url || typeof pkg.sha512 !== 'string' || !pkg.sha512) return null;
  if (!local || local.electron == null || local.updateShellVersion == null) return null;
  if (String(info.electronVersion) !== String(local.electron)) return null;
  if (String(info.updateShellVersion) !== String(local.updateShellVersion)) return null;
  return { url: pkg.url, sha512: pkg.sha512, size: Number(pkg.size) || 0 };
}

/**
 * Whether a manifest path is a plain relative path that stays inside the install
 * @param {string} rel - Path from the manifest
 * @returns {boolean} True when it has no drive, root, stream, '.' or '..' part
 */
function isSafeRelativePath(rel) {
  if (typeof rel !== 'string' || !rel || rel.includes('\\') || rel.includes(':') || rel.startsWith('/')) return false;
  return rel.split('/').every((part) => part && part !== '.' && part !== '..');
}

/**
 * Check a downloaded manifest against the install it is about to be applied to
 * @param {Object} manifest - Parsed runtime-manifest.json
 * @param {{version: string, exeName: string, electron: string, updateShellVersion: number}} expected
 * @throws {Error} When the package is not for this install or a path is unsafe
 */
function validateManifest(manifest, expected) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error('Runtime manifest is missing or empty');
  }
  const checks = [
    ['version', manifest.version, expected.version],
    ['Electron version', manifest.electron, expected.electron],
    ['shell version', manifest.updateShellVersion, expected.updateShellVersion]
  ];
  for (const [what, got, want] of checks) {
    if (want == null || String(got) !== String(want)) {
      throw new Error(`Update package ${what} is ${got}, this install needs ${want}`);
    }
  }
  if (!sameName(manifest.exe, expected.exeName)) {
    throw new Error(`Update package is for ${manifest.exe}, this install runs ${expected.exeName}`);
  }
  for (const file of manifest.files) {
    const rel = file && file.path;
    if (!isSafeRelativePath(rel) || isAppPath(rel) || sameName(rel, expected.exeName) || sameName(rel, RUNTIME_MANIFEST)) {
      throw new Error(`Unexpected path in runtime manifest: ${rel}`);
    }
    if (!Number.isSafeInteger(file.size) || file.size < 0 || !/^[0-9a-f]{64}$/.test(file.sha256)) {
      throw new Error(`Malformed runtime manifest entry: ${rel}`);
    }
  }
}

/**
 * Check that an extracted package holds only resources/ and the manifest, so
 * nothing in it can land outside resources/ in the new install
 * @param {Object} fs - fs module (original-fs in the app)
 * @param {string} stagingDir - Folder the package was extracted into
 * @throws {Error} When anything else is there
 */
function verifyPackageLayout(fs, stagingDir) {
  const names = fs.readdirSync(stagingDir);
  const unexpected = names.filter((name) => !sameName(name, APP_DIR) && !sameName(name, RUNTIME_MANIFEST));
  if (unexpected.length || !names.some((name) => sameName(name, APP_DIR)) || !names.some((name) => sameName(name, RUNTIME_MANIFEST))) {
    throw new Error(`Update package has an unexpected layout: ${names.join(', ')}`);
  }
}

/**
 * Complete a staging folder that already holds the new resources/ with the
 * runtime files of the current install. Each copy is hashed after it is written,
 * so a bad read or a local file that differs from the build fails here, before
 * anything is swapped.
 * @param {{fs: Object, installDir: string, stagingDir: string, manifest: Object, exeName: string}} options
 * @throws {Error} When a runtime file is missing, unreadable or different
 */
async function assembleStaging({ fs, installDir, stagingDir, manifest, exeName }) {
  for (const file of manifest.files) {
    const parts = file.path.split('/');
    const target = path.join(stagingDir, ...parts);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    try {
      await fs.promises.copyFile(path.join(installDir, ...parts), target);
    } catch (err) {
      throw new Error(`Could not copy runtime file ${file.path}: ${err.code || err.message}`);
    }
    const { size } = await fs.promises.stat(target);
    if (size !== file.size || await hashFile(target, fs) !== file.sha256) {
      throw new Error(`Runtime file differs from the update's: ${file.path}`);
    }
  }
  await fs.promises.copyFile(path.join(installDir, exeName), path.join(stagingDir, exeName));
}

module.exports = {
  RUNTIME_MANIFEST,
  appPackageName,
  hashFile,
  listFiles,
  buildRuntimeManifest,
  pickAppUpdate,
  validateManifest,
  verifyPackageLayout,
  assembleStaging
};
