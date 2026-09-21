
const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const { debug } = require('./debug');

const GITHUB_API_LATEST = 'https://api.github.com/repos/thedogecraft/sparkle/releases/latest';

let _removeInProgress = null;

function withNoAsar(fn) {
  const prev = process.noAsar;
  process.noAsar = true;
  try {
    return fn();
  } finally {
    process.noAsar = prev;
  }
}

function getSparkleDir() {
  const userRoaming = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(userRoaming, 'ThomasThanos', 'MakeYourLifeEasier', 'sparkle');
}

function getSparkleExePath() {
  return path.join(getSparkleDir(), 'sparkle.exe');
}

function getSparkleZipPath() {
  const userRoaming = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const baseDir = path.join(userRoaming, 'ThomasThanos', 'MakeYourLifeEasier');
  return path.join(baseDir, 'sparkle.zip');
}

const SPARKLE_TRASH_PREFIX = '.sparkle-trash-';

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
        scheduleDelayedCleanup(trashPath);
      }
    }
  } catch {  }
}

function isSparkleAvailable() {
  const sparkleExePath = getSparkleExePath();
  try {
    if (fs.existsSync(sparkleExePath)) {
      const stats = fs.statSync(sparkleExePath);
      const minSize = 5 * 1024 * 1024;
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

function killSparkleProcess() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve();

    const killer = spawn('taskkill', ['/F', '/T', '/IM', 'sparkle.exe'], { windowsHide: true });
    killer.on('error', () => resolve());
    killer.on('close', () => {
      const ps = spawn('powershell.exe', [
        '-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass',
        '-Command',
        'Get-Process -Name sparkle -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue'
      ], { windowsHide: true });
      ps.on('error', () => {});
      ps.on('close', () => {
        const MAX_POLLS = 20;
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

function waitForAsarUnlocked(sparkleDir) {
  return new Promise((resolve) => {
    const asarPath = path.join(sparkleDir, 'resources', 'app.asar');
    if (!withNoAsar(() => fs.existsSync(asarPath))) return resolve();

    const MAX_PROBES = 30;
    let probes = 0;

    const probe = () => {
      probes++;
      try {
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

async function forceRemoveSparkleDir() {
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

  await killSparkleProcess();

  await waitForAsarUnlocked(sparkleDir);

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
        debug('warn', 'Node rmSync failed after retries, trying PowerShell Remove-Item...');
        await new Promise((res) => {
          const dirPS = sparkleDir.replace(/'/g, "''");
          const ps = spawn('powershell.exe', [
            '-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass',
            '-Command',
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
        const trashPath = moveSparkleDirToTrash(sparkleDir);
        if (trashPath) {
          debug('info', 'Sparkle directory moved to trash; scheduling trash deletion');
          scheduleDelayedCleanup(trashPath);
          return 'removed';
        }
        debug('warn', 'Directory still locked, scheduling post-exit cleanup');
        scheduleDelayedCleanup(sparkleDir);
        return 'scheduled';
      } else {
        throw err;
      }
    }
  }
}

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

function get7ZipPath() {
  const candidates = [];

  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'bin', '7za.exe'));
  }
  candidates.push(path.join(__dirname, '..', 'resources', 'bin', '7za.exe'));

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

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

function findWinAsset(release) {
  if (!release || !release.assets) return null;
  const asset = release.assets.find(a =>
    a.name && a.name.toLowerCase().includes('win') && a.name.endsWith('.zip')
  );
  return asset ? asset.browser_download_url : null;
}

async function ensureSparkle() {
  try {
    if (process.platform !== 'win32') {
      return { success: false, error: 'Sparkle is only available on Windows' };
    }

    if (isSparkleAvailable()) {
      debug('info', 'Sparkle already available, skipping download');
      return {
        success: true,
        needsDownload: false,
        sparkleExePath: getSparkleExePath(),
        message: 'Sparkle already available'
      };
    }

    await forceRemoveSparkleDir();

    createDirectories();

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

async function processDownloadedSparkle(zipPath) {
  if (!fs.existsSync(zipPath)) {
    return { success: false, error: 'Downloaded zip file not found' };
  }

  const extractResult = await extractSparkleFromZip(zipPath);

  if (extractResult.success) {
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

function scheduleDelayedCleanup(targetDir) {
  try {
    const dirPS = targetDir.replace(/'/g, "''");
    const ownPid = process.pid;
    const psLines = [
      "$target = '" + dirPS + "'",
      "$ownPid = " + ownPid,
      "$max = 60; $n = 0",
      "while ($n -lt $max) {",
      "    $sparkle = Get-Process -Name 'sparkle' -ErrorAction SilentlyContinue",
      "    $self = Get-Process -Id $ownPid -ErrorAction SilentlyContinue",
      "    if (-not $sparkle -and -not $self) { break }",
      "    Start-Sleep -Seconds 1; $n += 1",
      "}",
      "Start-Sleep -Seconds 2",
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
    try { debug('info', 'Scheduled delayed sparkle cleanup via PowerShell'); } catch {  }
  } catch (spawnErr) {
    try { debug('warn', 'Failed to schedule delayed sparkle cleanup:', spawnErr.message); } catch {  }
  }
}

function cleanupSparkle() {
  const safeDebug = (level, ...args) => {
    try { debug(level, ...args); } catch {  }
  };

  const sparkleDir = getSparkleDir();
  const zipPath = getSparkleZipPath();

  try {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  } catch (err) {
    safeDebug('warn', 'Failed to cleanup sparkle zip:', err.message);
  }

  if (!withNoAsar(() => fs.existsSync(sparkleDir))) return;

  if (process.platform === 'win32') {
    try {
      const { execFileSync } = require('child_process');
      execFileSync('taskkill', ['/F', '/T', '/IM', 'sparkle.exe'], {
        windowsHide: true,
        stdio: 'ignore',
        timeout: 5000
      });
      safeDebug('info', 'sparkle.exe killed on quit');
    } catch {
    }
  }

  const asarPath = path.join(sparkleDir, 'resources', 'app.asar');
  if (withNoAsar(() => fs.existsSync(asarPath))) {
    const MAX_PROBES = 6;
    for (let i = 0; i < MAX_PROBES; i++) {
      try {
        withNoAsar(() => {
          const fd = fs.openSync(asarPath, 'r+');
          fs.closeSync(fd);
        });
        break;
      } catch {
        const until = Date.now() + 250;
        while (Date.now() < until) { continue; }
      }
    }
  }

  try {
    withNoAsar(() => fs.rmSync(sparkleDir, { recursive: true, force: true }));
    safeDebug('info', 'Sparkle directory cleaned up on quit successfully');
    sweepSparkleTrash();
    return;
  } catch (err) {
    safeDebug('warn', 'Immediate cleanup failed on quit:', err.message);
  }

  if (process.platform === 'win32') {
    const trashPath = moveSparkleDirToTrash(sparkleDir);
    try {
      scheduleDelayedCleanup(trashPath || sparkleDir);
      safeDebug('info', trashPath
        ? 'Sparkle folder renamed to trash on quit; deletion scheduled'
        : 'Sparkle folder locked and could not be renamed; deletion scheduled');
    } catch {
    }
  }
}

async function cleanupLeftoverSparkle() {
  const zipPath = getSparkleZipPath();
  try {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  } catch { }
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
  getSparkleExePath,
  isSparkleAvailable,
  processDownloadedSparkle,
  cleanupSparkle,
  cleanupLeftoverSparkle
};
