/**
 * Build the app-only update package next to the full zip:
 *
 *   MakeYourLifeEasier-app-<version>.zip
 *     resources/**            exactly as in MakeYourLifeEasier-win.zip
 *     runtime-manifest.json   the Electron runtime this build was made with
 *
 * Installs whose runtime matches the manifest download this (~3 MB) instead of
 * the full zip (see src/modules/app-update-package.js).
 *
 * Everything is taken from the full zip itself, not from win-unpacked:
 * electron-builder keeps changing win-unpacked after the zip is written (the
 * portable target adds resources/elevate.exe, the Setup build re-signs every
 * exe), and the package must hold exactly what a full update installs. The
 * comparison with the full zip at the end fails the build if it ever does not.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { RUNTIME_MANIFEST, appPackageName, buildRuntimeManifest, listFiles } = require('../src/modules/app-update-package');
const { getAuthenticodeStatus } = require('../src/modules/process-utils');
const pkg = require('../package.json');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'artifacts', 'dist');
const tmpDir = path.join(distDir, '.app-update-tmp');
const extractDir = path.join(tmpDir, 'full');
const sevenZip = path.join(root, 'src', 'resources', 'bin', '7za.exe');
const exeName = `${pkg.build.productName}.exe`;
const appZipName = appPackageName(pkg.build.productName, pkg.version);
const appZipPath = path.join(distDir, appZipName);

function fail(message) {
    console.error('make-app-update: ' + message);
    process.exit(1);
}

/**
 * Files in a zip as path -> "crc:size", from 7za's technical listing
 * @param {string} zipPath - Archive to list
 * @returns {Map<string, string>} Entries keyed by forward-slash path
 */
function zipEntries(zipPath) {
    const listing = execFileSync(sevenZip, ['l', '-slt', zipPath], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const entries = new Map();
    for (const block of listing.split(/\r?\n\r?\n/)) {
        const field = (name) => (block.match(new RegExp(`^${name} = (.*)$`, 'm')) || [])[1];
        if (field('Folder') !== '-') continue;
        entries.set(field('Path').replace(/\\/g, '/'), `${field('CRC')}:${field('Size')}`);
    }
    return entries;
}

/**
 * With a certificate configured, every exe in the build must carry a signature.
 * The self-signed certificate is not trusted on the CI runner, so anything but
 * NotSigned or HashMismatch is accepted.
 * @param {string} appDir - Extracted full zip
 */
async function checkSigned(appDir) {
    const certFile = pkg.build.win?.signtoolOptions?.certificateFile;
    if (!certFile || !fs.existsSync(path.join(root, certFile))) {
        console.warn('make-app-update: no signing certificate, packaging unsigned binaries');
        return;
    }
    const exes = listFiles(appDir).filter((f) => /\.exe$/i.test(f));
    for (const rel of exes) {
        const status = await getAuthenticodeStatus(path.join(appDir, rel));
        if (!status || status === 'NotSigned' || status === 'HashMismatch') {
            fail(`${rel} is not signed (${status || 'signature could not be read'})`);
        }
    }
    console.log(`make-app-update: ${exes.length} executables signed (${exes.join(', ')})`);
}

/**
 * The package's resources/ must be byte-identical to the full zip's, and it may
 * hold nothing else besides the manifest
 * @param {string} fullZipPath - The full update zip of this build
 * @returns {number} Number of resource files in the package
 */
function checkMatchesFullZip(fullZipPath) {
    const full = zipEntries(fullZipPath);
    const app = zipEntries(appZipPath);
    const isResource = (p) => p.startsWith('resources/');

    const unexpected = [...app.keys()].filter((p) => p !== RUNTIME_MANIFEST && !isResource(p));
    const differ = [...full.keys()].filter(isResource).filter((p) => app.get(p) !== full.get(p));
    const extra = [...app.keys()].filter(isResource).filter((p) => !full.has(p));
    const problems = [...unexpected, ...differ, ...extra];

    if (problems.length || !app.has(RUNTIME_MANIFEST)) {
        fail(`the package does not match ${path.basename(fullZipPath)}: ${problems.join(', ') || RUNTIME_MANIFEST + ' missing'}`);
    }
    return [...app.keys()].filter(isResource).length;
}

async function main() {
    if (!Number.isInteger(pkg.updateShellVersion) || pkg.updateShellVersion < 1) {
        fail('package.json "updateShellVersion" must be a positive integer');
    }
    const fullZipName = fs.readdirSync(distDir).find((f) => /-win\.zip$/i.test(f));
    if (!fullZipName) fail('no *-win.zip in ' + distDir + '; run electron-builder first');
    const fullZipPath = path.join(distDir, fullZipName);

    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });
    execFileSync(sevenZip, ['x', fullZipPath, `-o${extractDir}`, '-y'], { stdio: 'pipe' });
    if (!fs.existsSync(path.join(extractDir, exeName))) fail(`${exeName} not found in ${fullZipName}`);

    await checkSigned(extractDir);

    const electron = require('electron/package.json').version;
    const manifest = await buildRuntimeManifest(extractDir, {
        exeName,
        version: pkg.version,
        electron,
        updateShellVersion: pkg.updateShellVersion
    });
    fs.writeFileSync(path.join(tmpDir, RUNTIME_MANIFEST), JSON.stringify(manifest, null, 2));

    fs.rmSync(appZipPath, { force: true });
    execFileSync(sevenZip, ['a', '-tzip', '-mx=9', appZipPath, 'resources'], { cwd: extractDir, stdio: 'pipe' });
    execFileSync(sevenZip, ['a', '-tzip', '-mx=9', appZipPath, RUNTIME_MANIFEST], { cwd: tmpDir, stdio: 'pipe' });
    fs.rmSync(tmpDir, { recursive: true, force: true });

    const resourceCount = checkMatchesFullZip(fullZipPath);
    const mb = (bytes) => (bytes / 1048576).toFixed(1);
    console.log(`make-app-update: ${appZipName} ${mb(fs.statSync(appZipPath).size)} MB` +
        ` (${resourceCount} resource files; runtime: ${manifest.files.length} files, Electron ${electron}, shell v${pkg.updateShellVersion})`);
}

main().catch((err) => fail(err.stack || err.message));
