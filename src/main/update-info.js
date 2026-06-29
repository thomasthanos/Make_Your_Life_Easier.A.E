const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const primaryPath = path.join(app.getPath('userData'), 'update-info.json');

const secondaryPath = process.platform === 'win32'
    ? path.join(process.env.PROGRAMDATA || path.join('C:\\', 'ProgramData'), 'MakeYourLifeEasier', 'update-info.json')
    : null;

function targetPaths() {
    return [primaryPath, secondaryPath].filter(Boolean);
}

async function writeAtomic(filePath, data) {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    await fs.promises.writeFile(tmp, data);
    await fs.promises.rename(tmp, filePath);
}

async function saveUpdateInfo(info) {
    const payload = JSON.stringify({ ...info, timestamp: info.timestamp || Date.now() });

    await writeAtomic(primaryPath, payload);

    if (secondaryPath) {
        try {
            await writeAtomic(secondaryPath, payload);
        } catch {
            // secondary mirror is best-effort (ProgramData may be read-only)
        }
    }
}

async function readAndClearUpdateInfo() {
    const paths = targetPaths();

    let content = null;
    for (const p of paths) {
        if (content == null) {
            try {
                content = await fs.promises.readFile(p, 'utf-8');
            } catch {
                // not present at this location
            }
        }
    }

    await Promise.all(paths.map(p => fs.promises.unlink(p).catch(() => {})));

    if (content == null) return null;
    try {
        return JSON.parse(content);
    } catch {
        return null;
    }
}

module.exports = {
    saveUpdateInfo,
    readAndClearUpdateInfo,
    primaryPath,
    secondaryPath
};
