
const nodeFs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RUNTIME_MANIFEST = 'runtime-manifest.json';
const APP_DIR = 'resources';

function appPackageName(productName, version) {
  return `${productName}-app-${version}.zip`;
}

function hashFile(filePath, fs = nodeFs) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

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

async function buildRuntimeManifest(appDir, { exeName, version, electron, updateShellVersion }) {
  const files = [];
  for (const rel of listFiles(appDir).sort()) {
    if (isAppPath(rel) || sameName(rel, exeName)) continue;
    const full = path.join(appDir, rel);
    files.push({ path: rel, size: nodeFs.statSync(full).size, sha256: await hashFile(full) });
  }
  return { version, electron, updateShellVersion, exe: exeName, files };
}

function pickAppUpdate(info, local) {
  const pkg = info && info.appUpdate;
  if (!pkg || typeof pkg.url !== 'string' || !pkg.url || typeof pkg.sha512 !== 'string' || !pkg.sha512) return null;
  if (!local || local.electron == null || local.updateShellVersion == null) return null;
  if (String(info.electronVersion) !== String(local.electron)) return null;
  if (String(info.updateShellVersion) !== String(local.updateShellVersion)) return null;
  return { url: pkg.url, sha512: pkg.sha512, size: Number(pkg.size) || 0 };
}

function isSafeRelativePath(rel) {
  if (typeof rel !== 'string' || !rel || rel.includes('\\') || rel.includes(':') || rel.startsWith('/')) return false;
  return rel.split('/').every((part) => part && part !== '.' && part !== '..');
}

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

function verifyPackageLayout(fs, stagingDir) {
  const names = fs.readdirSync(stagingDir);
  const unexpected = names.filter((name) => !sameName(name, APP_DIR) && !sameName(name, RUNTIME_MANIFEST));
  if (unexpected.length || !names.some((name) => sameName(name, APP_DIR)) || !names.some((name) => sameName(name, RUNTIME_MANIFEST))) {
    throw new Error(`Update package has an unexpected layout: ${names.join(', ')}`);
  }
}

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
