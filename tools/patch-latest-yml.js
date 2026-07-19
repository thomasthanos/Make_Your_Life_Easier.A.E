const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const distDir = path.join(__dirname, '..', 'artifacts', 'dist');
const latestPath = path.join(distDir, 'latest.yml');
const version = require('../package.json').version;

const zipName = fs.readdirSync(distDir).find(f => /-win\.zip$/i.test(f));
if (!zipName) {
    console.error('patch-latest-yml: no *-win.zip found in ' + distDir);
    process.exit(1);
}

const zipPath = path.join(distDir, zipName);
const zipSize = fs.statSync(zipPath).size;
const hash = crypto.createHash('sha512');
hash.update(fs.readFileSync(zipPath));
const zipSha512 = hash.digest('base64');

const yml =
    `version: ${version}\n` +
    `files:\n` +
    `  - url: ${zipName}\n` +
    `    sha512: ${zipSha512}\n` +
    `    size: ${zipSize}\n` +
    `path: ${zipName}\n` +
    `sha512: ${zipSha512}\n` +
    `releaseDate: '${new Date().toISOString()}'\n`;

fs.writeFileSync(latestPath, yml);
console.log('patch-latest-yml: wrote latest.yml for v' + version + ' (' + zipName + ', ' + zipSize + ' bytes)');
