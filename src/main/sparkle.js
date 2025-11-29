/**
 * Sparkle Module
 * Handles Sparkle utility management
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const { debug } = require('./debug');
const { fetchLatestSparkle } = require('./http-utils');
const { compareVersions } = require('./version-utils');

/**
 * Ensure Sparkle utility is available
 * @returns {Promise<Object>}
 */
async function ensureSparkle() {
  try {
    // Only relevant on Windows
    if (process.platform !== 'win32') {
      return { needsDownload: false };
    }
    
    // Determine the target directory
    const userRoaming = path.join(os.homedir(), 'AppData', 'Roaming');
    const sparkleDir = path.join(userRoaming, 'make-your-life-easier');
    
    try {
      fs.mkdirSync(sparkleDir, { recursive: true });
    } catch {
      // Ignore mkdir errors
    }
    
    // Find existing Sparkle zip files
    let existingVersion = null;
    let existingFile = null;
    
    try {
      const files = fs.readdirSync(sparkleDir);
      for (const f of files) {
        if (/^sparkle-.*-win\.zip$/i.test(f)) {
          existingFile = f;
          const match = f.match(/^sparkle-([0-9]+(?:\.[0-9]+)*)-win\.zip$/i);
          if (match) {
            existingVersion = match[1];
          }
          break;
        }
      }
    } catch {
      // Ignore read errors
    }
    
    // Check if extracted directory exists
    try {
      const debloatDir = path.join(sparkleDir, 'debloat-sparkle');
      if (!existingFile && fs.existsSync(debloatDir)) {
        const id = `sparkle-${Date.now()}`;
        const placeholderDest = path.join(sparkleDir, 'sparkle-latest.zip');
        return { needsDownload: false, id, url: '', dest: placeholderDest };
      }
    } catch {
      // Ignore errors
    }

    // Fetch latest release details from GitHub
    let latest;
    try {
      latest = await fetchLatestSparkle();
    } catch (err) {
      debug('warn', 'Failed to fetch latest Sparkle release:', err);
      latest = null;
    }
    
    // Determine whether a download is needed
    let needsDownload = true;
    let destPath;
    let downloadUrl;
    let fileName;
    
    if (latest && latest.version && latest.assetUrl && latest.fileName) {
      const cmp = existingVersion ? compareVersions(latest.version, existingVersion) : 1;
      
      if (cmp <= 0) {
        needsDownload = false;
        fileName = existingFile;
        downloadUrl = latest.assetUrl;
      } else {
        needsDownload = true;
        fileName = latest.fileName;
        downloadUrl = latest.assetUrl;
        
        // Remove any existing older zip
        if (existingFile) {
          try {
            fs.unlinkSync(path.join(sparkleDir, existingFile));
          } catch {
            // Ignore deletion errors
          }
        }
      }
    } else {
      if (existingFile) {
        needsDownload = false;
        fileName = existingFile;
      } else {
        needsDownload = true;
        fileName = 'sparkle-2.9.2-win.zip';
        downloadUrl = 'https://github.com/parcoil/sparkle/releases/download/2.9.2/sparkle-2.9.2-win.zip';
      }
    }

    // Check again for debloat-sparkle directory
    try {
      const debloatDir = path.join(sparkleDir, 'debloat-sparkle');
      if (!existingFile && fs.existsSync(debloatDir)) {
        needsDownload = false;
      }
    } catch {
      // Ignore errors
    }
    
    destPath = path.join(sparkleDir, fileName);
    const id = `sparkle-${Date.now()}`;
    
    return { needsDownload, id, url: downloadUrl, dest: destPath };
  } catch (err) {
    debug('error', 'ensure-sparkle unexpected error:', err);
    const fallbackPath = path.join(os.homedir(), 'AppData', 'Roaming', 'make-your-life-easier', 'sparkle-2.9.2-win.zip');
    return {
      needsDownload: true,
      id: `sparkle-${Date.now()}`,
      url: 'https://github.com/parcoil/sparkle/releases/download/2.9.2/sparkle-2.9.2-win.zip',
      dest: fallbackPath
    };
  }
}

module.exports = {
  ensureSparkle
};
