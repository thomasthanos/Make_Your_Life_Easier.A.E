
const fs = require('fs');
const path = require('path');

function removeFileIfExistsSync(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
  }
}

function removeDirIfExistsSync(dirPath) {
  try {
    if (dirPath && fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch {
  }
}

function cleanupExtractDirs(finalName, downloadsDir) {
  const baseNameWithoutExt = path.basename(finalName, path.extname(finalName));
  const extractDir = path.join(downloadsDir, baseNameWithoutExt);
  removeDirIfExistsSync(extractDir);
  const altExtractDir = extractDir.replace(/_/g, ' ');
  if (altExtractDir !== extractDir) {
    removeDirIfExistsSync(altExtractDir);
  }
}

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

function extFromUrl(url) {
  const match = String(url).match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? `.${match[1]}` : '';
}

const FILE_SIGNATURES = {
  '.exe': Buffer.from('MZ'),
  '.msi': Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])
};
const ARCHIVE_EXTS = new Set(['.zip', '.7z', '.rar']);

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

async function readFileHead(filePath, length = 16) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const { bytesRead, buffer } = await handle.read(Buffer.alloc(length), 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

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
