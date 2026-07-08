const { app } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

function resolveZipFile(info) {
    const files = Array.isArray(info.files) ? info.files : [];
    const zip = files.find(f => typeof f.url === 'string' && f.url.toLowerCase().endsWith('.zip'));
    if (!zip || !zip.sha512) {
        throw new Error('No zip artifact found in update feed');
    }
    return zip;
}

function resolveAbsoluteUrl(fileUrl, feedUrl) {
    if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
    if (!feedUrl) throw new Error('Update feed URL is not configured');
    const base = feedUrl.endsWith('/') ? feedUrl : feedUrl + '/';
    return new URL(fileUrl, base).toString();
}

function stageUpdaterExe() {
    const source = path.join(process.resourcesPath, 'updater', 'Updater.exe');
    if (!fs.existsSync(source)) {
        throw new Error('Updater.exe not found at ' + source);
    }
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const targetDir = path.join(localAppData, 'ThomasThanos', 'updater');
    fs.mkdirSync(targetDir, { recursive: true });
    const target = path.join(targetDir, 'Updater.exe');
    try {
        fs.copyFileSync(source, target);
        return target;
    } catch (err) {
        if (err.code === 'EBUSY' || err.code === 'EPERM') {
            const fallback = path.join(targetDir, `Updater-${Date.now()}.exe`);
            fs.copyFileSync(source, fallback);
            return fallback;
        }
        throw err;
    }
}

function launchExternalUpdater({ info, feedUrl, debug }) {
    if (!app.isPackaged) {
        throw new Error('External updater requires a packaged app');
    }
    const zip = resolveZipFile(info);
    const url = resolveAbsoluteUrl(zip.url, feedUrl);
    const updaterExe = stageUpdaterExe();
    const args = [
        '--pid', String(process.pid),
        '--app-dir', path.dirname(process.execPath),
        '--exe', path.basename(process.execPath),
        '--url', url,
        '--sha512', zip.sha512,
        '--version', info.version,
        '--user-data', app.getPath('userData')
    ];
    debug('info', `Launching external updater for v${info.version}`);
    const child = spawn(updaterExe, args, {
        detached: true,
        stdio: 'ignore',
        cwd: path.dirname(updaterExe)
    });
    child.unref();
}

module.exports = { launchExternalUpdater };
