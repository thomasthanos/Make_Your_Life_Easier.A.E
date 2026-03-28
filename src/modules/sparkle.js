/**
 * Sparkle Module
 * Handles Sparkle utility download from GitHub releases
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const { debug } = require('./debug');

const GITHUB_API_LATEST = 'https://api.github.com/repos/thedogecraft/sparkle/releases/latest';

/**
 * Get Sparkle directory path
 * @returns {string}
 */
function getSparkleDir() {
  const userRoaming = path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(userRoaming, 'ThomasThanos', 'MakeYourLifeEasier', 'sparkle');
}

/**
 * Get Sparkle executable path
 * @returns {string}
 */
function getSparkleExePath() {
  return path.join(getSparkleDir(), 'sparkle.exe');
}

/**
 * Get Sparkle zip path
 * @returns {string}
 */
function getSparkleZipPath() {
  const userRoaming = path.join(os.homedir(), 'AppData', 'Roaming');
  const baseDir = path.join(userRoaming, 'ThomasThanos', 'MakeYourLifeEasier');
  return path.join(baseDir, 'sparkle.zip');
}

/**
 * Check if Sparkle is already available
 * @returns {boolean}
 */
function isSparkleAvailable() {
  const sparkleExePath = getSparkleExePath();
  try {
    if (fs.existsSync(sparkleExePath)) {
      const stats = fs.statSync(sparkleExePath);
      const minSize = 5 * 1024 * 1024; // At least 5MB
      if (stats.size > minSize) {
        return true;
      } else {
        try { fs.unlinkSync(sparkleExePath); } catch { }
        return false;
      }
    }
  } catch (err) {
    debug('warn', 'Error checking Sparkle:', err.message);
  }
  return false;
}

/**
 * Create necessary directories
 * @returns {boolean}
 */
function createDirectories() {
  try {
    const sparkleDir = getSparkleDir();
    if (!fs.existsSync(sparkleDir)) {
      fs.mkdirSync(sparkleDir, { recursive: true });
    }
    return true;
  } catch (err) {
    debug('error', 'Failed to create directories:', err.message);
    return false;
  }
}

/**
 * Get bundled 7za.exe path
 * @returns {string|null}
 */
function get7ZipPath() {
  const candidates = [];

  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'bin', '7za.exe'));
  }
  // Dev mode: bin/ is at project root, __dirname is src/modules
  candidates.push(path.join(__dirname, '..', '..', 'bin', '7za.exe'));

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Extract Sparkle from zip using bundled 7za.exe
 * @param {string} zipPath - Path to zip file
 * @returns {Promise<Object>}
 */
async function extractSparkleFromZip(zipPath) {
  const sparkleDir = getSparkleDir();
  const sparkleExePath = getSparkleExePath();

  createDirectories();

  const sevenZip = get7ZipPath();
  if (!sevenZip) {
    debug('error', '7za.exe not found');
    return { success: false, error: '7-Zip executable not found' };
  }

  return new Promise((resolve) => {
    const args = ['x', `-o${sparkleDir}`, zipPath, '-y'];
    const proc = spawn(sevenZip, args, { windowsHide: true });

    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        debug('error', `7-Zip extraction failed (exit ${code}): ${stderr}`);
        resolve({ success: false, error: `Extraction failed (exit code ${code})` });
        return;
      }

      if (fs.existsSync(sparkleExePath)) {
        resolve({ success: true, extracted: true, exePath: sparkleExePath });
        return;
      }

      // sparkle.exe might be inside a subfolder — search one level deep
      try {
        const entries = fs.readdirSync(sparkleDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const nested = path.join(sparkleDir, entry.name, 'sparkle.exe');
            if (fs.existsSync(nested)) {
              const subDir = path.join(sparkleDir, entry.name);
              for (const file of fs.readdirSync(subDir)) {
                fs.renameSync(path.join(subDir, file), path.join(sparkleDir, file));
              }
              fs.rmdirSync(subDir);
              resolve({ success: true, extracted: true, exePath: sparkleExePath });
              return;
            }
          }
        }
      } catch { }

      debug('error', 'sparkle.exe not found after extraction');
      resolve({ success: false, error: 'Extraction completed but sparkle.exe not found' });
    });

    proc.on('error', (err) => {
      debug('error', 'Failed to spawn 7-Zip:', err.message);
      resolve({ success: false, error: 'Failed to run 7-Zip: ' + err.message });
    });
  });
}

/**
 * Fetch the latest GitHub release download URL for the win zip asset
 * @returns {Promise<string>}
 */
function fetchLatestReleaseUrl() {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { 'User-Agent': 'MakeYourLifeEasier' }
    };

    https.get(GITHUB_API_LATEST, options, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, options, (res2) => {
          let body = '';
          res2.on('data', (chunk) => { body += chunk; });
          res2.on('end', () => {
            try {
              const release = JSON.parse(body);
              const asset = findWinAsset(release);
              if (asset) resolve(asset);
              else reject(new Error('No Windows zip asset found in latest release'));
            } catch (e) {
              reject(new Error('Failed to parse GitHub release: ' + e.message));
            }
          });
        }).on('error', reject);
        return;
      }

      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API returned ${res.statusCode}`));
          return;
        }
        try {
          const release = JSON.parse(body);
          const asset = findWinAsset(release);
          if (asset) resolve(asset);
          else reject(new Error('No Windows zip asset found in latest release'));
        } catch (e) {
          reject(new Error('Failed to parse GitHub release: ' + e.message));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Find the Windows zip asset from a GitHub release object
 * @param {Object} release
 * @returns {string|null}
 */
function findWinAsset(release) {
  if (!release || !release.assets) return null;
  const asset = release.assets.find(a =>
    a.name && a.name.toLowerCase().includes('win') && a.name.endsWith('.zip')
  );
  return asset ? asset.browser_download_url : null;
}

/**
 * Ensure Sparkle utility is available
 * @returns {Promise<Object>}
 */
async function ensureSparkle() {
  try {
    if (process.platform !== 'win32') {
      return { success: false, error: 'Sparkle is only available on Windows' };
    }

    // Always re-download to get latest release
    // Delete existing sparkle directory to ensure clean state
    const sparkleDir = getSparkleDir();
    try {
      if (fs.existsSync(sparkleDir)) {
        fs.rmSync(sparkleDir, { recursive: true, force: true });
      }
    } catch { }

    createDirectories();

    // Fetch the latest release URL from GitHub
    let downloadUrl;
    try {
      downloadUrl = await fetchLatestReleaseUrl();
    } catch (err) {
      debug('error', 'Failed to fetch latest Sparkle release:', err.message);
      return { success: false, error: 'Failed to fetch latest Sparkle release: ' + err.message };
    }

    const zipPath = getSparkleZipPath();
    const id = `sparkle-${Date.now()}`;

    return {
      success: true,
      needsDownload: true,
      id,
      url: downloadUrl,
      dest: zipPath,
      sparkleExePath: getSparkleExePath(),
      message: 'Sparkle needs to be downloaded'
    };

  } catch (err) {
    debug('error', 'Unexpected error in ensureSparkle:', err.message);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

/**
 * Process downloaded Sparkle zip - extract and verify
 * @param {string} zipPath - Path to downloaded zip
 * @returns {Promise<Object>}
 */
async function processDownloadedSparkle(zipPath) {
  if (!fs.existsSync(zipPath)) {
    return { success: false, error: 'Downloaded zip file not found' };
  }

  const extractResult = await extractSparkleFromZip(zipPath);

  if (extractResult.success) {
    // Delete the zip file after successful extraction
    try { fs.unlinkSync(zipPath); } catch { }

    return {
      success: true,
      extracted: true,
      sparkleExePath: getSparkleExePath(),
      message: 'Sparkle downloaded and extracted successfully'
    };
  }

  return {
    success: false,
    error: extractResult.error || 'Failed to extract Sparkle',
    zipPath
  };
}

/**
 * Clean up sparkle directory (called on app quit)
 */
function cleanupSparkle() {
  try {
    const sparkleDir = getSparkleDir();
    if (fs.existsSync(sparkleDir)) {
      fs.rmSync(sparkleDir, { recursive: true, force: true });
    }
    const zipPath = getSparkleZipPath();
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
  } catch (err) {
    debug('warn', 'Failed to cleanup sparkle:', err.message);
  }
}

module.exports = {
  ensureSparkle,
  getSparkleDir,
  getSparkleZipPath,
  getSparkleExePath,
  isSparkleAvailable,
  extractSparkleFromZip,
  processDownloadedSparkle,
  cleanupSparkle
};
