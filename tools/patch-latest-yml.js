const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');
const { appPackageName } = require('../src/modules/app-update-package');
const pkg = require('../package.json');

const distDir = path.join(__dirname, '..', 'artifacts', 'dist');
const latestPath = path.join(distDir, 'latest.yml');
const version = pkg.version;

function fail(message) {
    console.error('patch-latest-yml: ' + message);
    process.exit(1);
}

function describe(filePath) {
    return {
        size: fs.statSync(filePath).size,
        sha512: crypto.createHash('sha512').update(fs.readFileSync(filePath)).digest('base64')
    };
}

const zipName = fs.readdirSync(distDir).find(f => /-win\.zip$/i.test(f));
if (!zipName) fail('no *-win.zip found in ' + distDir);

const appZipName = appPackageName(pkg.build.productName, version);
if (!fs.existsSync(path.join(distDir, appZipName))) {
    fail(appZipName + ' not found; run tools/make-app-update.js first');
}

const zip = describe(path.join(distDir, zipName));
const appZip = describe(path.join(distDir, appZipName));
const electronVersion = require('electron/package.json').version;

const yml =
    `version: ${version}\n` +
    `files:\n` +
    `  - url: ${zipName}\n` +
    `    sha512: ${zip.sha512}\n` +
    `    size: ${zip.size}\n` +
    `path: ${zipName}\n` +
    `sha512: ${zip.sha512}\n` +
    `releaseDate: '${new Date().toISOString()}'\n` +
    `electronVersion: '${electronVersion}'\n` +
    `updateShellVersion: ${pkg.updateShellVersion}\n` +
    `appUpdate:\n` +
    `  url: ${appZipName}\n` +
    `  sha512: ${appZip.sha512}\n` +
    `  size: ${appZip.size}\n`;

const parsed = yaml.load(yml);
if (parsed.version !== version || parsed.files[0].url !== zipName || parsed.sha512 !== zip.sha512 ||
    parsed.electronVersion !== electronVersion || parsed.updateShellVersion !== pkg.updateShellVersion ||
    parsed.appUpdate.url !== appZipName || parsed.appUpdate.sha512 !== appZip.sha512 || parsed.appUpdate.size !== appZip.size) {
    fail('generated latest.yml does not read back as written');
}

fs.writeFileSync(latestPath, yml);
console.log(`patch-latest-yml: wrote latest.yml for v${version} (${zipName}, ${zip.size} bytes; ${appZipName}, ${appZip.size} bytes)`);
