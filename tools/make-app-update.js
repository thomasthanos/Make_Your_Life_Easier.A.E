
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
