/**
 * Sparkle Module
 * Handles Sparkle utility download from Dropbox
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');
const { debug } = require('./debug');

// Direct Dropbox download link for Sparkle.exe
const SPARKLE_DOWNLOAD_URL = 'https://www.dropbox.com/scl/fi/fopw6fk8ke087ux9uwi3n/sparkle.zip?rlkey=1cfugm9yv83ll0mvg3z4qcc7r&dl=1';

/**
 * Get Sparkle directory path
 * @returns {string}
 */
function getSparkleDir() {
  const userRoaming = path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(userRoaming, 'make-your-life-easier', 'sparkle');
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
  const baseDir = path.join(userRoaming, 'make-your-life-easier');
  return path.join(baseDir, 'sparkle.zip');
}

/**
 * Get 7-Zip executable path
 * @returns {string}
 */
function get7ZipPath() {
  // First try the bundled 7za.exe
  const appPath = process.resourcesPath || path.join(__dirname, '..', '..');
  const bundled7zip = path.join(appPath, 'resources', 'bin', '7za.exe');
  
  if (fs.existsSync(bundled7zip)) {
    return bundled7zip;
  }
  
  // Fallback to system 7-Zip if available
  const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  
  const possiblePaths = [
    path.join(programFiles, '7-Zip', '7z.exe'),
    path.join(programFilesX86, '7-Zip', '7z.exe')
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  
  return null;
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
        debug('success', `✅ Sparkle.exe already exists: ${sparkleExePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        return true;
      } else {
        debug('warn', `⚠️ Sparkle.exe exists but is too small: ${stats.size} bytes`);
        try { fs.unlinkSync(sparkleExePath); } catch { }
        return false;
      }
    }
  } catch (err) {
    debug('warn', '⚠️ Error checking Sparkle:', err.message);
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
      debug('info', `📁 Created Sparkle directory: ${sparkleDir}`);
    }
    
    return true;
  } catch (err) {
    debug('error', `❌ Failed to create directories: ${err.message}`);
    return false;
  }
}

/**
 * Extract Sparkle from zip using 7-Zip
 * @param {string} zipPath - Path to zip file
 * @returns {Promise<Object>}
 */
async function extractSparkleFromZip(zipPath) {
  return new Promise((resolve) => {
    debug('info', `📦 Extracting Sparkle from: ${zipPath}`);
    
    const sparkleDir = getSparkleDir();
    const sparkleExePath = getSparkleExePath();
    
    // Create directory if needed
    createDirectories();
    
    // Get 7-Zip path
    const sevenZipPath = get7ZipPath();
    
    if (!sevenZipPath) {
      debug('error', '❌ 7-Zip not found');
      resolve({ success: false, error: '7-Zip executable not found' });
      return;
    }
    
    debug('info', `📦 Using 7-Zip: ${sevenZipPath}`);
    
    // Use 7-Zip to extract
    const args = [
      'x',                          // Extract with full paths
      `-o${sparkleDir}`,            // Output directory
      zipPath,                      // Input file
      '-y'                          // Assume yes
    ];
    
    debug('info', `📦 Running: ${sevenZipPath} ${args.join(' ')}`);
    
    const process = spawn(sevenZipPath, args, {
      windowsHide: true
    });
    
    let stderr = '';
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        debug('success', '📦 7-Zip extraction completed successfully');
        
        // Verify extraction
        if (fs.existsSync(sparkleExePath)) {
          const stats = fs.statSync(sparkleExePath);
          debug('success', `✅ Sparkle extracted successfully: ${sparkleExePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
          resolve({ success: true, extracted: true, exePath: sparkleExePath });
        } else {
          debug('error', '❌ Sparkle.exe not found after extraction');
          resolve({ success: false, error: 'Extraction failed - sparkle.exe not found' });
        }
      } else {
        debug('error', `❌ 7-Zip extraction failed with code ${code}`);
        if (stderr) debug('error', `stderr: ${stderr}`);
        resolve({ success: false, error: `7-Zip extraction failed (exit code ${code})` });
      }
    });
    
    process.on('error', (err) => {
      debug('error', `❌ Failed to spawn 7-Zip process: ${err.message}`);
      resolve({ success: false, error: `Failed to run 7-Zip: ${err.message}` });
    });
  });
}

/**
 * Ensure Sparkle utility is available
 * @returns {Promise<Object>}
 */
async function ensureSparkle() {
  try {
    // Only relevant on Windows
    if (process.platform !== 'win32') {
      debug('info', 'Sparkle is only for Windows');
      return { success: false, error: 'Sparkle is only available on Windows' };
    }
    
    debug('info', '🔍 Checking for Sparkle...');
    
    // Check if Sparkle is already available
    if (isSparkleAvailable()) {
      debug('success', '✅ Sparkle is already available');
      return { 
        success: true, 
        alreadyAvailable: true,
        sparkleExePath: getSparkleExePath(),
        message: 'Sparkle is ready to use'
      };
    }
    
    // Check if zip already exists
    const zipPath = getSparkleZipPath();
    
    if (fs.existsSync(zipPath)) {
      try {
        const stats = fs.statSync(zipPath);
        const minSize = 10 * 1024 * 1024; // Sparkle zip is ~12MB
        if (stats.size > minSize) {
          debug('info', `📦 Existing zip found: ${zipPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
          
          // Try to extract it
          const extractResult = await extractSparkleFromZip(zipPath);
          if (extractResult.success) {
            debug('success', '✅ Successfully extracted Sparkle from existing zip');
            return {
              success: true,
              alreadyAvailable: true,
              extracted: true,
              sparkleExePath: getSparkleExePath(),
              message: 'Sparkle extracted from existing zip'
            };
          } else {
            debug('warn', `⚠️ Failed to extract from existing zip: ${extractResult.error}`);
            // Delete corrupted zip
            try { fs.unlinkSync(zipPath); } catch { }
          }
        } else {
          debug('warn', `⚠️ Existing zip too small: ${stats.size} bytes (expected >10MB)`);
          try { fs.unlinkSync(zipPath); } catch { }
        }
      } catch (err) {
        debug('warn', `⚠️ Error checking existing zip: ${err.message}`);
      }
    }
    
    // Need to download
    debug('info', '📥 Sparkle not found, will download from Dropbox');
    
    // Create directories for download
    createDirectories();
    
    const id = `sparkle-${Date.now()}`;
    
    return { 
      success: true,
      needsDownload: true,
      id, 
      url: SPARKLE_DOWNLOAD_URL, 
      dest: zipPath,
      sparkleExePath: getSparkleExePath(),
      message: 'Sparkle needs to be downloaded'
    };
    
  } catch (err) {
    debug('error', `❌ Unexpected error in ensureSparkle: ${err.message}`);
    debug('error', err.stack);
    return {
      success: false,
      error: err.message || 'Unknown error'
    };
  }
}

/**
 * Process downloaded Sparkle zip - extract and verify
 * @param {string} zipPath - Path to downloaded zip
 * @returns {Promise<Object>}
 */
async function processDownloadedSparkle(zipPath) {
  debug('info', `📦 Processing downloaded Sparkle: ${zipPath}`);
  
  // Verify file exists
  if (!fs.existsSync(zipPath)) {
    return {
      success: false,
      error: 'Downloaded zip file not found'
    };
  }
  
  // Extract the zip
  const extractResult = await extractSparkleFromZip(zipPath);
  
  if (extractResult.success) {
    // Delete the zip file after successful extraction
    try {
      debug('info', `🗑️ Deleting zip file: ${zipPath}`);
      fs.unlinkSync(zipPath);
      debug('success', '✅ Zip file deleted successfully');
    } catch (deleteErr) {
      debug('warn', `⚠️ Could not delete zip file: ${deleteErr.message}`);
    }
    
    return {
      success: true,
      extracted: true,
      sparkleExePath: getSparkleExePath(),
      message: 'Sparkle downloaded and extracted successfully'
    };
  } else {
    return {
      success: false,
      error: extractResult.error || 'Failed to extract Sparkle',
      zipPath: zipPath
    };
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
  SPARKLE_DOWNLOAD_URL
};
