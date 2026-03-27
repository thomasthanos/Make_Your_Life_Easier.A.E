/**
 * Download Manager Module
 * Handles file downloads with progress tracking
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { clientFor } = require('./http-utils');
const { sanitizeFilename, extFromUrl, removeFileIfExistsSync, cleanupExtractDirs } = require('./file-utils');

const activeDownloads = new Map();
const downloadedFiles = [];
const extractedDirs = [];

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
    let downloadTimeout;
    
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
        const cdMatch = cd.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i);
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
      cleanupExtractDirs(finalName, destDirForCleanup);

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

          // Retry rename with delay to handle transient file locks
          const tryRename = (attempts) => {
            if (d.cleaned) return;
            fs.rename(tempPath, finalPath, (err) => {
              if (err && attempts > 0 && (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'ENOENT')) {
                setTimeout(() => tryRename(attempts - 1), 500);
                return;
              }
              if (err) { cleanup(err.message); return; }
              activeDownloads.delete(id);

              // ✅ Track with limit
              trackDownloadedFile(finalPath);

              safeSend(mainWindow, 'download-event', { id, status: 'complete', path: finalPath });
            });
          };
          tryRename(3);
        });
      });
    });

    req.on('error', (err) => {
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
 * Pause a download
 * @param {string} id - Download identifier
 * @param {BrowserWindow} mainWindow - Window to send events to
 */
function pauseDownload(id, mainWindow) {
  const d = activeDownloads.get(id);
  if (d && d.response) {
    d.paused = true;
    try { d.response.pause(); } catch { }
    safeSend(mainWindow, 'download-event', { id, status: 'paused' });
  }
}

/**
 * Resume a download
 * @param {string} id - Download identifier
 * @param {BrowserWindow} mainWindow - Window to send events to
 */
function resumeDownload(id, mainWindow) {
  const d = activeDownloads.get(id);
  if (d && d.response) {
    d.paused = false;
    try { d.response.resume(); } catch { }
    safeSend(mainWindow, 'download-event', { id, status: 'resumed' });
  }
}

/**
 * Cancel a download
 * @param {string} id - Download identifier
 * @param {BrowserWindow} mainWindow - Window to send events to
 */
function cancelDownload(id, mainWindow) {
  const d = activeDownloads.get(id);
  if (d) {
    // Mark as cleaned first to prevent finish handler from racing
    d.cleaned = true;
    // Clear stall detection interval
    if (d.stallInterval) clearInterval(d.stallInterval);
    try {
      if (d.response) {
        d.response.removeAllListeners();
        d.response.destroy();
      }
    } catch { }
    try {
      if (d.file) {
        d.file.removeAllListeners();
        d.file.close(() => {
          try { d.file.destroy(); } catch { }
        });
      }
    } catch { }
    try { if (d.filePath) fs.unlink(d.filePath, () => { }); } catch { }
    activeDownloads.delete(id);
    safeSend(mainWindow, 'download-event', { id, status: 'cancelled' });
  }
}

/**
 * Track a downloaded file with size limit
 * @param {string} filePath - File path to track
 */
function trackDownloadedFile(filePath) {
  if (!downloadedFiles.includes(filePath)) {
    downloadedFiles.push(filePath);

    // ✅ Remove oldest entries if over limit
    while (downloadedFiles.length > MAX_TRACKED_ITEMS) {
      downloadedFiles.shift();
    }
  }
}

/**
 * Add a directory to the extraction tracking list
 * @param {string} dirPath - Directory path
 */
function trackExtractedDir(dirPath) {
  if (!extractedDirs.includes(dirPath)) {
    extractedDirs.push(dirPath);

    // ✅ Remove oldest entries if over limit
    while (extractedDirs.length > MAX_TRACKED_ITEMS) {
      extractedDirs.shift();
    }
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

  for (const filePath of downloadedFiles) {
    tryRemovePath(filePath);
    const altFilePath = filePath.replace(/_/g, ' ');
    if (altFilePath !== filePath) {
      tryRemovePath(altFilePath);
    }
  }

  for (const dirPath of extractedDirs) {
    tryRemovePath(dirPath);
    const altDirPath = dirPath.replace(/_/g, ' ');
    if (altDirPath !== dirPath) {
      tryRemovePath(altDirPath);
    }
  }

  // ✅ Clear arrays after cleanup
  downloadedFiles.length = 0;
  extractedDirs.length = 0;
}


module.exports = {
  startDownload,
  pauseDownload,
  resumeDownload,
  cancelDownload,
  cleanupOnQuit,
  trackExtractedDir,
  trackDownloadedFile
};
