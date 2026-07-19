const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'artifacts', 'dist');

const keep = new Set([
    'MakeYourLifeEasier-Setup.exe',
    'MakeYourLifeEasier-Portable.exe',
    'MakeYourLifeEasier-win.zip',
    'latest.yml'
]);

if (!fs.existsSync(distDir)) {
    console.log('clean-dist: no dist directory, nothing to clean');
    process.exit(0);
}

let removed = 0;
for (const name of fs.readdirSync(distDir)) {
    if (keep.has(name)) continue;
    const target = path.join(distDir, name);
    try {
        fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
        console.log('clean-dist: removed ' + name);
        removed++;
    } catch (err) {
        console.warn('clean-dist: could not remove ' + name + ' (' + err.message + ')');
    }
}

const missing = [...keep].filter(name => !fs.existsSync(path.join(distDir, name)));
if (missing.length) {
    console.warn('clean-dist: expected artifact(s) missing: ' + missing.join(', '));
}

console.log('clean-dist: done (' + removed + ' item(s) removed, ' + (keep.size - missing.length) + ' kept)');
