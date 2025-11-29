/**
 * Archive Utils Module
 * Handles archive extraction using 7za
 */

const { spawn } = require('child_process');
const { shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { debug } = require('./debug');

/**
 * Find 7za executable
 * @returns {Promise<string|null>}
 */
async function ensure7za() {
  const candidates = [];

  debug('info', '🔍 Searching for 7za...');
  
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'bin', '7za.exe'));
    candidates.push(path.join(process.resourcesPath, 'bin', '7z.exe'));
    candidates.push(path.join(__dirname, '..', 'bin', '7za.exe'));
    candidates.push(path.join(__dirname, '..', 'bin', '7z.exe'));
    
    const parentDir = path.dirname(process.resourcesPath);
    candidates.push(path.join(parentDir, 'bin', '7za.exe'));
    candidates.push(path.join(parentDir, 'bin', '7z.exe'));
  }
  
  if (process.platform === 'win32') {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    candidates.push(path.join(pf, '7-Zip', '7z.exe'));
    candidates.push(path.join(pf, '7-Zip', '7za.exe'));
    candidates.push(path.join(pf86, '7-Zip', '7z.exe'));
    candidates.push(path.join(pf86, '7-Zip', '7za.exe'));
  }
  
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        debug('success', '✅ FOUND 7za at:', candidate);
        return candidate;
      }
    } catch (err) {
      debug('error', 'Error checking:', candidate, err.message);
    }
  }
  
  debug('warn', '7za.exe not found in any location');
  return null;
}

/**
 * Extract an archive
 * @param {string} filePath - Path to the archive
 * @param {string} password - Optional password
 * @param {string} destDir - Optional destination directory
 * @param {Function} trackExtractedDir - Function to track extracted directories
 * @returns {Promise<Object>}
 */
async function extractArchive(filePath, password, destDir, trackExtractedDir) {
  return new Promise(async (resolve) => {
    const archive = String(filePath);
    const pwd = String(password || '');
    let outDir;
    
    if (destDir) {
      outDir = String(destDir);
    } else {
      const parent = path.dirname(archive);
      const base = path.basename(archive, path.extname(archive));
      outDir = path.join(parent, base);
    }
    
    try {
      if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, { recursive: true, force: true });
      }
      const altDir = outDir.replace(/_/g, ' ');
      if (altDir !== outDir && fs.existsSync(altDir)) {
        fs.rmSync(altDir, { recursive: true, force: true });
      }
      fs.mkdirSync(outDir, { recursive: true });
      
      if (trackExtractedDir) {
        trackExtractedDir(outDir);
      }
    } catch (e) {
      // Ignore directory creation errors
    }
    
    const exe = await ensure7za();
    if (!exe) {
      shell.openPath(archive);
      resolve({ success: true, output: 'File opened directly (7-Zip not available)' });
      return;
    }
    
    debug('info', 'Using 7za.exe from:', exe);
    
    const args = ['x', archive];
    if (pwd) args.push(`-p${pwd}`);
    args.push(`-o${outDir}`);
    args.push('-y');
    
    const child = spawn(exe, args, { windowsHide: true });
    let stderr = '';
    
    child.stderr.on('data', (buf) => { stderr += buf.toString(); });
    
    child.on('error', (err) => {
      debug('error', '7za spawn error:', err);
      resolve({ success: false, error: `7za spawn error: ${err.message}` });
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: stderr.trim() });
      } else {
        const errMsg = stderr.trim() || `7za exited with code ${code}`;
        resolve({ success: false, error: errMsg });
      }
    });
  });
}

module.exports = {
  ensure7za,
  extractArchive
};
