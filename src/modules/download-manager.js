/**
 * Download Manager Module
 * Handles file downloads with progress tracking
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');
const { clientFor } = require('./http-utils');
const { sanitizeFilename, extFromUrl, removeFileIfExistsSync, cleanupExtractDirs } = require('./file-utils');

const activeDownloads = new Map();
const downloadedFiles = new Set();
const extractedDirs = new Set();

let cleanupManifestPath = null;
function manifestPath() {
  if (!cleanupManifestPath) {
    try { cleanupManifestPath = path.join(app.getPath('userData'), 'pending-cleanup.json'); } catch { cleanupManifestPath = null; }
  }
  return cleanupManifestPath;
}

function persistTracking() {
  try {
    const p = manifestPath();
    if (!p) return;
    fs.writeFileSync(p, JSON.stringify({ files: [...downloadedFiles], dirs: [...extractedDirs] }));
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

/**
 * Start a download
 * @param {string} id - Unique download identifier
 * @param {string} url - URL to download
 * @param {string} dest - Destination filename or path
 * @param {BrowserWindow} mainWindow - Window to send events to
 */
function startDownload(id, url, dest, mainWindow) {
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

  const start = (downloadUrl) => {
    // Add timeout for slow connections (5 minutes)
    const DOWNLOAD_TIMEOUT = 5 * 60 * 1000;

    const req = clientFor(downloadUrl).get(downloadUrl, (res) => {
      // Clear connection timeout once response starts
      if (downloadTimeout) clearTimeout(downloadTimeout);
      // Handle HTTP redirects (3xx)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const nextUrl = new URL(res.headers.location, downloadUrl).toString();
        start(nextUrl);
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
      const d = { response: res, file, total, received: 0, paused: false, filePath: tempPath, finalPath, lastProgress: Date.now(), cleaned: false };
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
        if (d.paused) return;
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
 * Track a downloaded file with size limit
 * @param {string} filePath - File path to track
 */
function trackDownloadedFile(filePath) {
  if (!downloadedFiles.has(filePath)) {
    downloadedFiles.add(filePath);

    // ✅ Remove oldest entries if over limit
    while (downloadedFiles.size > MAX_TRACKED_ITEMS) {
      downloadedFiles.delete(downloadedFiles.values().next().value);
    }
    persistTracking();
  }
}

/**
 * Add a directory to the extraction tracking list
 * @param {string} dirPath - Directory path
 */
function trackExtractedDir(dirPath) {
  if (!extractedDirs.has(dirPath)) {
    extractedDirs.add(dirPath);

    // ✅ Remove oldest entries if over limit
    while (extractedDirs.size > MAX_TRACKED_ITEMS) {
      extractedDirs.delete(extractedDirs.values().next().value);
    }
    persistTracking();
  }
}

/**
 * Cleanup downloaded files on app quit
 * @param {Function} debug - Debug logging function
 */
function cleanupOnQuit(debug) {
  const tryRemovePath = (target) => {
    try {
      if (!target) return;
      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    } catch (err) {
      debug('warn', 'Failed to remove path:', target, err);
    }
  };

  const tempDir = os.tmpdir().toLowerCase();
  const isInTemp = (target) => typeof target === 'string' && target.toLowerCase().startsWith(tempDir);

  // Only remove downloaded files that live in the OS temp dir — never delete
  // completed downloads the user intentionally saved to their Downloads folder.
  for (const filePath of downloadedFiles) {
    if (isInTemp(filePath)) tryRemovePath(filePath);
  }

  // Extraction directories are app-created artifacts — safe to remove.
  for (const dirPath of extractedDirs) {
    tryRemovePath(dirPath);
  }

  // ✅ Clear sets after cleanup
  downloadedFiles.clear();
  extractedDirs.clear();
  try { const p = manifestPath(); if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch { }
}

function cleanupLeftoverDownloads(debug) {
  try {
    const p = manifestPath();
    if (!p || !fs.existsSync(p)) return;

    let manifest;
    try { manifest = JSON.parse(fs.readFileSync(p, 'utf-8')) || {}; } catch { manifest = {}; }

    const tempDir = os.tmpdir().toLowerCase();
    const isInTemp = (target) => typeof target === 'string' && target.toLowerCase().startsWith(tempDir);

    // Files: only remove leftovers in temp — never the user's saved downloads.
    // Dirs: extraction artifacts, always safe to remove.
    const targets = [...(manifest.files || []).filter(isInTemp), ...(manifest.dirs || [])];

    for (const target of targets) {
      try {
        if (target && fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
      } catch (err) {
        if (debug) debug('warn', 'Failed to remove leftover download:', target, err.message);
      }
    }

    fs.unlinkSync(p);
    if (debug && targets.length) debug('success', `Cleaned ${targets.length} leftover download item(s)`);
  } catch (err) {
    if (debug) debug('warn', 'Failed to clean leftover downloads:', err.message);
  }
}


module.exports = {
  startDownload,
  cleanupOnQuit,
  cleanupLeftoverDownloads,
  trackExtractedDir,
  trackDownloadedFile
};
