/**
 * System Tools Module
 * Windows system maintenance tools (SFC, DISM, Temp cleanup, etc.)
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { getPowerShellExe } = require('./process-utils');
const { debug } = require('./debug');

function runPowerShellJson(script) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ success: false, error: 'This feature is only available on Windows' });
      return;
    }

    const psExe = getPowerShellExe() || 'powershell.exe';
    const child = spawn(psExe, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.on('error', (error) => resolve({ success: false, error: error.message }));
    child.on('close', () => {
      const output = stdout.trim();
      if (!output) {
        resolve({ success: false, error: stderr.trim() || 'No scan output returned.' });
        return;
      }

      try {
        resolve({ success: true, data: JSON.parse(output) });
      } catch (error) {
        resolve({ success: false, error: `Could not parse scan output: ${error.message}` });
      }
    });
  });
}

function psSingleQuote(value) {
  return String(value).replace(/'/g, "''");
}

function runElevatedPowerShellJson(script) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ success: false, error: 'This feature is only available on Windows' });
      return;
    }

    const timestamp = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const psFile = path.join(os.tmpdir(), `${timestamp}_cleaner_scan.ps1`);
    const resultFile = `${psFile}.json`;
    const startedFile = `${psFile}.started`;

    const cleanup = () => {
      try { if (fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch { }
      try { if (fs.existsSync(startedFile)) fs.unlinkSync(startedFile); } catch { }
    };

    try {
      const wrappedScript = `
"STARTED" | Out-File -LiteralPath '${psSingleQuote(startedFile)}' -Encoding UTF8
try {
    $scanJson = & {
${script}
    }
    $scanJson | Out-File -LiteralPath '${psSingleQuote(resultFile)}' -Encoding UTF8
    exit 0
} catch {
    @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress | Out-File -LiteralPath '${psSingleQuote(resultFile)}' -Encoding UTF8
    exit 1
}
`;

      fs.writeFileSync(psFile, wrappedScript, 'utf8');
      const psFileArg = psFile.replace(/'/g, "''");
      const command = `Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','${psFileArg}') -Verb RunAs -WindowStyle Hidden -Wait`;
      const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], { windowsHide: true });

      child.on('error', (error) => {
        cleanup();
        try { if (fs.existsSync(resultFile)) fs.unlinkSync(resultFile); } catch { }
        resolve({ success: false, error: error.message, code: 'SPAWN_ERROR' });
      });

      child.on('close', () => {
        // With `Start-Process -Wait`, this child stays alive for the whole time the
        // UAC dialog is on screen AND while the elevated script runs, so we only get
        // here after the user answered. resultFile is normally already present; the
        // timeouts below are just short safety nets (denial grace / flush wait).
        const maxWait = 30000;
        const uacTimeout = 5000;
        const pollInterval = 150;
        let waited = 0;
        let scriptStarted = false;

        const poll = () => {
          try {
            if (!scriptStarted && fs.existsSync(startedFile)) {
              scriptStarted = true;
            }

            if (fs.existsSync(resultFile)) {
              const raw = fs.readFileSync(resultFile, 'utf8').trim();
              cleanup();
              try { fs.unlinkSync(resultFile); } catch { }

              try {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.success === false) {
                  resolve({ success: false, error: parsed.error || 'Elevated scan failed.', elevated: true });
                } else {
                  resolve({ success: true, data: parsed, elevated: true });
                }
              } catch (error) {
                resolve({ success: false, error: `Could not parse elevated scan output: ${error.message}`, elevated: true });
              }
              return;
            }

            waited += pollInterval;
            if (!scriptStarted && waited >= uacTimeout) {
              cleanup();
              resolve({
                success: false,
                error: 'Administrator scan was cancelled.',
                code: 'UAC_DENIED',
                elevated: true
              });
              return;
            }

            if (waited >= maxWait) {
              cleanup();
              resolve({ success: false, error: 'Elevated scan timed out.', code: 'TIMEOUT', elevated: true });
              return;
            }

            setTimeout(poll, pollInterval);
          } catch (error) {
            cleanup();
            resolve({ success: false, error: error.message, elevated: true });
          }
        };

        setTimeout(poll, 100);
      });
    } catch (error) {
      cleanup();
      try { if (fs.existsSync(resultFile)) fs.unlinkSync(resultFile); } catch { }
      resolve({ success: false, error: error.message, elevated: true });
    }
  });
}

const CLEANER_TASK_IDS = ['temp', 'prefetch', 'recycle_bin', 'windows_update', 'thumbnail_cache', 'error_reports'];

// SID of the desktop (non-elevated) user. Passed into elevated cleaner scripts
// so the Recycle Bin stays scoped to this user even when UAC elevates through
// a different administrator account.
let _userSidPromise = null;
function getCurrentUserSid() {
  if (!_userSidPromise) {
    _userSidPromise = new Promise((resolve) => {
      try {
        const child = spawn('powershell.exe', [
          '-NoProfile', '-Command',
          '([System.Security.Principal.WindowsIdentity]::GetCurrent()).User.Value'
        ], { windowsHide: true });
        let out = '';
        if (child.stdout) child.stdout.on('data', (d) => { out += d.toString(); });
        child.on('error', () => resolve(null));
        child.on('close', () => {
          const sid = out.trim();
          resolve(/^S-[\d-]+$/.test(sid) ? sid : null);
        });
      } catch {
        resolve(null);
      }
    });
  }
  return _userSidPromise;
}

// PowerShell that measures each cleaner target and emits the sizes as JSON.
// Shared by scanCleanerTasks() and by runCleanerTasks() (which appends it after
// the delete step so a single elevated run cleans AND returns fresh sizes).
const CLEANER_SCAN_PS = `
$ErrorActionPreference = 'SilentlyContinue'

function Get-ItemSizeInfo {
    param(
        [string[]]$Paths,
        [string[]]$Filters = @('*'),
        [switch]$Recurse
    )

    [Int64]$total = 0
    $exists = $false
    $inaccessible = $false

    foreach ($target in $Paths) {
        if ([string]::IsNullOrWhiteSpace($target) -or -not (Test-Path -LiteralPath $target)) {
            continue
        }

        $exists = $true
        $stack = New-Object 'System.Collections.Generic.Stack[string]'
        $stack.Push($target)

        while ($stack.Count -gt 0) {
            $dir = $stack.Pop()
            foreach ($filter in $Filters) {
                try {
                    foreach ($file in [System.IO.Directory]::EnumerateFiles($dir, $filter)) {
                        try { $total += (New-Object System.IO.FileInfo($file)).Length } catch { }
                    }
                } catch {
                    $inaccessible = $true
                }
            }
            if ($Recurse) {
                try {
                    foreach ($sub in [System.IO.Directory]::EnumerateDirectories($dir)) {
                        try {
                            $attr = [System.IO.File]::GetAttributes($sub)
                            if (($attr -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) { $stack.Push($sub) }
                        } catch { }
                    }
                } catch {
                    $inaccessible = $true
                }
            }
        }
    }

    return [PSCustomObject]@{
        sizeBytes = $total
        exists = $exists
        inaccessible = $inaccessible
    }
}

$recentPath = Join-Path $env:APPDATA 'Microsoft\\Windows\\Recent'
$tempPaths = @($env:TEMP, $env:TMP, (Join-Path $env:SystemRoot 'Temp'), $recentPath) | Select-Object -Unique
$prefetchPath = Join-Path $env:SystemRoot 'Prefetch'
if (-not $myleUserSid) { $myleUserSid = ([System.Security.Principal.WindowsIdentity]::GetCurrent()).User.Value }
$recyclePaths = @(Get-PSDrive -PSProvider FileSystem | ForEach-Object { Join-Path $_.Root ('$Recycle.Bin\\' + $myleUserSid) })
$windowsUpdatePath = Join-Path $env:SystemRoot 'SoftwareDistribution\\Download'
$explorerCachePath = Join-Path $env:LOCALAPPDATA 'Microsoft\\Windows\\Explorer'
$crashDumpPath = Join-Path $env:LOCALAPPDATA 'CrashDumps'
$userWerPath = Join-Path $env:LOCALAPPDATA 'Microsoft\\Windows\\WER'
$systemWerPath = Join-Path $env:ProgramData 'Microsoft\\Windows\\WER'

$tempScan = Get-ItemSizeInfo -Paths $tempPaths -Recurse
$prefetchScan = Get-ItemSizeInfo -Paths @($prefetchPath) -Recurse
$recycleScan = Get-ItemSizeInfo -Paths $recyclePaths -Recurse
$windowsUpdateScan = Get-ItemSizeInfo -Paths @($windowsUpdatePath) -Recurse
$thumbnailScan = Get-ItemSizeInfo -Paths @($explorerCachePath) -Filters @('thumbcache_*', 'iconcache_*')
$errorReportScan = Get-ItemSizeInfo -Paths @($crashDumpPath, $userWerPath, $systemWerPath) -Recurse

$items = @(
    [PSCustomObject]@{ id = 'temp'; sizeBytes = $tempScan.sizeBytes; path = 'Windows + user temp folders'; inaccessible = $tempScan.inaccessible },
    [PSCustomObject]@{ id = 'prefetch'; sizeBytes = $prefetchScan.sizeBytes; path = $prefetchPath; inaccessible = $prefetchScan.inaccessible },
    [PSCustomObject]@{ id = 'recycle_bin'; sizeBytes = $recycleScan.sizeBytes; path = 'Recycle Bin'; inaccessible = $recycleScan.inaccessible },
    [PSCustomObject]@{ id = 'windows_update'; sizeBytes = $windowsUpdateScan.sizeBytes; path = $windowsUpdatePath; inaccessible = $windowsUpdateScan.inaccessible },
    [PSCustomObject]@{ id = 'thumbnail_cache'; sizeBytes = $thumbnailScan.sizeBytes; path = $explorerCachePath; inaccessible = $thumbnailScan.inaccessible },
    [PSCustomObject]@{ id = 'error_reports'; sizeBytes = $errorReportScan.sizeBytes; path = 'CrashDumps + Windows Error Reporting'; inaccessible = $errorReportScan.inaccessible }
)

$items | ConvertTo-Json -Compress
`;

function normalizeCleanerItems(data) {
  const items = Array.isArray(data) ? data : [data];
  return items.map((item) => ({
    id: String(item.id || ''),
    sizeBytes: Number(item.sizeBytes || 0),
    path: String(item.path || ''),
    inaccessible: Boolean(item.inaccessible)
  })).filter((item) => CLEANER_TASK_IDS.includes(item.id));
}

// Delete logic for the selected cleaner tasks. Expects a $tasks string array to
// be defined in scope. Shared by the one-shot elevated clean and by the
// persistent admin worker.
const CLEANER_CLEAN_BODY_PS = `
if (-not (Get-Command Write-CleanerProgress -ErrorAction SilentlyContinue)) {
    function Write-CleanerProgress([string]$m) { }
}

$script:myleSkippedFiles = 0
$script:myleSkippedBytes = [Int64]0

function Remove-PathContents {
    param(
        [string[]]$Paths,
        [string[]]$Filters = @('*')
    )

    foreach ($target in $Paths) {
        if ([string]::IsNullOrWhiteSpace($target) -or -not (Test-Path -LiteralPath $target)) {
            continue
        }

        foreach ($filter in $Filters) {
            Get-ChildItem -LiteralPath $target -Filter $filter -Force -ErrorAction SilentlyContinue | ForEach-Object {
                $item = $_
                if ($null -eq $item -or [string]::IsNullOrEmpty($item.FullName)) { return }
                try {
                    if ($item.PSIsContainer) { [System.IO.Directory]::Delete($item.FullName, $true) }
                    else { [System.IO.File]::Delete($item.FullName) }
                } catch {
                    try { Remove-Item -LiteralPath $item.FullName -Force -Recurse -ErrorAction SilentlyContinue } catch { }
                    if (Test-Path -LiteralPath $item.FullName) {
                        if ($item.PSIsContainer) {
                            Get-ChildItem -LiteralPath $item.FullName -Recurse -Force -File -ErrorAction SilentlyContinue | ForEach-Object {
                                $script:myleSkippedFiles++
                                $script:myleSkippedBytes += [Int64]$_.Length
                            }
                        } else {
                            $script:myleSkippedFiles++
                            $script:myleSkippedBytes += [Int64]$item.Length
                        }
                    }
                }
            }
        }
    }
}

$recentPath = Join-Path $env:APPDATA 'Microsoft\\Windows\\Recent'

if ($tasks -contains 'temp') {
    Write-CleanerProgress 'Cleaning temporary files...'
    Remove-PathContents -Paths @($env:TEMP, $env:TMP, (Join-Path $env:SystemRoot 'Temp'), $recentPath)
}

if ($tasks -contains 'prefetch') {
    Write-CleanerProgress 'Cleaning Prefetch files...'
    Remove-PathContents -Paths @((Join-Path $env:SystemRoot 'Prefetch'))
}

if ($tasks -contains 'recycle_bin') {
    Write-CleanerProgress 'Emptying Recycle Bin...'
    Clear-RecycleBin -Force -ErrorAction SilentlyContinue
    if (-not $myleUserSid) { $myleUserSid = ([System.Security.Principal.WindowsIdentity]::GetCurrent()).User.Value }
    $recycleRoots = @(Get-PSDrive -PSProvider FileSystem | ForEach-Object { Join-Path $_.Root ('$Recycle.Bin\\' + $myleUserSid) })
    Remove-PathContents -Paths $recycleRoots
}

if ($tasks -contains 'windows_update') {
    Write-CleanerProgress 'Cleaning Windows Update cache...'
    Stop-Service -Name wuauserv -Force -ErrorAction SilentlyContinue
    Remove-PathContents -Paths @((Join-Path $env:SystemRoot 'SoftwareDistribution\\Download'))
    Start-Service -Name wuauserv -ErrorAction SilentlyContinue
}

if ($tasks -contains 'thumbnail_cache') {
    Write-CleanerProgress 'Clearing thumbnail cache (Explorer will restart)...'
    Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    $explorerCachePath = Join-Path $env:LOCALAPPDATA 'Microsoft\\Windows\\Explorer'
    Remove-PathContents -Paths @($explorerCachePath) -Filters @('thumbcache_*', 'iconcache_*')
    Start-Process explorer.exe
}

if ($tasks -contains 'error_reports') {
    Write-CleanerProgress 'Clearing error reports and crash dumps...'
    Remove-PathContents -Paths @(
        (Join-Path $env:LOCALAPPDATA 'CrashDumps'),
        (Join-Path $env:LOCALAPPDATA 'Microsoft\\Windows\\WER'),
        (Join-Path $env:ProgramData 'Microsoft\\Windows\\WER')
    )
}

if ($script:myleSkippedFiles -gt 0) {
    $mbSkipped = [Math]::Round($script:myleSkippedBytes / 1MB, 1)
    Write-CleanerProgress ("Skipped " + $script:myleSkippedFiles + " file(s) still in use by running apps (" + $mbSkipped + " MB) - close those apps and clean again to remove them.")
}
Write-CleanerProgress 'Selected items cleaned.'
`;

// ── Persistent cleaner admin session ─────────────────────────────────────────
// One UAC acceptance starts a hidden elevated PowerShell worker that serves
// scan/clean requests over file-based IPC for the rest of the app session,
// so the user is never prompted again. The worker exits when the app dies.
let _cleanerAdmin = null; // { dir, seq } | null

function cleanerAdminPaths(dir) {
  return {
    alive: path.join(dir, 'alive.flag'),
    stop: path.join(dir, 'stop.flag')
  };
}

async function isCleanerAdminAlive() {
  if (!_cleanerAdmin) return false;
  const { alive } = cleanerAdminPaths(_cleanerAdmin.dir);
  // The worker refreshes alive.flag every ~300ms. Retry a few times before
  // declaring the session dead so a momentary gap doesn't discard it.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const stat = fs.statSync(alive);
      if (Date.now() - stat.mtimeMs < 8000) return true;
    } catch { }
    await new Promise((r) => setTimeout(r, 350));
  }
  _cleanerAdmin = null;
  return false;
}

function buildCleanerAdminWorkerScript(dir, parentPid, userSid) {
  const dirPS = dir.replace(/'/g, "''");
  const sidLine = userSid ? `$myleUserSid = '${userSid}'` : '';
  return `
$ErrorActionPreference = 'SilentlyContinue'
$dir = '${dirPS}'
$parentPid = ${parentPid}
${sidLine}

$script:progPath = $null
function Write-CleanerProgress([string]$m) {
    if ($script:progPath) {
        Add-Content -LiteralPath $script:progPath -Value $m -Encoding UTF8
    }
    Set-Content -LiteralPath (Join-Path $dir 'alive.flag') -Value ([string][DateTimeOffset]::Now.ToUnixTimeSeconds()) -Encoding UTF8
}

function Get-CleanerSizes {
${CLEANER_SCAN_PS}
}

function Invoke-CleanerClean {
    param([string[]]$Tasks)
    $tasks = @($Tasks)
${CLEANER_CLEAN_BODY_PS}
}

while ($true) {
    if (Test-Path -LiteralPath (Join-Path $dir 'stop.flag')) { break }
    if (-not (Get-Process -Id $parentPid -ErrorAction SilentlyContinue)) { break }
    Set-Content -LiteralPath (Join-Path $dir 'alive.flag') -Value ([string][DateTimeOffset]::Now.ToUnixTimeSeconds()) -Encoding UTF8

    $cmds = Get-ChildItem -LiteralPath $dir -Filter 'cmd-*.json' -ErrorAction SilentlyContinue
    foreach ($cmd in $cmds) {
        $resPath = Join-Path $dir (($cmd.BaseName -replace '^cmd-', 'res-') + '.json')
        $script:progPath = Join-Path $dir (($cmd.BaseName -replace '^cmd-', 'prog-') + '.log')
        try {
            $req = Get-Content -LiteralPath $cmd.FullName -Raw | ConvertFrom-Json
            if ($req.action -eq 'clean') {
                Invoke-CleanerClean -Tasks @($req.tasks)
                Write-CleanerProgress 'Refreshing sizes...'
            }
            $json = Get-CleanerSizes
            Set-Content -LiteralPath ($resPath + '.tmp') -Value $json -Encoding UTF8
            Move-Item -LiteralPath ($resPath + '.tmp') -Destination $resPath -Force
        } catch {
            Set-Content -LiteralPath $resPath -Value (@{ error = $_.Exception.Message } | ConvertTo-Json -Compress) -Encoding UTF8
        }
        $script:progPath = $null
        Remove-Item -LiteralPath $cmd.FullName -Force -ErrorAction SilentlyContinue
    }

    Start-Sleep -Milliseconds 300
}

Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
`;
}

async function enableCleanerAdminSession() {
  if (process.platform !== 'win32') {
    return { success: false, error: 'This feature is only available on Windows' };
  }
  if (await isCleanerAdminAlive()) {
    return { success: true, enabled: true };
  }

  // The IPC directory must live OUTSIDE %TEMP% — the 'temp' cleaner task wipes
  // %TEMP% and would destroy the session's own command/response files mid-clean.
  const ipcRoot = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'MakeYourLifeEasier')
    : path.join(os.homedir(), '.myle');

  // Stale dirs survive a crash (the worker only removes its own dir on a
  // graceful stop). Orphaned workers exit on their own via the parent-PID check.
  try {
    for (const entry of fs.readdirSync(ipcRoot)) {
      if (entry.startsWith('cleaner-admin-')) {
        try { fs.rmSync(path.join(ipcRoot, entry), { recursive: true, force: true }); } catch { }
      }
    }
  } catch { }

  const dir = path.join(ipcRoot, `cleaner-admin-${process.pid}-${Date.now()}`);
  const workerPath = path.join(dir, 'worker.ps1');
  const userSid = await getCurrentUserSid();
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(workerPath, buildCleanerAdminWorkerScript(dir, process.pid, userSid), 'utf8');
  } catch (error) {
    return { success: false, error: error.message };
  }

  const workerPS = workerPath.replace(/'/g, "''");
  const launched = await new Promise((resolve) => {
    const launcher = spawn('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      `Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File','${workerPS}') -Verb RunAs -WindowStyle Hidden`
    ], { windowsHide: true });
    launcher.on('error', () => resolve(false));
    // Exit code is non-zero when the user cancels the UAC dialog.
    launcher.on('close', (code) => resolve(code === 0));
  });

  if (!launched) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { }
    return { success: false, enabled: false, code: 'UAC_DENIED', error: 'Administrator access was not granted.' };
  }

  // Wait for the worker's heartbeat so the session is provably serving.
  const { alive } = cleanerAdminPaths(dir);
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (fs.existsSync(alive)) {
      _cleanerAdmin = { dir, seq: 0 };
      debug('info', 'Cleaner admin session started');
      return { success: true, enabled: true };
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { }
  return { success: false, enabled: false, code: 'TIMEOUT', error: 'Administrator session did not start in time.' };
}

async function cleanerAdminExec(request, timeoutMs, onProgress = null) {
  if (!_cleanerAdmin) return { success: false, error: 'No admin session' };
  const { dir } = _cleanerAdmin;
  const id = ++_cleanerAdmin.seq;
  const cmdPath = path.join(dir, `cmd-${id}.json`);
  const resPath = path.join(dir, `res-${id}.json`);
  const progPath = path.join(dir, `prog-${id}.log`);

  try {
    fs.writeFileSync(`${cmdPath}.tmp`, JSON.stringify(request), 'utf8');
    fs.renameSync(`${cmdPath}.tmp`, cmdPath);
  } catch (error) {
    return { success: false, error: error.message };
  }

  let progOffset = 0;
  const drainProgress = () => {
    if (!onProgress) return;
    try {
      const text = fs.readFileSync(progPath, 'utf8');
      if (text.length > progOffset) {
        const chunk = text.slice(progOffset);
        progOffset = text.length;
        for (const line of chunk.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (trimmed) {
            try { onProgress(trimmed); } catch { }
          }
        }
      }
    } catch { }
  };
  const cleanupProgress = () => {
    drainProgress();
    try { fs.unlinkSync(progPath); } catch { }
  };

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    drainProgress();
    if (fs.existsSync(resPath)) {
      try {
        const raw = fs.readFileSync(resPath, 'utf8').trim();
        fs.unlinkSync(resPath);
        cleanupProgress();
        const parsed = JSON.parse(raw);
        if (parsed && parsed.error) return { success: false, error: parsed.error };
        return { success: true, data: parsed };
      } catch (error) {
        cleanupProgress();
        return { success: false, error: `Could not parse admin session output: ${error.message}` };
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  _cleanerAdmin = null;
  try { fs.unlinkSync(cmdPath); } catch { }
  cleanupProgress();
  return { success: false, error: 'Admin session request timed out.' };
}

function stopCleanerAdminSession() {
  if (!_cleanerAdmin) return;
  try {
    const { stop } = cleanerAdminPaths(_cleanerAdmin.dir);
    fs.writeFileSync(stop, 'stop', 'utf8');
  } catch { }
  _cleanerAdmin = null;
}

async function scanCleanerTasks(options = {}) {
  const wantsElevated = Boolean(options && options.elevated);

  let result;
  let elevated = false;
  if (wantsElevated && await isCleanerAdminAlive()) {
    result = await cleanerAdminExec({ action: 'scan' }, 120000);
    elevated = result.success;
    if (!result.success) {
      debug('warn', 'Admin session scan failed, falling back to limited scan:', result.error);
      result = await runPowerShellJson(CLEANER_SCAN_PS);
    }
  } else {
    result = await runPowerShellJson(CLEANER_SCAN_PS);
  }
  if (!result.success) return result;

  const normalized = normalizeCleanerItems(result.data);
  const totalBytes = normalized.reduce((sum, item) => sum + item.sizeBytes, 0);

  return { success: true, items: normalized, totalBytes, scannedAt: new Date().toISOString(), elevated };
}

async function runCleanerTasks(taskIds, options = {}, onProgress = null) {
  if (process.platform !== 'win32') {
    return { success: false, error: 'This feature is only available on Windows' };
  }

  const selected = Array.isArray(taskIds)
    ? taskIds.map(String).filter((id) => CLEANER_TASK_IDS.includes(id))
    : [];

  if (selected.length === 0) {
    return { success: false, error: 'No cleaner tasks selected.' };
  }

  // If the persistent admin session is active, clean through it — no extra UAC.
  if (await isCleanerAdminAlive()) {
    const result = await cleanerAdminExec({ action: 'clean', tasks: selected }, 300000, onProgress);
    if (result.success) {
      const normalized = normalizeCleanerItems(result.data);
      const totalBytes = normalized.reduce((sum, item) => sum + item.sizeBytes, 0);
      return {
        success: true,
        message: 'Cleaner completed successfully.',
        items: normalized,
        totalBytes,
        scannedAt: new Date().toISOString(),
        elevated: true
      };
    }
    // The session is elevated and already ran the clean. If it is still alive,
    // the failure was inside the clean itself — surface it rather than firing a
    // second UAC one-shot, which would re-prompt and duplicate the same error.
    if (await isCleanerAdminAlive()) {
      return {
        success: false,
        error: result.error || 'Cleaner failed.',
        elevated: true
      };
    }
    debug('warn', 'Cleaner admin session died, falling back to one-shot elevation:', result.error);
  }

  const selectedLiteral = selected.map((id) => `'${id}'`).join(', ');
  const oneShotSid = await getCurrentUserSid();
  const sidLine = oneShotSid ? `$myleUserSid = '${oneShotSid}'` : '';

  // Clean AND rescan inside a single process so sizes come back fresh with no
  // extra round-trip. Elevated one-shot (one UAC) by default; when the caller
  // explicitly declined admin, run non-elevated and skip protected items.
  const combinedScript = `${sidLine}
& {
$ErrorActionPreference = 'SilentlyContinue'
$tasks = @(${selectedLiteral})
${CLEANER_CLEAN_BODY_PS}
} | Out-Null

${CLEANER_SCAN_PS}`;

  const wantsElevated = options.elevated !== false;
  if (onProgress) {
    try { onProgress(wantsElevated ? 'Cleaning selected items (one-time administrator run)...' : 'Cleaning accessible items...'); } catch { }
  }
  const result = wantsElevated
    ? await runElevatedPowerShellJson(combinedScript)
    : await runPowerShellJson(combinedScript);
  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Cleaner failed or administrator permission was denied.',
      code: result.code
    };
  }

  const normalized = normalizeCleanerItems(result.data);
  const totalBytes = normalized.reduce((sum, item) => sum + item.sizeBytes, 0);

  return {
    success: true,
    message: 'Cleaner completed successfully.',
    items: normalized,
    totalBytes,
    scannedAt: new Date().toISOString(),
    elevated: wantsElevated
  };
}

/**
 * Restart computer to BIOS/UEFI
 * @returns {Promise<Object>}
 */
async function restartToBios() {
  return new Promise((resolve) => {
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const psPath = path.join(tempDir, `bios_restart_${timestamp}.ps1`);
    const launcherPath = path.join(tempDir, `bios_launcher_${timestamp}.ps1`);
    const resultPath = path.join(tempDir, `bios_result_${timestamp}.txt`);

    const cleanupTempFiles = () => {
      try { if (fs.existsSync(launcherPath)) fs.unlinkSync(launcherPath); } catch (e) {}
      try { if (fs.existsSync(psPath)) fs.unlinkSync(psPath); } catch (e) {}
      try { if (fs.existsSync(resultPath)) fs.unlinkSync(resultPath); } catch (e) {}
    };

    const psScript = `
# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    "ADMIN_FAILED" | Out-File -FilePath "${resultPath.replace(/\\/g, '\\\\')}" -Encoding UTF8
    exit 1
}

"ADMIN_OK" | Out-File -FilePath "${resultPath.replace(/\\/g, '\\\\')}" -Encoding UTF8

$firmwareType = (Get-ItemProperty -Path "HKLM:\\System\\CurrentControlSet\\Control" -Name PEFirmwareType -ErrorAction SilentlyContinue).PEFirmwareType
if ($firmwareType -ne 2) {
    "NOT_UEFI" | Out-File -FilePath "${resultPath.replace(/\\/g, '\\\\')}" -Encoding UTF8 -Append
    exit 1
}

try {
    shutdown /r /fw /t 3
    "RESTART_OK" | Out-File -FilePath "${resultPath.replace(/\\/g, '\\\\')}" -Encoding UTF8 -Append
    exit 0
} catch {
    "RESTART_FAILED" | Out-File -FilePath "${resultPath.replace(/\\/g, '\\\\')}" -Encoding UTF8 -Append
    exit 1
}
`;

    // Elevate via PowerShell Start-Process -Verb RunAs (VBScript is disabled on Win11 24H2+)
    const psPathPS = psPath.replace(/'/g, "''");
    const launcherScript = `Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','${psPathPS}') -Verb RunAs -WindowStyle Hidden -Wait`;

    try {
      fs.writeFileSync(psPath, psScript, 'utf8');
      fs.writeFileSync(launcherPath, launcherScript, 'utf8');

      const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launcherPath], { windowsHide: true });

      child.on('error', (err) => {
        cleanupTempFiles();
        resolve({ success: false, error: 'Failed to launch elevation script: ' + err.message });
      });

      child.on('close', () => {
        setTimeout(() => {
          try {
            if (fs.existsSync(resultPath)) {
              const result = fs.readFileSync(resultPath, 'utf8').trim();

              if (result.includes('ADMIN_OK') && result.includes('RESTART_OK')) {
                resolve({ success: true, message: 'Restarting to BIOS in 3 seconds...' });
              } else if (result.includes('ADMIN_FAILED')) {
                resolve({ success: false, error: 'Administrator privileges denied.', code: 'UAC_DENIED' });
              } else if (result.includes('NOT_UEFI')) {
                resolve({ success: false, error: 'This PC uses legacy BIOS firmware, which does not support booting to firmware settings from Windows. Enter BIOS/UEFI manually (usually Del or F2 during startup).', code: 'NOT_UEFI' });
              } else {
                resolve({ success: false, error: 'Restart command failed.', code: 'RESTART_FAILED' });
              }
            } else {
              resolve({ success: false, error: 'UAC cancelled.', code: 'UAC_CANCELLED' });
            }
          } catch (readError) {
            resolve({ success: false, error: 'Could not verify restart status: ' + readError.message });
          } finally {
            cleanupTempFiles();
          }
        }, 2000);
      });
    } catch (fileError) {
      cleanupTempFiles();
      resolve({ success: false, error: 'Failed to create elevation script: ' + fileError.message });
    }
  });
}

/**
 * Run Sparkle Debloat utility
 * Downloads, extracts and runs Sparkle from Dropbox
 * @returns {Promise<Object>}
 */
async function runSparkleDebloat() {
  if (process.platform !== 'win32') {
    return { success: false, error: 'Sparkle Debloat is only supported on Windows.' };
  }

  try {
    const sparkleModule = require('./sparkle');
    
    debug('info', '🔍 Checking for Sparkle...');
    
    // First ensure Sparkle is available
    const ensureResult = await sparkleModule.ensureSparkle();
    if (!ensureResult.success) {
      debug('error', '❌ Failed to ensure Sparkle:', ensureResult.error);
      return {
        success: false,
        error: ensureResult.error || 'Failed to ensure Sparkle is available'
      };
    }
    
    debug('info', '✅ Sparkle check completed:', ensureResult.message);
    
    // If download is needed, return download info to renderer
    if (ensureResult.needsDownload) {
      debug('info', '📥 Sparkle needs to be downloaded, returning download info');
      return {
        success: true,
        needsDownload: true,
        downloadId: ensureResult.id,
        downloadUrl: ensureResult.url,
        downloadDest: ensureResult.dest,
        message: 'Sparkle needs to be downloaded'
      };
    }
    
    // Get the final executable path
    let exeToRun = ensureResult.sparkleExePath || sparkleModule.getSparkleExePath();
    
    // Verify the executable exists
    if (!exeToRun || !fs.existsSync(exeToRun)) {
      debug('error', '❌ Sparkle executable not found at:', exeToRun);
      
      // Try to find it in any location
      const available = sparkleModule.isSparkleAvailable();
      if (available) {
        exeToRun = sparkleModule.getSparkleExePath();
        debug('info', '🔍 Found Sparkle at alternative location:', exeToRun);
      } else {
        return {
          success: false,
          error: 'Sparkle executable not found after download/verification.',
          code: 'EXE_NOT_FOUND'
        };
      }
    }
    
    // Verify file size is reasonable
    try {
      const stats = fs.statSync(exeToRun);
      const minSize = 5 * 1024 * 1024; // 5MB minimum
      if (stats.size < minSize) {
        debug('warn', `⚠️ Sparkle file seems too small: ${stats.size} bytes`);
        return {
          success: false,
          error: 'Sparkle executable appears to be corrupted or incomplete.',
          code: 'FILE_CORRUPTED'
        };
      }
      debug('info', `📏 Sparkle file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    } catch (err) {
      debug('error', '❌ Error checking Sparkle file:', err.message);
      return {
        success: false,
        error: 'Cannot access Sparkle executable: ' + err.message,
        code: 'FILE_ACCESS_ERROR'
      };
    }

    debug('info', '🚀 Launching Sparkle Debloat from:', exeToRun);

    // Use shell.openPath for better compatibility on Windows
    const { shell } = require('electron');
    
    try {
      // Wait for shell.openPath to complete
      const error = await shell.openPath(exeToRun);
      
      if (error) {
        debug('error', '❌ Failed to launch Sparkle:', error);
        return {
          success: false,
          error: 'Failed to launch Sparkle: ' + error,
          code: 'LAUNCH_FAILED'
        };
      }
      
      debug('success', '✅ Sparkle Debloat launched successfully');
      return {
        success: true,
        message: 'Sparkle Debloat launched successfully',
        exePath: exeToRun
      };
    } catch (err) {
      debug('error', '❌ Error launching Sparkle:', err.message);
      return {
        success: false,
        error: 'Error launching Sparkle: ' + err.message,
        code: 'LAUNCH_ERROR'
      };
    }
    
  } catch (err) {
    debug('error', '❌ Error in runSparkleDebloat:', err);
    debug('error', err.stack);
    return { 
      success: false, 
      error: err.message,
      code: 'UNEXPECTED_ERROR' 
    };
  }
}

/**
 * Run an elevated command hidden, streaming its output via a tailed log file
 * @returns {{ child: ChildProcess, done: Promise<Object> }}
 */
function runElevatedStreaming(name, innerBody, propagateExitCode, onOutput = () => { }, heartbeat = false) {
  const psExe = getPowerShellExe() || 'powershell';
  const rawLogPath = path.join(os.tmpdir(), `${name}_${Date.now()}.log`);
  const logPath = rawLogPath.replace(/'/g, "''");
  const tmpScriptPath = path.join(os.tmpdir(), `${name}_${Date.now()}.ps1`);

  const psLines = [
    "$ErrorActionPreference = 'Continue'",
    'try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }',
    `$log = '${logPath}'`,
    `$stopFile = '${logPath}.stop'`,
    'Remove-Item $log -Force -ErrorAction SilentlyContinue',
    'New-Item -ItemType File -Path $log -Force | Out-Null',
    '$inner = "& { ' + innerBody + ' } *>&1 | Out-File -FilePath \'$log\' -Append -Encoding utf8' + (propagateExitCode ? '; exit `$LASTEXITCODE' : '') + '"',
    'try {',
    " $p = Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command', $inner) -PassThru",
    '} catch {',
    " Write-Output 'Administrator permission was denied.'",
    ' exit 1',
    '}',
    ...(heartbeat ? [
      '[Console]::Out.Write("Task started with administrator privileges.`n")',
      '[Console]::Out.Flush()'
    ] : []),
    '$pos = 0',
    '$hb = [System.Diagnostics.Stopwatch]::StartNew()',
    '$total = [System.Diagnostics.Stopwatch]::StartNew()',
    'while ($true) {',
    ' Start-Sleep -Milliseconds 400',
    ' try {',
    "  $fs = [System.IO.File]::Open($log, 'Open', 'Read', 'ReadWrite')",
    "  $fs.Seek($pos, 'Begin') | Out-Null",
    '  $sr = New-Object System.IO.StreamReader($fs, [System.Text.Encoding]::UTF8)',
    '  $new = $sr.ReadToEnd()',
    '  $pos = $fs.Position',
    '  $sr.Close()',
    '  $fs.Close()',
    '  $new = $new -replace [string][char]0xFEFF, \'\' -replace [string][char]0, \'\'',
    '  if ($new) { [Console]::Out.Write($new); [Console]::Out.Flush(); $hb.Restart() }',
    ' } catch { }',
    ...(heartbeat ? [
      ' if ($hb.Elapsed.TotalSeconds -ge 10) { $hb.Restart(); $es = [int]$total.Elapsed.TotalSeconds; [Console]::Out.Write("... running (" + $es + "s elapsed)`n"); [Console]::Out.Flush() }'
    ] : []),
    ' if (Test-Path -LiteralPath $stopFile) { try { Stop-Process -Id $p.Id -Force } catch { }; break }',
    ' if ($p.HasExited) { break }',
    '}',
    '$p.WaitForExit()',
    'Remove-Item $log -Force -ErrorAction SilentlyContinue',
    'exit $p.ExitCode'
  ];

  fs.writeFileSync(tmpScriptPath, psLines.join('\n'), 'utf8');

  const child = spawn(psExe, [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpScriptPath
  ], { shell: false, windowsHide: true });

  if (child.stdout) {
    child.stdout.on('data', (data) => onOutput('stdout', data.toString()));
  }
  if (child.stderr) {
    child.stderr.on('data', (data) => onOutput('stderr', data.toString()));
  }

  const stopPath = `${rawLogPath}.stop`;
  const done = new Promise((resolve) => {
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      try { fs.unlinkSync(tmpScriptPath); } catch { }
      try { fs.unlinkSync(stopPath); } catch { }
      resolve(result);
    };
    child.on('error', (err) => settle({ success: false, error: err.message }));
    child.on('close', (code) => settle({ success: code === 0, code }));
  });

  const cancel = () => {
    try { fs.writeFileSync(stopPath, 'stop', 'utf8'); } catch { }
    setTimeout(() => {
      try { child.kill(); } catch { }
    }, 5000);
  };

  return { child, done, cancel };
}

function runChrisTitus(onOutput = () => { }) {
  return runElevatedStreaming(
    'christitus',
    "`$ProgressPreference='SilentlyContinue'; irm christitus.com/win | iex",
    false,
    onOutput
  );
}

function runElevatedConsoleTask(name, exe, exeArgs, onOutput = () => { }, extraCleanup = []) {
  const psExe = getPowerShellExe() || 'powershell';
  const stamp = Date.now();
  const logPath = path.join(os.tmpdir(), `${name}_${stamp}.log`).replace(/'/g, "''");
  const workerPath = path.join(os.tmpdir(), `${name}_worker_${stamp}.ps1`);
  const outerPath = path.join(os.tmpdir(), `${name}_outer_${stamp}.ps1`);
  const argList = exeArgs.map((a) => `'${a.replace(/'/g, "''")}'`).join(',');

  const workerLines = [
    `$log = '${logPath}'`,
    `$stopFile = '${logPath}.stop'`,
    '$enc = New-Object System.Text.UTF8Encoding($false)',
    'function Emit([string]$s) { [System.IO.File]::AppendAllText($log, $s, $enc) }',
    '$raw = $Host.UI.RawUI',
    '$width = $raw.BufferSize.Width',
    'function ReadRow([int]$y) {',
    ' $rect = New-Object System.Management.Automation.Host.Rectangle 0, $y, ($width - 1), $y',
    ' $cells = $raw.GetBufferContents($rect)',
    ' $sb = New-Object System.Text.StringBuilder',
    ' foreach ($cell in $cells) { [void]$sb.Append($cell.Character) }',
    ' $sb.ToString().TrimEnd()',
    '}',
    '$lastY = $raw.CursorPosition.Y',
    "$lastLine = ''",
    'try {',
    ` $p = Start-Process -FilePath '${exe}' -ArgumentList @(${argList}) -NoNewWindow -PassThru`,
    '} catch {',
    ' Emit ("Failed to start: " + $_.Exception.Message + "`n")',
    ' exit 1',
    '}',
    'while ($true) {',
    ' Start-Sleep -Milliseconds 400',
    ' try {',
    '  $curY = $raw.CursorPosition.Y',
    '  while ($lastY -lt $curY) {',
    '   $line = ReadRow $lastY',
    '   Emit ("`r" + $line + "`n")',
    '   $lastY++',
    "   $lastLine = ''",
    '  }',
    '  $cur = ReadRow $curY',
    '  if ($cur -ne $lastLine) { Emit ("`r" + $cur); $lastLine = $cur }',
    ' } catch { }',
    ' if (Test-Path -LiteralPath $stopFile) { try { Stop-Process -Id $p.Id -Force } catch { }; break }',
    ' if ($p.HasExited) { break }',
    '}',
    'Start-Sleep -Milliseconds 300',
    'try {',
    ' $curY = $raw.CursorPosition.Y',
    ' while ($lastY -lt $curY) {',
    '  $line = ReadRow $lastY',
    '  Emit ("`r" + $line + "`n")',
    '  $lastY++',
    ' }',
    ' $fin = ReadRow $curY',
    ' if ($fin -ne $lastLine) { Emit ("`r" + $fin) }',
    ' Emit "`n"',
    '} catch { }',
    '$p.WaitForExit()',
    'exit $p.ExitCode'
  ];

  const outerLines = [
    "$ErrorActionPreference = 'Continue'",
    'try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }',
    `$log = '${logPath}'`,
    'Remove-Item $log -Force -ErrorAction SilentlyContinue',
    'New-Item -ItemType File -Path $log -Force | Out-Null',
    'try {',
    ` $p = Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','${workerPath.replace(/'/g, "''")}') -PassThru`,
    '} catch {',
    " Write-Output 'Administrator permission was denied.'",
    ' exit 1',
    '}',
    '[Console]::Out.Write("Task started with administrator privileges.`n")',
    '[Console]::Out.Flush()',
    '$pos = 0',
    'while ($true) {',
    ' Start-Sleep -Milliseconds 300',
    ' try {',
    "  $fs = [System.IO.File]::Open($log, 'Open', 'Read', 'ReadWrite')",
    "  $fs.Seek($pos, 'Begin') | Out-Null",
    '  $sr = New-Object System.IO.StreamReader($fs, [System.Text.Encoding]::UTF8)',
    '  $new = $sr.ReadToEnd()',
    '  $pos = $fs.Position',
    '  $sr.Close()',
    '  $fs.Close()',
    '  $new = $new -replace [string][char]0xFEFF, \'\' -replace [string][char]0, \'\'',
    '  if ($new) { [Console]::Out.Write($new); [Console]::Out.Flush() }',
    ' } catch { }',
    ' if ($p.HasExited) { break }',
    '}',
    '$p.WaitForExit()',
    'Remove-Item $log -Force -ErrorAction SilentlyContinue',
    'exit $p.ExitCode'
  ];

  fs.writeFileSync(workerPath, workerLines.join('\n'), 'utf8');
  fs.writeFileSync(outerPath, outerLines.join('\n'), 'utf8');

  const child = spawn(psExe, [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', outerPath
  ], { shell: false, windowsHide: true });

  if (child.stdout) {
    child.stdout.on('data', (data) => onOutput('stdout', data.toString()));
  }
  if (child.stderr) {
    child.stderr.on('data', (data) => onOutput('stderr', data.toString()));
  }

  const stopPath = path.join(os.tmpdir(), `${name}_${stamp}.log.stop`);
  const done = new Promise((resolve) => {
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      try { fs.unlinkSync(outerPath); } catch { }
      try { fs.unlinkSync(workerPath); } catch { }
      try { fs.unlinkSync(stopPath); } catch { }
      for (const extra of extraCleanup) {
        try { fs.unlinkSync(extra); } catch { }
      }
      resolve(result);
    };
    child.on('error', (err) => settle({ success: false, error: err.message }));
    child.on('close', (code) => settle({ success: code === 0, code }));
  });

  const cancel = () => {
    try { fs.writeFileSync(stopPath, 'stop', 'utf8'); } catch { }
    setTimeout(() => {
      try { child.kill(); } catch { }
    }, 5000);
  };

  return { child, done, cancel };
}

function runMaintenanceScript(name, scriptBody, onOutput = () => { }) {
  const taskPath = path.join(os.tmpdir(), `${name}_task_${Date.now()}.ps1`);
  fs.writeFileSync(taskPath, scriptBody, 'utf8');
  return runElevatedConsoleTask(
    name,
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', taskPath],
    onOutput,
    [taskPath]
  );
}

function runSfcScan(onOutput = () => { }) {
  return runElevatedConsoleTask('sfc_scan', 'sfc', ['/scannow'], onOutput);
}

function runDismRepair(onOutput = () => { }) {
  return runElevatedConsoleTask('dism_repair', 'DISM', ['/Online', '/Cleanup-Image', '/RestoreHealth'], onOutput);
}

/**
 * Flush DNS cache
 * @returns {Promise<Object>}
 */
function flushDnsCache(onOutput = () => { }) {
  return runMaintenanceScript('flush_dns', `
Write-Host "=== FLUSH DNS CACHE ===" -ForegroundColor Cyan
ipconfig /flushdns
exit $LASTEXITCODE
`, onOutput);
}

/**
 * Release and renew IP address
 * @returns {Promise<Object>}
 */
function releaseRenewIp(onOutput = () => { }) {
  return runMaintenanceScript('release_renew_ip', `
Write-Host "=== IP RELEASE & RENEW ===" -ForegroundColor Cyan
Write-Host "Releasing IP address..." -ForegroundColor Yellow
ipconfig /release
Start-Sleep -Seconds 2
Write-Host "Renewing IP address..." -ForegroundColor Yellow
ipconfig /renew
Write-Host "Done!" -ForegroundColor Green
exit $LASTEXITCODE
`, onOutput);
}

/**
 * Fix Bluetooth by restarting the Bluetooth service
 * @returns {Promise<Object>}
 */
function fixBluetooth(onOutput = () => { }) {
  return runMaintenanceScript('fix_bluetooth', `
Write-Host "=== FIX BLUETOOTH ===" -ForegroundColor Cyan
Write-Host "Stopping Bluetooth services..." -ForegroundColor Yellow
Stop-Service -Name bthserv -Force -ErrorAction SilentlyContinue
Stop-Service -Name BluetoothUserService_* -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3
Write-Host "Starting Bluetooth services..." -ForegroundColor Yellow
Start-Service -Name bthserv -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Reset Bluetooth adapter
$btAdapter = Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'OK' -or $_.Status -eq 'Error' }
if ($btAdapter) {
    foreach ($adapter in $btAdapter) {
        Write-Host "Restarting: $($adapter.FriendlyName)" -ForegroundColor Yellow
        Disable-PnpDevice -InstanceId $adapter.InstanceId -Confirm:$false -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Enable-PnpDevice -InstanceId $adapter.InstanceId -Confirm:$false -ErrorAction SilentlyContinue
    }
}
Write-Host "Bluetooth fix completed!" -ForegroundColor Green
`, onOutput);
}

/**
 * Check disk for errors
 * @returns {Promise<Object>}
 */
function checkDisk(onOutput = () => { }) {
  return runMaintenanceScript('check_disk', `
Write-Host "=== CHECK DISK ===" -ForegroundColor Cyan
Write-Host "Running chkdsk on C: drive (read-only scan)..." -ForegroundColor Yellow
chkdsk C:
Write-Host ""
Write-Host "Scan complete. If errors were found, run 'chkdsk C: /F' from an elevated command prompt." -ForegroundColor Yellow
exit $LASTEXITCODE
`, onOutput);
}

/**
 * Network reset (Winsock + IP stack)
 * @returns {Promise<Object>}
 */
function networkReset(onOutput = () => { }) {
  return runMaintenanceScript('network_reset', `
Write-Host "=== NETWORK RESET ===" -ForegroundColor Cyan
Write-Host "Resetting Winsock..." -ForegroundColor Yellow
netsh winsock reset
Write-Host "Resetting IP stack..." -ForegroundColor Yellow
netsh int ip reset
Write-Host "Flushing DNS..." -ForegroundColor Yellow
ipconfig /flushdns
Write-Host ""
Write-Host "Network reset complete! A restart may be required for full effect." -ForegroundColor Green
`, onOutput);
}

/**
 * Restart the Windows Audio system
 * @returns {Promise<Object>}
 */
function restartAudioSystem(onOutput = () => { }) {
  return runMaintenanceScript('restart_audio', `
Write-Host "=== RESTART AUDIO SYSTEM ===" -ForegroundColor Cyan
Write-Host "Stopping audio services..." -ForegroundColor Yellow
Stop-Service -Name Audiosrv -Force -ErrorAction SilentlyContinue
Stop-Service -Name AudioEndpointBuilder -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "Starting audio services..." -ForegroundColor Yellow
Start-Service -Name AudioEndpointBuilder -ErrorAction SilentlyContinue
Start-Service -Name Audiosrv -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Write-Host "Audio system restarted!" -ForegroundColor Green
`, onOutput);
}

module.exports = {
  runSfcScan,
  runDismRepair,
  scanCleanerTasks,
  runCleanerTasks,
  enableCleanerAdminSession,
  stopCleanerAdminSession,
  restartToBios,
  runSparkleDebloat,
  runChrisTitus,
  flushDnsCache,
  releaseRenewIp,
  fixBluetooth,
  checkDisk,
  networkReset,
  restartAudioSystem
};
