/**
 * Download Manager Module
 * Handles file downloads with progress tracking
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');
const { clientFor } = require('./http-utils');
const { sanitizeFilename, extFromUrl, removeFileIfExistsSync, cleanupExtractDirs, checkFileSignature, readFileHead } = require('./file-utils');
const { isWithin, writableRoots } = require('./security');

const activeDownloads = new Map();

// Everything downloaded or extracted, as path -> stamp (see stampOf). It is all
// removed when the app quits; whatever cannot be removed then (an installer
// still running from it, or a quit that never reached before-quit: crash,
// shutdown, logoff) stays in the manifest and is retried on the next launch.
const downloadedFiles = new Map();
const extractedDirs = new Map();

// Suffix of a folder moved aside to be deleted
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

/**
 * Pull in what an earlier session could not remove. Runs before the tracking
 * maps are first changed, so saving them never drops those entries.
 */
function loadManifest() {
  if (manifestLoaded) return;
  manifestLoaded = true;
  try {
    const p = manifestPath();
    if (!p || !fs.existsSync(p)) return;
    const manifest = JSON.parse(fs.readFileSync(p, 'utf-8')) || {};
    const restore = (map, items) => {
      for (const item of Array.isArray(items) ? items : []) {
        // Older versions stored bare paths, with no stamp
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

/** Safely send event to renderer — no-op if window is destroyed */
function safeSend(mainWindow, channel, data) {
  try {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send(channel, data);
    }
  } catch { /* window gone, ignore */ }
}

// Maximum items to track (prevent unbounded growth)
const MAX_TRACKED_ITEMS = 50;

// Some vendor CDNs (AMD, for one) bounce requests that don't look like they came
// from a browser. Node sends no User-Agent at all by default.
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MakeYourLifeEasier'
};

/**
 * Start a download
 * @param {string} id - Unique download identifier
 * @param {string} url - URL to download
 * @param {string} dest - Destination filename or path
 * @param {BrowserWindow} mainWindow - Window to send events to
 * @param {Object} [headers] - Extra request headers (e.g. a Referer the CDN requires)
 */
function startDownload(id, url, dest, mainWindow, headers) {
  // Validate URL protocol - only allow http/https
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
    // Add timeout for slow connections (5 minutes)
    const DOWNLOAD_TIMEOUT = 5 * 60 * 1000;

    const req = clientFor(downloadUrl).get(downloadUrl, { headers: requestHeaders }, (res) => {
      // Clear connection timeout once response starts
      if (downloadTimeout) clearTimeout(downloadTimeout);
      // Handle HTTP redirects (3xx)
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
        res.resume(); // Drain response to free resources
        activeDownloads.delete(id);
        safeSend(mainWindow, 'download-event', { id, status: 'error', error: `HTTP ${res.statusCode}` });
        return;
      }

      // Determine destination path
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

      // Cleanup existing files
      removeFileIfExistsSync(finalPath);
      // Only cleanup extracted dirs for Downloads-folder downloads.
      // For absolute-path destinations (e.g. sparkle.zip in AppData) we skip
      // cleanupExtractDirs because it would delete the install directory that
      // shares the same base name (sparkle/ alongside sparkle.zip).
      if (!isAbsolute) {
        cleanupExtractDirs(finalName, destDirForCleanup);
      }

      const total = parseInt(res.headers['content-length'] || '0', 10);
      const file = fs.createWriteStream(tempPath);
      const d = { response: res, file, total, received: 0, filePath: tempPath, finalPath, lastProgress: Date.now(), cleaned: false };
      activeDownloads.set(id, d);

      safeSend(mainWindow, 'download-event', { id, status: 'started', total });

      const cleanup = (errMsg) => {
        if (d.cleaned) return; // prevent double-cleanup / race with finish
        d.cleaned = true;
        // Clear stall detection interval
        if (d.stallInterval) clearInterval(d.stallInterval);
        // Stop piping first to prevent further writes
        try { res.unpipe(file); } catch { }
        // Remove listeners before destroying
        try { res.removeAllListeners(); } catch { }
        try { res.destroy(); } catch { }
        // Destroy file stream immediately, then close for safety
        try { file.removeAllListeners(); } catch { }
        try { file.destroy(); } catch { }
        try { file.close(() => { }); } catch { }
        // Clean up temp file
        try { fs.unlink(tempPath, () => { }); } catch { }
        activeDownloads.delete(id);
        if (errMsg) {
          safeSend(mainWindow, 'download-event', { id, status: 'error', error: errMsg });
        }
      };
      
      // Set up stall detection
      d.stallInterval = setInterval(() => {
        const now = Date.now();
        if (d.lastProgress && now - d.lastProgress > STALL_TIMEOUT_MS) {
          cleanup(`Download stalled - no data received for ${STALL_TIMEOUT_MS / 1000} seconds`);
        }
      }, STALL_CHECK_INTERVAL_MS);

      res.on('data', (chunk) => {
        d.received += chunk.length;
        d.lastProgress = Date.now(); // Update last progress timestamp
        const percent = total > 0 ? Math.round((d.received / total) * 100) : null;
        safeSend(mainWindow, 'download-event', { id, status: 'progress', percent, received: d.received, total });
      });

      res.on('error', (err) => cleanup(err.message));
      file.on('error', (err) => cleanup(err.message));
      res.pipe(file);

      file.once('finish', () => {
        if (d.cleaned) return; // cleanup() already ran (stall/cancel), don't rename
        file.close(() => {
          if (d.cleaned) return;
          // Clear stall detection since download is done
          if (d.stallInterval) clearInterval(d.stallInterval);

          // Avoid race condition with cancellation cleanup
          (async () => {
            try {
              if (d.cleaned) return;
              // Refuse an error page saved under an installer's name before
              // anything gets to run it
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
                // Canceled during rename
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

/**
 * What a tracked path looked like when this app wrote it. A leftover whose stamp
 * no longer matches was replaced by something else and is left alone. Folders
 * use their creation time, since their contents are expected to change.
 * @param {string} target - Tracked path
 * @param {boolean} isDir - Whether it is an extracted folder
 * @returns {string|null} The stamp, or null when the path cannot be read
 */
function stampOf(target, isDir) {
  try {
    const st = fs.statSync(target);
    return isDir ? String(st.birthtimeMs) : `${st.size}:${st.mtimeMs}`;
  } catch {
    return null;
  }
}

/**
 * Add a path to a tracking map, keeping at most MAX_TRACKED_ITEMS
 * @param {Map} map - downloadedFiles or extractedDirs
 * @param {string} target - Path to track
 * @param {boolean} isDir - Whether it is an extracted folder
 */
function track(map, target, isDir) {
  loadManifest();
  // Re-adding moves it to the newest position with a fresh stamp
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

/**
 * Only ever delete inside the app's own write areas, and never one of those
 * folders itself. The manifest is a plain file in userData, so its paths are
 * not taken on trust.
 * @param {string} target - Path about to be deleted
 * @returns {boolean} True when it may be deleted
 */
function isRemovable(target) {
  return writableRoots(userDataDir()).some((root) => isWithin(target, root) && path.relative(root, target) !== '');
}

/**
 * Whether a program is running from inside a folder. Moving the folder aside
 * fails while a file in it is open or a process works in it, but not while an
 * .exe in it runs, and deleting around a running installer removes the files
 * it is still installing from.
 * @param {string} dir - Folder to check
 * @returns {boolean} True when an .exe inside it is running
 */
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
      // Windows refuses write access to a running program's file (EBUSY);
      // a read-only file fails with EPERM instead and is not in use
      fs.closeSync(fs.openSync(path.join(entry.parentPath, entry.name), 'r+'));
      return false;
    } catch (err) {
      return err.code === 'EBUSY';
    }
  });
}

/**
 * Walk the tracked paths and yield each one that can be deleted now. Paths that
 * are gone, outside the app's areas or no longer ours are dropped; paths still
 * in use stay tracked for the next attempt. A folder is moved aside first: that
 * fails while something in it is open, and a delete that then fails partway
 * never leaves a half-emptied folder under the name the user knows.
 * @param {Function} debug - Debug logging function
 * @returns {Generator<{map: Map, target: string}>}
 */
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
        // Saved before deleting, so a quit mid-delete still finds it next launch
        map.delete(target);
        map.set(aside, stamp);
        persistTracking();
      }
      yield { map, target: aside };
    }
  }
}

/**
 * Stop downloads still running at quit; their .part files would otherwise stay
 * behind in Downloads
 * @param {Function} debug - Debug logging function
 */
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

/**
 * Remove downloaded files and extracted folders on app quit. Anything still in
 * use stays in the manifest for cleanupLeftoverDownloads on the next launch.
 * @param {Function} debug - Debug logging function
 */
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

/**
 * Remove what earlier sessions could not: items in use at quit, or everything
 * from a session that ended without before-quit. Async so a large folder does
 * not hold up startup.
 * @param {Function} debug - Debug logging function
 * @returns {Promise<void>}
 */
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
