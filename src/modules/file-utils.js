/**
 * File System Utilities Module
 * Provides helpers for file and directory operations using fs.promises
 */

const fs = require('fs');
const fsPromises = fs.promises;
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
  removeDirIfExistsSync,
  cleanupExtractDirs,
  sanitizeFilename,
  extFromUrl,
  expandEnvVars,
  // Export fs for backward compatibility
  fs,
  fsPromises
};
