/**
 * Sparkle Module
 * Handles Sparkle utility download from GitHub releases
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');
const { spawn, execFile } = require('child_process');
const { debug } = require('./debug');

const GITHUB_API_LATEST = 'https://api.github.com/repos/thedogecraft/sparkle/releases/latest';

// Mutex: prevents cleanupLeftoverSparkle() and ensureSparkle() from running forceRemoveSparkleDir() concurrently
let _removeInProgress = null; // Promise | null

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
 * Kill any running sparkle.exe process (entire tree) and poll until the OS
 * confirms it is fully gone (all file handles released) before resolving.
 * @returns {Promise<void>}
 */
function killSparkleProcess() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve();

    // Step 1a: taskkill /F /T — kill the process tree (handles child Electron processes)
    const killer = spawn('taskkill', ['/F', '/T', '/IM', 'sparkle.exe'], { windowsHide: true });
    killer.on('error', () => resolve());
    killer.on('close', () => {
      // Step 1b: PowerShell Stop-Process as a second pass (catches stragglers)
      const ps = spawn('powershell.exe', [
        '-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass',
        '-Command',
        'Get-Process -Name sparkle -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue'
      ], { windowsHide: true });
      ps.on('error', () => {});
      ps.on('close', () => {
        // Step 2: poll tasklist until sparkle.exe no longer appears
        const MAX_POLLS = 20;  // 20 × 300ms = 6s max
        let polls = 0;

        const poll = () => {
          const checker = spawn(
            'tasklist',
            ['/FI', 'IMAGENAME eq sparkle.exe', '/NH', '/FO', 'CSV'],
            { windowsHide: true }
          );
          let out = '';
          checker.stdout && checker.stdout.on('data', d => { out += d.toString(); });
          checker.on('close', () => {
            polls++;
            const stillRunning = out.toLowerCase().includes('sparkle.exe');
            if (!stillRunning || polls >= MAX_POLLS) {
              // Process gone — give the OS one more second to release file handles
              setTimeout(resolve, 1000);
            } else {
              setTimeout(poll, 300);
            }
          });
          checker.on('error', () => setTimeout(resolve, 1000));
        };

        setTimeout(poll, 300);
      });
    });
  });
}

/**
 * Probe the app.asar file specifically until the OS releases its memory-map lock.
 * Electron memory-maps app.asar and the lock can outlive the process by several seconds.
 * @param {string} sparkleDir
 * @returns {Promise<void>}
 */
function waitForAsarUnlocked(sparkleDir) {
  return new Promise((resolve) => {
    const asarPath = path.join(sparkleDir, 'resources', 'app.asar');
    if (!fs.existsSync(asarPath)) return resolve(); // nothing to wait for

    const MAX_PROBES = 30; // 30 × 500ms = 15s max
    let probes = 0;

    const probe = () => {
      probes++;
      try {
        // Try to open the file exclusively — fails with EBUSY/EPERM if still memory-mapped
        const fd = fs.openSync(asarPath, 'r+');
        fs.closeSync(fd);
        debug('info', `app.asar lock released after ${probes} probe(s)`);
        resolve();
      } catch {
        if (probes >= MAX_PROBES) {
          debug('warn', 'app.asar still locked after max probes, proceeding anyway');
          resolve();
        } else {
          setTimeout(probe, 500);
        }
      }
    };

    probe();
  });
}

/**
 * Forcefully remove the sparkle directory, killing the process first if needed.
 * Uses a module-level mutex so concurrent callers (cleanupLeftoverSparkle + ensureSparkle)
 * share a single operation instead of racing.
 * @returns {Promise<void>}
 */
async function forceRemoveSparkleDir() {
  // Mutex: if a removal is already in progress, wait for it and return
  if (_removeInProgress) {
    debug('info', 'forceRemoveSparkleDir already in progress, waiting...');
    return _removeInProgress;
  }

  _removeInProgress = _doForceRemoveSparkleDir().finally(() => {
    _removeInProgress = null;
  });
  return _removeInProgress;
}

async function _doForceRemoveSparkleDir() {
  const sparkleDir = getSparkleDir();
  if (!fs.existsSync(sparkleDir)) return;

  // Kill Sparkle process first
  await killSparkleProcess();

  // Wait until the OS releases the memory-map lock on app.asar
  await waitForAsarUnlocked(sparkleDir);

  // Retry deletion up to 5 times with exponential back-off
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      fs.rmSync(sparkleDir, { recursive: true, force: true });
      debug('info', `Sparkle directory removed (attempt ${attempt})`);
      return;
    } catch (err) {
      if ((err.code === 'EBUSY' || err.code === 'EPERM') && attempt < 5) {
        const delay = Math.min(500 * Math.pow(2, attempt - 1), 3000);
        debug('warn', `Retry ${attempt}/5 after ${delay}ms: ${err.message}`);
        await new Promise(r => setTimeout(r, delay));
      } else if (attempt === 5) {
        // Last resort: PowerShell Remove-Item (bypasses some EPERM/EBUSY that Node can't)
        debug('warn', 'Node rmSync failed after retries, trying PowerShell Remove-Item...');
        await new Promise((res) => {
          const dirPS = sparkleDir.replace(/'/g, "''");
          const ps = spawn('powershell.exe', [
            '-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass',
            '-Command',
            // Take ownership first, then force-delete
            `takeown /f '${dirPS}' /r /d y 2>$null; ` +
            `icacls '${dirPS}' /grant administrators:F /t /q 2>$null; ` +
            `Remove-Item -LiteralPath '${dirPS}' -Recurse -Force -ErrorAction SilentlyContinue`
          ], { windowsHide: true });
          ps.on('error', () => res());
          ps.on('close', () => res());
        });
        if (!fs.existsSync(sparkleDir)) {
          debug('info', 'Sparkle directory removed via PowerShell');
          return;
        }
        // Still locked — schedule a detached PowerShell to clean up after Electron exits
        debug('warn', 'Directory still locked, scheduling post-exit cleanup');
        scheduleDelayedCleanup(sparkleDir);
      } else {
        throw err;
      }
    }
  }
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

    // If a valid sparkle.exe already exists, use it — no need to re-download.
    // This avoids trying to delete a freshly-used (and still-locked) Electron app.asar.
    if (isSparkleAvailable()) {
      debug('info', 'Sparkle already available, skipping download');
      return {
        success: true,
        needsDownload: false,
        sparkleExePath: getSparkleExePath(),
        message: 'Sparkle already available'
      };
    }

    // Directory exists but exe is missing/invalid — clean up and re-download
    await forceRemoveSparkleDir();

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
 * Schedule a delayed folder deletion via a detached PowerShell process.
 * Runs AFTER Electron exits so all file handles are released.
 * Retries Remove-Item up to 10 times with a 2s pause between attempts.
 * @param {string} targetDir
 */
function scheduleDelayedCleanup(targetDir) {
  try {
    const dirPS = targetDir.replace(/'/g, "''");
    const psLines = [
      // 1. Wait for sparkle.exe to finish (up to 60s)
      "$target = '" + dirPS + "'",
      "$max = 60; $n = 0",
      "while ($n -lt $max) {",
      "    if (-not (Get-Process -Name 'sparkle' -ErrorAction SilentlyContinue)) { break }",
      "    Start-Sleep -Seconds 2; $n += 2",
      "}",
      // 2. Give Windows extra time to release memory-mapped handles (app.asar)
      "Start-Sleep -Seconds 3",
      // 3. Retry loop: try up to 10 times with 2s gap
      "$retries = 10",
      "for ($i = 0; $i -lt $retries; $i++) {",
      "    if (-not (Test-Path -LiteralPath $target)) { break }",
      "    try {",
      "        Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop",
      "        break",
      "    } catch {",
      "        Start-Sleep -Seconds 2",
      "    }",
      "}"
    ].join('\n');

    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-WindowStyle', 'Hidden',
      '-ExecutionPolicy', 'Bypass',
      '-Command', psLines
    ], { detached: true, stdio: 'ignore' });
    ps.unref();
    debug('info', 'Scheduled delayed sparkle cleanup via PowerShell');
  } catch (spawnErr) {
    debug('warn', 'Failed to schedule delayed sparkle cleanup:', spawnErr.message);
  }
}

/**
 * Clean up sparkle directory (called synchronously on app quit via before-quit).
 * 1. Tries to kill sparkle.exe synchronously (best-effort).
 * 2. Tries immediate rmSync.
 * 3. If the directory is still locked, schedules a detached PowerShell
 *    process that retries deletion after Electron fully exits.
 */
function cleanupSparkle() {
  const sparkleDir = getSparkleDir();
  const zipPath = getSparkleZipPath();

  // Always delete the zip first — it is never locked
  try {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  } catch (err) {
    debug('warn', 'Failed to cleanup sparkle zip:', err.message);
  }

  if (!fs.existsSync(sparkleDir)) return;

  // Kill sparkle.exe synchronously before attempting deletion.
  // before-quit is synchronous so we can't await — execFileSync is the only option.
  if (process.platform === 'win32') {
    try {
      const { execFileSync } = require('child_process');
      // /T kills the entire process tree (child Electron processes too)
      execFileSync('taskkill', ['/F', '/T', '/IM', 'sparkle.exe'], {
        windowsHide: true,
        timeout: 5000
      });
      debug('info', 'sparkle.exe killed on quit');
    } catch {
      // Process may not be running — that is fine
    }
  }

  // Synchronous probe: wait until the OS releases the memory-map lock on app.asar.
  // (app is already quitting — blocking the event loop here is acceptable)
  const asarPath = path.join(sparkleDir, 'resources', 'app.asar');
  if (fs.existsSync(asarPath)) {
    const MAX_PROBES = 20; // 20 × 500ms = 10s max
    for (let i = 0; i < MAX_PROBES; i++) {
      try {
        const fd = fs.openSync(asarPath, 'r+');
        fs.closeSync(fd);
        debug('info', `app.asar unlocked after ${i + 1} probe(s) on quit`);
        break; // lock released — proceed to delete
      } catch {
        // Still locked — busy-wait 500ms
        const until = Date.now() + 500;
        while (Date.now() < until) { /* spin */ }
      }
    }
  }

  // Try immediate removal
  try {
    fs.rmSync(sparkleDir, { recursive: true, force: true });
    debug('info', 'Sparkle directory cleaned up on quit successfully');
    return;
  } catch (err) {
    debug('warn', 'Immediate cleanup failed on quit, scheduling post-exit PowerShell cleanup:', err.message);
  }

  // Fallback: detached PowerShell that deletes the folder after Electron exits
  if (process.platform === 'win32') {
    scheduleDelayedCleanup(sparkleDir);
  }
}

/**
 * Clean up any leftover sparkle folder from a previous session where
 * cleanup failed (e.g. app was quit while Sparkle was running).
 * Call this on app startup, BEFORE any new download.
 */
async function cleanupLeftoverSparkle() {
  const zipPath = getSparkleZipPath();
  try {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  } catch { }
  try {
    await forceRemoveSparkleDir();
    debug('info', 'Cleaned up leftover sparkle directory from previous session');
  } catch (err) {
    debug('warn', 'Could not clean leftover sparkle dir on startup:', err.message);
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
  cleanupSparkle,
  cleanupLeftoverSparkle
};
