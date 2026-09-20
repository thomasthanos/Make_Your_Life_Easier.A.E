
const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');
const { clientFor } = require('./http-utils');
const { sanitizeFilename, extFromUrl, removeFileIfExistsSync, cleanupExtractDirs, checkFileSignature, readFileHead } = require('./file-utils');
const { isWithin, writableRoots } = require('./security');

const activeDownloads = new Map();

const downloadedFiles = new Map();
const extractedDirs = new Map();

const DELETING_SUFFIX = '.deleting';
const RM_OPTIONS = { recursive: true, force: true, maxRetries: 2, retryDelay: 100 };

function userDataDir() {
  try { return app.getPath('userData'); } catch { return null; }
}

let cleanupManifestPath = null;
function manifestPath() {
  if (!cleanupManifestPath) {
    const dir = userDataDir();
    cleanupManifestPath = dir ? path.join(dir, 'pending-cleanup.json') : null;
  }
  return cleanupManifestPath;
}

function persistTracking() {
  try {
    const p = manifestPath();
    if (!p) return;
    if (downloadedFiles.size === 0 && extractedDirs.size === 0) {
      fs.rmSync(p, { force: true });
      return;
    }
    const list = (map) => [...map].map(([target, stamp]) => ({ path: target, stamp }));
    fs.writeFileSync(p, JSON.stringify({ files: list(downloadedFiles), dirs: list(extractedDirs) }));
  } catch { }
}

let manifestLoaded = false;

function loadManifest() {
  if (manifestLoaded) return;
  manifestLoaded = true;
  try {
    const p = manifestPath();
    if (!p || !fs.existsSync(p)) return;
    const manifest = JSON.parse(fs.readFileSync(p, 'utf-8')) || {};
    const restore = (map, items) => {
      for (const item of Array.isArray(items) ? items : []) {
        const target = typeof item === 'string' ? item : item?.path;
        if (typeof target === 'string' && target && !map.has(target)) map.set(target, item?.stamp || null);
      }
    };
    restore(downloadedFiles, manifest.files);
    restore(extractedDirs, manifest.dirs);
  } catch { }
}

const STALL_TIMEOUT_MS = 120000;
const STALL_CHECK_INTERVAL_MS = 5000;

function safeSend(mainWindow, channel, data) {
  try {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send(channel, data);
    }
  } catch {  }
}

const MAX_TRACKED_ITEMS = 50;

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MakeYourLifeEasier'
};

function startDownload(id, url, dest, mainWindow, headers) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      safeSend(mainWindow, 'download-event', { id, status: 'error', error: 'Only http/https URLs are allowed' });
      return;
    }
  } catch (err) {
    safeSend(mainWindow, 'download-event', { id, status: 'error', error: 'Invalid URL format' });
    return;
  }

  const downloadsDir = path.join(os.homedir(), 'Downloads');

  const requestHeaders = { ...DEFAULT_HEADERS, ...(headers || {}) };

  const start = (downloadUrl, redirects = 0) => {
    const DOWNLOAD_TIMEOUT = 5 * 60 * 1000;

    const req = clientFor(downloadUrl).get(downloadUrl, { headers: requestHeaders }, (res) => {
      if (downloadTimeout) clearTimeout(downloadTimeout);
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects >= 5) {
          activeDownloads.delete(id);
          safeSend(mainWindow, 'download-event', { id, status: 'error', error: 'Too many redirects' });
          return;
        }
        const nextUrl = new URL(res.headers.location, downloadUrl).toString();
        start(nextUrl, redirects + 1);
        return;
      }

      if (res.statusCode !== 200) {
        res.resume();
        activeDownloads.delete(id);
        safeSend(mainWindow, 'download-event', { id, status: 'error', error: `HTTP ${res.statusCode}` });
        return;
      }

      const isAbsolute = dest && path.isAbsolute(dest);
      let finalPath;
      let finalName;
      let destDirForCleanup;

      if (isAbsolute) {
        finalPath = dest;
        finalName = path.basename(dest);
        destDirForCleanup = path.dirname(dest);
      } else {
        const sanitizedDest = sanitizeFilename(dest || '');
        const cd = res.headers['content-disposition'] || '';
        const cdMatch = cd.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
        const cdFile = cdMatch ? path.basename(cdMatch[1]) : '';
        const chosenExt = path.extname(sanitizedDest) || (cdFile ? path.extname(cdFile) : '') || extFromUrl(downloadUrl) || '.bin';
        const base = sanitizedDest ? path.basename(sanitizedDest, path.extname(sanitizedDest)) : (cdFile ? path.basename(cdFile, path.extname(cdFile)) : 'download');
        finalName = sanitizeFilename(base) + chosenExt;
        finalPath = path.join(downloadsDir, finalName);
        destDirForCleanup = downloadsDir;
      }

      const tempPath = finalPath + '.part';

      removeFileIfExistsSync(finalPath);
      if (!isAbsolute) {
        cleanupExtractDirs(finalName, destDirForCleanup);
      }

      const total = parseInt(res.headers['content-length'] || '0', 10);
      const file = fs.createWriteStream(tempPath);
      const d = { response: res, file, total, received: 0, filePath: tempPath, finalPath, lastProgress: Date.now(), cleaned: false };
      activeDownloads.set(id, d);

      safeSend(mainWindow, 'download-event', { id, status: 'started', total });

      const cleanup = (errMsg) => {
        if (d.cleaned) return;
        d.cleaned = true;
        if (d.stallInterval) clearInterval(d.stallInterval);
        try { res.unpipe(file); } catch { }
        try { res.removeAllListeners(); } catch { }
        try { res.destroy(); } catch { }
        try { file.removeAllListeners(); } catch { }
        try { file.destroy(); } catch { }
        try { file.close(() => { }); } catch { }
        try { fs.unlink(tempPath, () => { }); } catch { }
        activeDownloads.delete(id);
        if (errMsg) {
          safeSend(mainWindow, 'download-event', { id, status: 'error', error: errMsg });
        }
      };

      d.stallInterval = setInterval(() => {
        const now = Date.now();
        if (d.lastProgress && now - d.lastProgress > STALL_TIMEOUT_MS) {
          cleanup(`Download stalled - no data received for ${STALL_TIMEOUT_MS / 1000} seconds`);
        }
      }, STALL_CHECK_INTERVAL_MS);

      res.on('data', (chunk) => {
        d.received += chunk.length;
        d.lastProgress = Date.now();
        const percent = total > 0 ? Math.round((d.received / total) * 100) : null;
        safeSend(mainWindow, 'download-event', { id, status: 'progress', percent, received: d.received, total });
      });

      res.on('error', (err) => cleanup(err.message));
      file.on('error', (err) => cleanup(err.message));
      res.pipe(file);

      file.once('finish', () => {
        if (d.cleaned) return;
        file.close(() => {
          if (d.cleaned) return;
          if (d.stallInterval) clearInterval(d.stallInterval);

          (async () => {
            try {
              if (d.cleaned) return;
              const badFile = checkFileSignature(path.extname(finalPath), await readFileHead(tempPath));
              if (d.cleaned) return;
              if (badFile) {
                activeDownloads.delete(id);
                removeFileIfExistsSync(tempPath);
                safeSend(mainWindow, 'download-event', { id, status: 'error', error: badFile });
                return;
              }
              await fs.promises.rename(tempPath, finalPath);
              if (d.cleaned) {
                removeFileIfExistsSync(finalPath);
                return;
              }
              activeDownloads.delete(id);
              trackDownloadedFile(finalPath);
              safeSend(mainWindow, 'download-event', { id, status: 'complete', path: finalPath });
            } catch (err) {
              if (d.cleaned) return;
              activeDownloads.delete(id);
              removeFileIfExistsSync(tempPath);
              removeFileIfExistsSync(finalPath);
              safeSend(mainWindow, 'download-event', { id, status: 'error', error: 'Failed to finalize file: ' + err.message });
            }
          })();
        });
      });
    });

    const downloadTimeout = setTimeout(() => {
      req.destroy(new Error('Connection timed out'));
    }, DOWNLOAD_TIMEOUT);

    req.on('error', (err) => {
      if (downloadTimeout) clearTimeout(downloadTimeout);
      activeDownloads.delete(id);
      safeSend(mainWindow, 'download-event', { id, status: 'error', error: err.message });
    });
  };

  try {
    start(url);
  } catch (e) {
    safeSend(mainWindow, 'download-event', { id, status: 'error', error: e.message });
  }
}

function stampOf(target, isDir) {
  try {
    const st = fs.statSync(target);
    return isDir ? String(st.birthtimeMs) : `${st.size}:${st.mtimeMs}`;
  } catch {
    return null;
  }
}

function track(map, target, isDir) {
  loadManifest();
  map.delete(target);
  map.set(target, stampOf(target, isDir));
  while (map.size > MAX_TRACKED_ITEMS) {
    map.delete(map.keys().next().value);
  }
  persistTracking();
}

function trackDownloadedFile(filePath) {
  track(downloadedFiles, filePath, false);
}

function trackExtractedDir(dirPath) {
  track(extractedDirs, dirPath, true);
}

function isRemovable(target) {
  return writableRoots(userDataDir()).some((root) => isWithin(target, root) && path.relative(root, target) !== '');
}

function hasRunningExe(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { recursive: true, withFileTypes: true });
  } catch {
    return false;
  }
  return entries.some((entry) => {
    if (!entry.isFile() || !/\.exe$/i.test(entry.name)) return false;
    try {
      fs.closeSync(fs.openSync(path.join(entry.parentPath, entry.name), 'r+'));
      return false;
    } catch (err) {
      return err.code === 'EBUSY';
    }
  });
}

function* removablePaths(debug) {
  for (const [map, isDir] of [[downloadedFiles, false], [extractedDirs, true]]) {
    for (const [target, stamp] of [...map]) {
      if (!fs.existsSync(target) || !isRemovable(target) || (stamp && stampOf(target, isDir) !== stamp)) {
        map.delete(target);
        continue;
      }
      if (!isDir) {
        yield { map, target };
        continue;
      }
      if (hasRunningExe(target)) {
        debug('info', 'Still in use, will retry on next launch:', target);
        continue;
      }
      let aside = target;
      if (!target.endsWith(DELETING_SUFFIX)) {
        aside = `${target}.${process.pid}-${Date.now()}${DELETING_SUFFIX}`;
        try {
          fs.renameSync(target, aside);
        } catch {
          debug('info', 'Still in use, will retry on next launch:', target);
          continue;
        }
        map.delete(target);
        map.set(aside, stamp);
        persistTracking();
      }
      yield { map, target: aside };
    }
  }
}

function abortActiveDownloads(debug) {
  for (const [id, d] of activeDownloads) {
    d.cleaned = true;
    if (d.stallInterval) clearInterval(d.stallInterval);
    try { d.response.destroy(); } catch { }
    try { d.file.destroy(); } catch { }
    try {
      fs.rmSync(d.filePath, { force: true });
    } catch (err) {
      debug('warn', 'Failed to remove partial download:', d.filePath, err.code || err.message);
      trackDownloadedFile(d.filePath);
    }
    activeDownloads.delete(id);
  }
}

function cleanupOnQuit(debug) {
  loadManifest();
  abortActiveDownloads(debug);
  for (const { map, target } of removablePaths(debug)) {
    try {
      fs.rmSync(target, RM_OPTIONS);
      map.delete(target);
    } catch (err) {
      debug('warn', 'Failed to remove path, will retry on next launch:', target, err.code || err.message);
    }
  }
  persistTracking();
}

async function cleanupLeftoverDownloads(debug) {
  loadManifest();
  let removed = 0;
  for (const { map, target } of removablePaths(debug)) {
    try {
      await fs.promises.rm(target, RM_OPTIONS);
      map.delete(target);
      removed++;
    } catch (err) {
      debug('warn', 'Failed to remove leftover download:', target, err.code || err.message);
    }
  }
  persistTracking();
  if (removed) debug('success', `Cleaned ${removed} leftover download item(s)`);
}


module.exports = {
  startDownload,
  cleanupOnQuit,
  cleanupLeftoverDownloads,
  trackExtractedDir
};
