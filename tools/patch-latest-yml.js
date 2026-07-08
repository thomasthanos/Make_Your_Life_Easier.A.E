const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const distDir = path.join(__dirname, '..', 'artifacts', 'dist');
const latestPath = path.join(distDir, 'latest.yml');

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

let yml = fs.readFileSync(latestPath, 'utf8');
if (yml.includes('url: ' + zipName)) {
    console.log('patch-latest-yml: ' + zipName + ' already listed');
    process.exit(0);
}

const marker = '\npath:';
const idx = yml.indexOf(marker);
if (idx === -1) {
    console.error('patch-latest-yml: unexpected latest.yml format');
    process.exit(1);
}

const entry = `  - url: ${zipName}\n    sha512: ${zipSha512}\n    size: ${zipSize}\n`;
yml = yml.slice(0, idx + 1) + entry + yml.slice(idx + 1);
fs.writeFileSync(latestPath, yml);
console.log('patch-latest-yml: added ' + zipName + ' (' + zipSize + ' bytes)');
