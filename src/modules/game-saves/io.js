/**
 * Small file helpers shared by the game-saves modules.
 */

const fs = require('fs');
const path = require('path');

/**
 * Read and parse a JSON file.
 * @param {string} filePath - File to read
 * @param {*} [fallback=null] - Returned when the file is missing or unreadable
 * @returns {*} Parsed value, or the fallback
 */
function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

/**
 * Write JSON through a sibling temp file and a rename, the same way
 * settings-store.js persists settings: a crash mid-write leaves the previous
 * file in place instead of half a document.
 * @param {string} filePath - Destination file
 * @param {*} data - Value to serialise
 * @param {{pretty?: boolean}} [options] - pretty=false for large machine-read files
 */
function writeJsonAtomic(filePath, data, { pretty = true } = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tempPath, pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data));
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    try { fs.unlinkSync(tempPath); } catch { /* nothing to clean up */ }
    throw err;
  }
}

module.exports = {
  readJson,
  writeJsonAtomic
};
