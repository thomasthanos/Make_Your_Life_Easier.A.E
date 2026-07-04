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

// Mutex: prevents cleanupLeftoverSparkle() and ensureSparkle() from running forceRemoveSparkleDir() concurrently
let _removeInProgress = null; // Promise | null

/**
 * Run a synchronous fs operation with Electron's asar handling disabled.
 *
 * CRITICAL: Sparkle is itself an Electron app, so its `resources/app.asar` is a
 * real asar archive. When our code touches that path via `fs` inside Electron,
 * Electron's asar layer opens the archive and caches its file descriptor for the
 * lifetime of OUR process — which permanently locks app.asar and makes every
 * deletion attempt fail with EBUSY. Toggling `process.noAsar` makes `fs` treat
 * it as an ordinary file, so it is opened and closed cleanly with no cached lock.
 * The calls wrapped here are synchronous, so the global flag can't leak across
 * awaits into unrelated fs operations.
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
function withNoAsar(fn) {
  const prev = process.noAsar;
  process.noAsar = true;
  try {
    return fn();
  } finally {
    process.noAsar = prev;
  }
}

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

// Prefix used for the temporary "trash" directory the sparkle folder is renamed
// to when its files are locked by a foreign process (e.g. VS Code / Defender).
const SPARKLE_TRASH_PREFIX = '.sparkle-trash-';

/**
 * Rename the sparkle directory to a sibling "trash" folder. This frees the
 * canonical `sparkle` path instantly even when app.asar is locked by another
 * process, because a directory rename does not open the locked file itself
 * (foreign handles are typically opened with FILE_SHARE_DELETE).
 * @param {string} sparkleDir
 * @returns {string|null} the trash path if the move succeeded, otherwise null
 */
function moveSparkleDirToTrash(sparkleDir) {
  try {
    const parent = path.dirname(sparkleDir);
    const trashPath = path.join(parent, `${SPARKLE_TRASH_PREFIX}${Date.now()}-${process.pid}`);
    withNoAsar(() => fs.renameSync(sparkleDir, trashPath));
    return trashPath;
  } catch {
    return null;
  }
}

/**
 * Best-effort synchronous removal of any leftover trash directories from
 * previous sessions (only deletes ones whose lock has since been released).
 * Anything still locked is left for the next sweep / scheduled cleanup.
 */
function sweepSparkleTrash() {
  try {
    const parent = path.dirname(getSparkleDir());
    if (!fs.existsSync(parent)) return;
    for (const entry of fs.readdirSync(parent)) {
      if (!entry.startsWith(SPARKLE_TRASH_PREFIX)) continue;
      const trashPath = path.join(parent, entry);
      try {
        withNoAsar(() => fs.rmSync(trashPath, { recursive: true, force: true }));
      } catch {
        // Still locked — schedule a detached PowerShell to retry after exit
        scheduleDelayedCleanup(trashPath);
      }
    }
  } catch { /* nothing to sweep */ }
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
    if (!withNoAsar(() => fs.existsSync(asarPath))) return resolve(); // nothing to wait for

    const MAX_PROBES = 30; // 30 × 500ms = 15s max
    let probes = 0;

    const probe = () => {
      probes++;
      try {
        // Try to open the file exclusively — fails with EBUSY/EPERM if still memory-mapped.
        // noAsar so Electron does not cache (and thus lock) the archive fd.
        withNoAsar(() => {
          const fd = fs.openSync(asarPath, 'r+');
          fs.closeSync(fd);
        });
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
  if (!fs.existsSync(sparkleDir)) return 'missing';

  // Kill Sparkle process first
  await killSparkleProcess();

  // Wait until the OS releases the memory-map lock on app.asar
  await waitForAsarUnlocked(sparkleDir);

  // Retry deletion up to 5 times with exponential back-off
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      withNoAsar(() => fs.rmSync(sparkleDir, { recursive: true, force: true }));
      debug('info', `Sparkle directory removed (attempt ${attempt})`);
      return 'removed';
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
          return 'removed';
        }
        // Foreign process still holds a lock (e.g. VS Code on app.asar). We can't
        // force-delete a file held open by another process, but we CAN rename the
        // directory aside so the canonical `sparkle` path is freed immediately.
        const trashPath = moveSparkleDirToTrash(sparkleDir);
        if (trashPath) {
          debug('info', 'Sparkle directory moved to trash; scheduling trash deletion');
          scheduleDelayedCleanup(trashPath);
          return 'removed';
        }
        // Even the rename failed — schedule a detached PowerShell for after exit
        debug('warn', 'Directory still locked, scheduling post-exit cleanup');
        scheduleDelayedCleanup(sparkleDir);
        return 'scheduled';
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
  // Dev mode: helper binaries live in src/resources/bin
  candidates.push(path.join(__dirname, '..', 'resources', 'bin', '7za.exe'));

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
  const REQUEST_TIMEOUT_MS = 15000;
  const options = { headers: { 'User-Agent': 'MakeYourLifeEasier' } };

  const requestJson = (url, redirectsLeft) => new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, val) => { if (!settled) { settled = true; fn(val); } };

    const req = https.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) { done(reject, new Error('Too many redirects from GitHub')); return; }
        done(resolve, requestJson(res.headers.location, redirectsLeft - 1));
        return;
      }

      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          done(reject, new Error(`GitHub API returned HTTP ${res.statusCode}`));
          return;
        }
        let release;
        try {
          release = JSON.parse(body);
        } catch (e) {
          done(reject, new Error('Failed to parse GitHub release response: ' + e.message));
          return;
        }
        const asset = findWinAsset(release);
        if (asset) done(resolve, asset);
        else done(reject, new Error('No Windows zip asset found in the latest release'));
      });
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      done(reject, new Error('GitHub request timed out after 15 seconds'));
    });

    req.on('error', (err) => {
      done(reject, new Error('Network error contacting GitHub: ' + err.message));
    });
  });

  return requestJson(GITHUB_API_LATEST, 3);
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
 * Waits for both sparkle.exe AND our own MakeYourLifeEasier process (which can
 * itself hold app.asar open) to exit before retrying Remove-Item.
 * @param {string} targetDir
 */
function scheduleDelayedCleanup(targetDir) {
  try {
    const dirPS = targetDir.replace(/'/g, "''");
    const ownPid = process.pid;
    const psLines = [
      // 1. Wait for our own MakeYourLifeEasier process (the real asar holder) to exit
      "$target = '" + dirPS + "'",
      "$ownPid = " + ownPid,
      "$max = 60; $n = 0",
      "while ($n -lt $max) {",
      "    $sparkle = Get-Process -Name 'sparkle' -ErrorAction SilentlyContinue",
      "    $self = Get-Process -Id $ownPid -ErrorAction SilentlyContinue",
      "    if (-not $sparkle -and -not $self) { break }",
      "    Start-Sleep -Seconds 1; $n += 1",
      "}",
      // 2. Give Windows extra time to release memory-mapped handles (app.asar)
      "Start-Sleep -Seconds 2",
      // 3. Retry loop: try up to 15 times with 2s gap
      "$retries = 15",
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
    try { debug('info', 'Scheduled delayed sparkle cleanup via PowerShell'); } catch { /* pipe closed */ }
  } catch (spawnErr) {
    try { debug('warn', 'Failed to schedule delayed sparkle cleanup:', spawnErr.message); } catch { /* pipe closed */ }
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
  // Safe log helper — during quit, stdout/stderr pipes may already be closed (EPIPE).
  // Swallow write errors so the app exits cleanly.
  const safeDebug = (level, ...args) => {
    try { debug(level, ...args); } catch { /* pipe closed */ }
  };

  const sparkleDir = getSparkleDir();
  const zipPath = getSparkleZipPath();

  // Always delete the zip first — it is never locked
  try {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  } catch (err) {
    safeDebug('warn', 'Failed to cleanup sparkle zip:', err.message);
  }

  if (!withNoAsar(() => fs.existsSync(sparkleDir))) return;

  // Kill sparkle.exe synchronously before attempting deletion.
  // before-quit is synchronous so we can't await — execFileSync is the only option.
  if (process.platform === 'win32') {
    try {
      const { execFileSync } = require('child_process');
      // /T kills the entire process tree (child Electron processes too)
      execFileSync('taskkill', ['/F', '/T', '/IM', 'sparkle.exe'], {
        windowsHide: true,
        stdio: 'ignore',
        timeout: 5000
      });
      safeDebug('info', 'sparkle.exe killed on quit');
    } catch {
      // Process may not be running — that is fine
    }
  }

  // Short synchronous probe: give the OS a brief window to release the memory-map
  // lock that sparkle.exe's own process held on app.asar. This only helps when WE
  // held the lock; a foreign lock (VS Code/Defender) is handled by the rename step
  // below, so we cap this low to avoid stalling shutdown.
  const asarPath = path.join(sparkleDir, 'resources', 'app.asar');
  if (withNoAsar(() => fs.existsSync(asarPath))) {
    const MAX_PROBES = 6; // 6 × 250ms = 1.5s max
    for (let i = 0; i < MAX_PROBES; i++) {
      try {
        withNoAsar(() => {
          const fd = fs.openSync(asarPath, 'r+');
          fs.closeSync(fd);
        });
        break; // our lock released — proceed to delete
      } catch {
        const until = Date.now() + 250;
        while (Date.now() < until) { /* spin */ }
      }
    }
  }

  // Try immediate removal
  try {
    withNoAsar(() => fs.rmSync(sparkleDir, { recursive: true, force: true }));
    safeDebug('info', 'Sparkle directory cleaned up on quit successfully');
    sweepSparkleTrash();
    return;
  } catch (err) {
    safeDebug('warn', 'Immediate cleanup failed on quit:', err.message);
  }

  // A foreign process still holds a lock. Rename the folder aside so the canonical
  // `sparkle` path is gone immediately, then let a detached PowerShell delete the
  // renamed folder once the lock is finally released.
  if (process.platform === 'win32') {
    const trashPath = moveSparkleDirToTrash(sparkleDir);
    try {
      scheduleDelayedCleanup(trashPath || sparkleDir);
      safeDebug('info', trashPath
        ? 'Sparkle folder renamed to trash on quit; deletion scheduled'
        : 'Sparkle folder locked and could not be renamed; deletion scheduled');
    } catch {
      // Pipe may be closed — ignore
    }
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
  // Delete any trash folders left behind by a previous quit whose lock has released.
  sweepSparkleTrash();
  try {
    const cleanupState = await forceRemoveSparkleDir();
    if (cleanupState === 'scheduled') {
      debug('info', 'Leftover sparkle directory is locked; cleanup was scheduled after exit');
    } else if (cleanupState === 'removed') {
      debug('info', 'Cleaned up leftover sparkle directory from previous session');
    }
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
