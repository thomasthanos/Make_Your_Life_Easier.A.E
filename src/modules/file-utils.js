/**
 * File System Utilities Module
 * Provides helpers for file and directory operations using fs.promises
 */

const fs = require('fs');
const path = require('path');

/**
 * Safely remove a file if it exists (sync version for backward compatibility)
 * @param {string} filePath - The absolute path of the file to delete
 */
function removeFileIfExistsSync(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Safely remove a directory if it exists (sync version)
 * @param {string} dirPath - The absolute path of the directory to remove
 */
function removeDirIfExistsSync(dirPath) {
  try {
    if (dirPath && fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Remove any existing extraction directories associated with a given download
 * @param {string} finalName - The sanitized filename used for the download
 * @param {string} downloadsDir - The parent downloads directory
 */
function cleanupExtractDirs(finalName, downloadsDir) {
  const baseNameWithoutExt = path.basename(finalName, path.extname(finalName));
  const extractDir = path.join(downloadsDir, baseNameWithoutExt);
  removeDirIfExistsSync(extractDir);
  const altExtractDir = extractDir.replace(/_/g, ' ');
  if (altExtractDir !== extractDir) {
    removeDirIfExistsSync(altExtractDir);
  }
}

/**
 * Sanitize a filename while preserving its extension
 * @param {string} name - The input filename
 * @returns {string} - The sanitized filename
 */
function sanitizeFilename(name) {
  try {
    const ext = path.extname(name);
    const base = path.basename(name, ext);
    let cleanedBase = base.replace(/[^a-zA-Z0-9_-]/g, '_');
    cleanedBase = cleanedBase.replace(/_+/g, '_').replace(/^_+/, '');
    let cleanedExt = ext.replace(/[^a-zA-Z0-9.]/g, '');
    if (cleanedExt === '.') cleanedExt = '';
    const finalBase = cleanedBase || 'unnamed';
    return finalBase + cleanedExt;
  } catch {
    let cleaned = String(name).replace(/[^a-zA-Z0-9_-]/g, '_');
    cleaned = cleaned.replace(/_+/g, '_').replace(/^_+/, '');
    return cleaned || 'unnamed';
  }
}

/**
 * Extract extension from a URL
 * @param {string} url - The URL to extract extension from
 * @returns {string} - The extension including dot, or empty string
 */
function extFromUrl(url) {
  const match = String(url).match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? `.${match[1]}` : '';
}

// Leading bytes a download must have to be usable as its extension says.
// Archives are handed to 7za, which detects the format from the content, so
// they are only checked for not being a web page.
const FILE_SIGNATURES = {
  '.exe': Buffer.from('MZ'),
  '.msi': Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])
};
const ARCHIVE_EXTS = new Set(['.zip', '.7z', '.rar']);

/**
 * Check a downloaded file's first bytes against its extension.
 * A deleted or expired share link can answer 200 with an HTML error page,
 * which would otherwise be saved as e.g. Setup.exe and handed to Windows,
 * failing with an unhelpful "file is corrupted and unreadable".
 * @param {string} ext - The extension including dot
 * @param {Buffer} head - The first bytes of the file (16 is plenty)
 * @returns {string|null} - Why the file is unusable, or null when it looks right
 */
function checkFileSignature(ext, head) {
  const kind = String(ext).toLowerCase();
  const expected = FILE_SIGNATURES[kind];
  if (!expected && !ARCHIVE_EXTS.has(kind)) return null;

  if (/^(?:\xEF\xBB\xBF)?\s*</.test(head.toString('latin1'))) {
    return 'The server sent a web page instead of the file. The download link may be dead or expired.';
  }
  if (expected && !head.subarray(0, expected.length).equals(expected)) {
    return `The downloaded file is not a valid ${kind} file.`;
  }
  return null;
}

/**
 * Read the first bytes of a file
 * @param {string} filePath - The file to read
 * @param {number} length - How many bytes to read at most
 * @returns {Promise<Buffer>} - The bytes read (shorter if the file is)
 */
async function readFileHead(filePath, length = 16) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const { bytesRead, buffer } = await handle.read(Buffer.alloc(length), 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/**
 * Expand environment variables in a path (Windows style %VAR%)
 * @param {string} input - The path with potential env variables
 * @returns {string} - The expanded path
 */
function expandEnvVars(input) {
  return String(input).replace(/%([^%]+)%/g, (match, name) => {
    const value = process.env[name];
    return typeof value === 'string' ? value : match;
  });
}

module.exports = {
  removeFileIfExistsSync,
  cleanupExtractDirs,
  sanitizeFilename,
  extFromUrl,
  checkFileSignature,
  readFileHead,
  expandEnvVars
};
