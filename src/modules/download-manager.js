/**
 * Download Manager Module
 * Handles file downloads with progress tracking
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { clientFor, http, https } = require('./http-utils');
const { sanitizeFilename, extFromUrl, removeFileIfExistsSync, cleanupExtractDirs } = require('./file-utils');

const activeDownloads = new Map();
const downloadedFiles = [];
const extractedDirs = [];

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
  const downloadsDir = path.join(os.homedir(), 'Downloads');

  const start = (downloadUrl) => {
    const req = clientFor(downloadUrl).get(downloadUrl, (res) => {
      // Handle HTTP redirects (3xx)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const nextUrl = new URL(res.headers.location, downloadUrl).toString();
        start(nextUrl);
        return;
      }

      if (res.statusCode !== 200) {
        mainWindow.webContents.send('download-event', { id, status: 'error', error: `HTTP ${res.statusCode}` });
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
      const d = { response: res, file, total, received: 0, paused: false, filePath: tempPath, finalPath };
      activeDownloads.set(id, d);

      mainWindow.webContents.send('download-event', { id, status: 'started', total });

      const cleanup = (errMsg) => {
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
          mainWindow.webContents.send('download-event', { id, status: 'error', error: errMsg });
        }
      };

      res.on('data', (chunk) => {
        if (d.paused) return;
        d.received += chunk.length;
        if (total) {
          const percent = Math.round((d.received / total) * 100);
          mainWindow.webContents.send('download-event', { id, status: 'progress', percent });
        }
      });

      res.on('error', (err) => cleanup(err.message));
      file.on('error', (err) => cleanup(err.message));
      res.pipe(file);

      file.once('finish', () => {
        file.close(() => {
          fs.rename(tempPath, finalPath, (err) => {
            if (err) { cleanup(err.message); return; }
            activeDownloads.delete(id);

            // ✅ Track with limit
            trackDownloadedFile(finalPath);

            mainWindow.webContents.send('download-event', { id, status: 'complete', path: finalPath });
          });
        });
      });
    });

    req.on('error', (err) => {
      activeDownloads.delete(id);
      mainWindow.webContents.send('download-event', { id, status: 'error', error: err.message });
    });
  };

  try {
    start(url);
  } catch (e) {
    mainWindow.webContents.send('download-event', { id, status: 'error', error: e.message });
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
    mainWindow.webContents.send('download-event', { id, status: 'paused' });
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
    mainWindow.webContents.send('download-event', { id, status: 'resumed' });
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
    mainWindow.webContents.send('download-event', { id, status: 'cancelled' });
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

/**
 * Remove entries for files that no longer exist
 * Call this periodically or before adding new entries
 */
function pruneNonExistentPaths() {
  // Clean downloadedFiles
  for (let i = downloadedFiles.length - 1; i >= 0; i--) {
    if (!fs.existsSync(downloadedFiles[i])) {
      downloadedFiles.splice(i, 1);
    }
  }

  // Clean extractedDirs
  for (let i = extractedDirs.length - 1; i >= 0; i--) {
    if (!fs.existsSync(extractedDirs[i])) {
      extractedDirs.splice(i, 1);
    }
  }
}

/**
 * Get list of downloaded files
 */
function getDownloadedFiles() {
  return downloadedFiles;
}

/**
 * Get list of extracted directories
 */
function getExtractedDirs() {
  return extractedDirs;
}

module.exports = {
  startDownload,
  pauseDownload,
  resumeDownload,
  cancelDownload,
  cleanupOnQuit,
  trackExtractedDir,
  trackDownloadedFile,      // ✅ Export new function
  pruneNonExistentPaths,    // ✅ Export new function
  getDownloadedFiles,
  getExtractedDirs
};
