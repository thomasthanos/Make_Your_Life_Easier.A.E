const { app } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { clientFor } = require('../modules/http-utils');
const { ensure7za } = require('../modules/archive-utils');

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function safeUnlink(filePath) {
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* ignore */ }
}

function cancelledError() {
    const err = new Error('Update cancelled');
    err.cancelled = true;
    return err;
}

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

function neutralUpdaterDir() {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, 'ThomasThanos', 'updater');
}

function stageUpdaterExe() {
    const source = path.join(process.resourcesPath, 'updater', 'Updater.exe');
    if (!fs.existsSync(source)) {
        throw new Error('Updater.exe not found at ' + source);
    }
    const targetDir = neutralUpdaterDir();
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

function downloadOnce(url, destPath, onProgress, isCancelled) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha512');
        const tmpPath = destPath + '.part';
        const startTime = Date.now();
        let received = 0;
        let total = 0;
        let file = null;
        let settled = false;
        let hardTimer = null;

        const fail = (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(hardTimer);
            try { if (file) file.destroy(); } catch { /* ignore */ }
            safeUnlink(tmpPath);
            reject(err);
        };

        hardTimer = setTimeout(() => fail(new Error('Download exceeded the time limit')), 20 * 60 * 1000);

        const doGet = (currentUrl, redirects) => {
            if (redirects > 5) return fail(new Error('Too many redirects'));

            const req = clientFor(currentUrl).get(currentUrl, { headers: { 'Cache-Control': 'no-cache' } }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    res.resume();
                    return doGet(new URL(res.headers.location, currentUrl).toString(), redirects + 1);
                }
                if (res.statusCode !== 200) {
                    res.resume();
                    return fail(new Error(`HTTP ${res.statusCode}`));
                }

                total = parseInt(res.headers['content-length'] || '0', 10);
                file = fs.createWriteStream(tmpPath);
                file.on('error', fail);

                res.on('data', (chunk) => {
                    if (isCancelled && isCancelled()) {
                        try { req.destroy(); } catch { /* ignore */ }
                        try { res.destroy(); } catch { /* ignore */ }
                        return fail(cancelledError());
                    }
                    hash.update(chunk);
                    received += chunk.length;
                    if (onProgress) {
                        const elapsed = (Date.now() - startTime) / 1000;
                        const speed = elapsed > 0 ? received / elapsed : 0;
                        onProgress({ received, total, speed });
                    }
                });
                res.on('error', fail);
                res.pipe(file);

                file.on('finish', () => {
                    file.close(() => {
                        if (settled) return;
                        if (total > 0 && received !== total) {
                            return fail(new Error(`Incomplete download: ${received}/${total} bytes`));
                        }
                        fs.rename(tmpPath, destPath, (err) => {
                            if (settled) return;
                            if (err) return fail(err);
                            settled = true;
                            clearTimeout(hardTimer);
                            resolve(hash.digest('base64'));
                        });
                    });
                });
            });

            req.on('error', fail);
            req.setTimeout(60000, () => req.destroy(new Error('Connection timed out')));
        };

        doGet(url, 0);
    });
}

async function downloadAndVerify({ url, sha512, version, onProgress, isCancelled, debug }) {
    const downloadDir = path.join(neutralUpdaterDir(), 'download');
    fs.mkdirSync(downloadDir, { recursive: true });
    const zipPath = path.join(downloadDir, `update-${version}.zip`);

    const delays = [2000, 5000, 10000];
    let lastErr = null;

    for (let attempt = 0; attempt < delays.length; attempt++) {
        if (isCancelled && isCancelled()) throw cancelledError();
        try {
            const digest = await downloadOnce(url, zipPath, onProgress, isCancelled);
            if (digest === sha512) return zipPath;
            debug('warn', 'Downloaded zip failed checksum, retrying');
            lastErr = new Error('Checksum verification failed');
            safeUnlink(zipPath);
        } catch (err) {
            if (err.cancelled) throw err;
            lastErr = err;
            safeUnlink(zipPath);
            debug('warn', `Download attempt ${attempt + 1} failed: ${err.message}`);
        }
        if (attempt < delays.length - 1) await sleep(delays[attempt]);
    }

    throw lastErr || new Error('Download failed');
}

async function extractToStaging(zipPath, stagingDir, exeName) {
    await fs.promises.rm(stagingDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 }).catch(() => {});
    fs.mkdirSync(stagingDir, { recursive: true });

    const sevenZip = await ensure7za();
    if (!sevenZip) throw new Error('7za.exe not found for extraction');

    await new Promise((resolve, reject) => {
        const child = spawn(sevenZip, ['x', zipPath, `-o${stagingDir}`, '-y'], { windowsHide: true });
        let stderr = '';
        child.stderr.on('data', (b) => { stderr += b.toString(); });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(stderr.trim() || `7za exited with code ${code}`));
        });
    });

    if (!fs.existsSync(path.join(stagingDir, exeName)) || !fs.existsSync(path.join(stagingDir, 'resources'))) {
        throw new Error('Staging sanity check failed: missing ' + exeName + ' or resources');
    }
}

function preserveFiles(installDir, stagingDir) {
    const items = ['Uninstall MakeYourLifeEasier.exe', path.join('resources', 'app-update.yml')];
    for (const rel of items) {
        try {
            const src = path.join(installDir, rel);
            const dst = path.join(stagingDir, rel);
            if (fs.existsSync(src) && !fs.existsSync(dst)) {
                fs.mkdirSync(path.dirname(dst), { recursive: true });
                fs.copyFileSync(src, dst);
            }
        } catch { /* best effort */ }
    }
}

function launchSwapper({ stagingDir, version, debug }) {
    const installDir = path.dirname(process.execPath);
    const updaterExe = stageUpdaterExe();
    const args = [
        '--pid', String(process.pid),
        '--app-dir', installDir,
        '--exe', path.basename(process.execPath),
        '--staging', stagingDir,
        '--user-data', app.getPath('userData'),
        '--version', version
    ];
    debug('info', `Launching swapper for v${version}`);
    const child = spawn(updaterExe, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        cwd: path.dirname(updaterExe)
    });
    child.unref();
}

function formatEta(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return 'Calculating';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

async function runInAppUpdate({ info, feedUrl, onStatus, isCancelled, debug }) {
    if (!app.isPackaged) throw new Error('In-app update requires a packaged app');

    const installDir = path.dirname(process.execPath);
    const stagingDir = installDir + '.staging';
    const exeName = path.basename(process.execPath);

    const zip = resolveZipFile(info);
    const url = resolveAbsoluteUrl(zip.url, feedUrl);

    onStatus({ status: 'downloading', message: 'Downloading update... 0%', percent: 0 });

    const zipPath = await downloadAndVerify({
        url,
        sha512: zip.sha512,
        version: info.version,
        isCancelled,
        debug,
        onProgress: ({ received, total, speed }) => {
            const percent = total > 0 ? Math.round(received * 100 / total) : 0;
            const eta = speed > 0 && total > 0 ? formatEta((total - received) / speed) : 'Calculating';
            onStatus({
                status: 'downloading',
                message: `Downloading update... ${percent}%`,
                percent,
                transferred: received,
                totalBytes: total,
                bytesPerSecond: speed,
                downloaded: (received / 1048576).toFixed(2),
                total: (total / 1048576).toFixed(2),
                speed: (speed / 1048576).toFixed(2),
                eta
            });
        }
    });

    if (isCancelled && isCancelled()) throw cancelledError();

    onStatus({ status: 'extracting', message: 'Extracting update...', percent: 100 });
    await extractToStaging(zipPath, stagingDir, exeName);
    preserveFiles(installDir, stagingDir);
    safeUnlink(zipPath);

    return { stagingDir };
}

module.exports = { runInAppUpdate, launchSwapper };
