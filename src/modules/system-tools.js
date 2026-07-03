/**
 * System Tools Module
 * Windows system maintenance tools (SFC, DISM, Temp cleanup, etc.)
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runElevatedPowerShellScript, runElevatedPowerShellScriptHidden, getPowerShellExe, runSpawnCommand } = require('./process-utils');
const { debug } = require('./debug');

function createSystemTask({ script, successMsg, errorMsg, hidden = false, guardMsg = 'This feature is only available on Windows' }) {
  return async function () {
    if (process.platform !== 'win32') {
      return { success: false, error: guardMsg };
    }
    const runner = hidden ? runElevatedPowerShellScriptHidden : runElevatedPowerShellScript;
    return runner(script, successMsg, errorMsg);
  };
}

/**
 * Run SFC scan with elevation
 * @returns {Promise<Object>}
 */
const runSfcScan = createSystemTask({
  guardMsg: 'SFC is only available on Windows',
  script: `
Write-Host "=== SYSTEM FILE CHECK (SFC) ===" -ForegroundColor Cyan
Write-Host "Running sfc /scannow..." -ForegroundColor Yellow
sfc /scannow
exit $LASTEXITCODE
`,
  successMsg: '✅ SFC scan completed successfully!',
  errorMsg: 'SFC scan encountered errors or was cancelled. Please accept the UAC prompt and try again.'
});

/**
 * Run DISM repair with elevation
 * @returns {Promise<Object>}
 */
const runDismRepair = createSystemTask({
  guardMsg: 'DISM is only available on Windows',
  script: `
Write-Host "=== DEPLOYMENT IMAGE SERVICING AND MANAGEMENT (DISM) ===" -ForegroundColor Cyan
Write-Host "Running DISM /Online /Cleanup-Image /RestoreHealth..." -ForegroundColor Yellow
DISM /Online /Cleanup-Image /RestoreHealth
exit $LASTEXITCODE
`,
  successMsg: '✅ DISM repair completed successfully!',
  errorMsg: 'DISM repair encountered errors or was cancelled. Please accept the UAC prompt and try again.'
});

/**
 * Run temporary files cleanup with elevation
 * @returns {Promise<Object>}
 */
async function runTempCleanup() {
  if (process.platform !== 'win32') {
    return { success: false, error: 'This feature is only available on Windows' };
  }

  const timestamp = Date.now();
  const logFile = path.join(os.tmpdir(), `cleanup_log_${timestamp}.txt`);
  const logFileEscaped = logFile.replace(/\\/g, '\\\\');

  const psScript = `
$logFile = "${logFileEscaped}"
$log = @()
$log += "=== TEMPORARY FILES CLEANUP ==="
$log += "Started at: $(Get-Date)"
$log += ""

$totalCleaned = 0
$totalErrors = 0

# 1. Clean Recent files
$log += "1. Cleaning Recent files..."
$recentPath = [System.IO.Path]::Combine($env:APPDATA, "Microsoft", "Windows", "Recent")
if (Test-Path $recentPath) {
    try {
        $items = Get-ChildItem $recentPath -Force -ErrorAction SilentlyContinue
        $count = ($items | Measure-Object).Count
        $items | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
        $totalCleaned += $count
        $log += "   OK: Recent files cleaned ($count items)"
    } catch {
        $log += "   ERROR: $($_.Exception.Message)"
        $totalErrors++
    }
} else {
    $log += "   SKIP: Recent folder not found"
}

# 2. Clean Prefetch
$log += "2. Cleaning Prefetch..."
$prefetchPath = "$env:SystemRoot\\Prefetch"
if (Test-Path $prefetchPath) {
    try {
        $items = Get-ChildItem $prefetchPath -Force -ErrorAction SilentlyContinue
        $count = ($items | Measure-Object).Count
        $items | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
        $totalCleaned += $count
        $log += "   OK: Prefetch cleaned ($count items)"
    } catch {
        $log += "   ERROR: $($_.Exception.Message)"
        $totalErrors++
    }
} else {
    $log += "   SKIP: Prefetch folder not found"
}

# 3. Clean Windows Temp
$log += "3. Cleaning Windows Temp..."
$winTemp = "$env:SystemRoot\\Temp"
if (Test-Path $winTemp) {
    try {
        $items = Get-ChildItem $winTemp -Force -ErrorAction SilentlyContinue
        $count = ($items | Measure-Object).Count
        $items | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
        $totalCleaned += $count
        $log += "   OK: Windows Temp cleaned ($count items)"
    } catch {
        $log += "   ERROR: $($_.Exception.Message)"
        $totalErrors++
    }
} else {
    $log += "   SKIP: Windows Temp folder not found"
}

# 4. Clean User Temp
$log += "4. Cleaning User Temp..."
$userTemp = $env:TEMP
if (Test-Path $userTemp) {
    $items = Get-ChildItem $userTemp -Force -ErrorAction SilentlyContinue
    $count = ($items | Measure-Object).Count
    $deleted = 0
    $skipped = 0
    foreach ($item in $items) {
        try {
            Remove-Item $item.FullName -Force -Recurse -ErrorAction Stop
            $deleted++
        } catch {
            $skipped++
        }
    }
    $totalCleaned += $deleted
    $log += "   OK: User Temp cleaned ($deleted items, $skipped skipped - in use)"
} else {
    $log += "   SKIP: User Temp not found"
}

$log += ""
$log += "=== CLEANUP COMPLETED ==="
$log += "Total items processed: $totalCleaned"
$log += "Total errors: $totalErrors"
$log += "Finished at: $(Get-Date)"

# Write log to file
$log | Out-File -FilePath $logFile -Encoding UTF8
`;

  const result = await runElevatedPowerShellScriptHidden(
    psScript,
    '✅ Temporary files cleanup completed successfully!',
    'Administrator privileges required or cleanup failed. Please accept the UAC prompt and try again.'
  );

  // Read log file for details
  try {
    if (fs.existsSync(logFile)) {
      const logContent = fs.readFileSync(logFile, 'utf8');
      fs.unlinkSync(logFile);
      result.details = logContent;

      const match = logContent.match(/Total errors:\s+(\d+)/i);
      const errorCount = match ? parseInt(match[1], 10) : 0;
      if (!Number.isNaN(errorCount) && errorCount > 0) {
        result.warning = true;
        result.message = `Cleanup completed with warnings. Skipped or failed items: ${errorCount}.`;
      }
    } else {
      debug('warn', '🧹 Cleanup may have been cancelled (UAC denied)');
    }
  } catch (e) {
    // Ignore log file errors
  }

  return result;
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
 * Run Chris Titus Windows Utility
 * @returns {Promise<Object>}
 */
async function runChrisTitus() {
  const psExe = getPowerShellExe() || 'powershell';
  const args = [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-Command',
    'irm christitus.com/win | iex'
  ];

  return runSpawnCommand(psExe, args, { shell: false, windowsHide: false });
}

/**
 * Clean the Recycle Bin
 * @returns {Promise<Object>}
 */
const cleanRecycleBin = createSystemTask({
  hidden: true,
  script: `
Clear-RecycleBin -Force -ErrorAction SilentlyContinue
`,
  successMsg: '✅ Recycle Bin emptied successfully!',
  errorMsg: 'Failed to empty Recycle Bin.'
});

/**
 * Clean Windows Update cache
 * @returns {Promise<Object>}
 */
async function cleanWindowsCache() {
  if (process.platform !== 'win32') {
    return { success: false, error: 'This feature is only available on Windows' };
  }

  const timestamp = Date.now();
  const logFile = path.join(os.tmpdir(), `wincache_log_${timestamp}.txt`);
  const logFileEscaped = logFile.replace(/\\/g, '\\\\');

  const psScript = `
$logFile = "${logFileEscaped}"
$log = @()
$log += "=== WINDOWS CACHE CLEANUP ==="
$totalCleaned = 0

# Stop Windows Update service
Stop-Service -Name wuauserv -Force -ErrorAction SilentlyContinue

# Clean Windows Update cache
$wuPath = "$env:SystemRoot\\SoftwareDistribution\\Download"
if (Test-Path $wuPath) {
    $items = Get-ChildItem $wuPath -Force -ErrorAction SilentlyContinue
    $count = ($items | Measure-Object).Count
    $items | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
    $totalCleaned += $count
    $log += "Windows Update cache: $count items cleaned"
}

# Restart Windows Update service
Start-Service -Name wuauserv -ErrorAction SilentlyContinue

$log += "Total items cleaned: $totalCleaned"
$log | Out-File -FilePath $logFile -Encoding UTF8
`;

  const result = await runElevatedPowerShellScriptHidden(
    psScript,
    '✅ Windows cache cleaned successfully!',
    'Failed to clean Windows cache. Please accept the UAC prompt.'
  );

  try {
    if (fs.existsSync(logFile)) {
      result.details = fs.readFileSync(logFile, 'utf8');
      fs.unlinkSync(logFile);
    }
  } catch (e) { }

  return result;
}

/**
 * Clear thumbnail cache
 * @returns {Promise<Object>}
 */
const clearThumbnailCache = createSystemTask({
  hidden: true,
  script: `
# Kill Explorer to release thumbnail DB locks
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$thumbPath = Join-Path $env:LOCALAPPDATA "Microsoft\\Windows\\Explorer"
if (Test-Path $thumbPath) {
    Get-ChildItem $thumbPath -Filter "thumbcache_*" -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Get-ChildItem $thumbPath -Filter "iconcache_*" -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
}

# Restart Explorer
Start-Process explorer.exe
`,
  successMsg: '✅ Thumbnail cache cleared successfully!',
  errorMsg: 'Failed to clear thumbnail cache.'
});

/**
 * Clear error reports (CrashDumps)
 * @returns {Promise<Object>}
 */
const clearErrorReports = createSystemTask({
  hidden: true,
  script: `
$totalCleaned = 0

# Clean CrashDumps
$crashPath = Join-Path $env:LOCALAPPDATA "CrashDumps"
if (Test-Path $crashPath) {
    $items = Get-ChildItem $crashPath -Force -ErrorAction SilentlyContinue
    $totalCleaned += ($items | Measure-Object).Count
    $items | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
}

# Clean Windows Error Reporting
$werPath = Join-Path $env:LOCALAPPDATA "Microsoft\\Windows\\WER"
if (Test-Path $werPath) {
    $items = Get-ChildItem $werPath -Force -Recurse -ErrorAction SilentlyContinue
    $totalCleaned += ($items | Measure-Object).Count
    Get-ChildItem $werPath -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
        Remove-Item $_.FullName -Force -Recurse -ErrorAction SilentlyContinue
    }
}
`,
  successMsg: '✅ Error reports cleared successfully!',
  errorMsg: 'Failed to clear error reports.'
});

/**
 * Flush DNS cache
 * @returns {Promise<Object>}
 */
const flushDnsCache = createSystemTask({
  script: `
Write-Host "=== FLUSH DNS CACHE ===" -ForegroundColor Cyan
ipconfig /flushdns
exit $LASTEXITCODE
`,
  successMsg: '✅ DNS cache flushed successfully!',
  errorMsg: 'Failed to flush DNS cache.'
});

/**
 * Release and renew IP address
 * @returns {Promise<Object>}
 */
const releaseRenewIp = createSystemTask({
  script: `
Write-Host "=== IP RELEASE & RENEW ===" -ForegroundColor Cyan
Write-Host "Releasing IP address..." -ForegroundColor Yellow
ipconfig /release
Start-Sleep -Seconds 2
Write-Host "Renewing IP address..." -ForegroundColor Yellow
ipconfig /renew
Write-Host "Done!" -ForegroundColor Green
exit $LASTEXITCODE
`,
  successMsg: '✅ IP address released and renewed successfully!',
  errorMsg: 'Failed to release/renew IP address.'
});

/**
 * Fix Bluetooth by restarting the Bluetooth service
 * @returns {Promise<Object>}
 */
const fixBluetooth = createSystemTask({
  script: `
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
`,
  successMsg: '✅ Bluetooth services restarted successfully!',
  errorMsg: 'Failed to fix Bluetooth. Please accept the UAC prompt.'
});

/**
 * Check disk for errors
 * @returns {Promise<Object>}
 */
const checkDisk = createSystemTask({
  script: `
Write-Host "=== CHECK DISK ===" -ForegroundColor Cyan
Write-Host "Running chkdsk on C: drive (read-only scan)..." -ForegroundColor Yellow
chkdsk C:
Write-Host ""
Write-Host "Scan complete. If errors were found, run 'chkdsk C: /F' from an elevated command prompt." -ForegroundColor Yellow
`,
  successMsg: '✅ Disk check completed!',
  errorMsg: 'Failed to run disk check. Please accept the UAC prompt.'
});

/**
 * Network reset (Winsock + IP stack)
 * @returns {Promise<Object>}
 */
const networkReset = createSystemTask({
  script: `
Write-Host "=== NETWORK RESET ===" -ForegroundColor Cyan
Write-Host "Resetting Winsock..." -ForegroundColor Yellow
netsh winsock reset
Write-Host "Resetting IP stack..." -ForegroundColor Yellow
netsh int ip reset
Write-Host "Flushing DNS..." -ForegroundColor Yellow
ipconfig /flushdns
Write-Host ""
Write-Host "Network reset complete! A restart may be required for full effect." -ForegroundColor Green
`,
  successMsg: '✅ Network reset completed! A restart may be required.',
  errorMsg: 'Failed to reset network. Please accept the UAC prompt.'
});

/**
 * Restart the Windows Audio system
 * @returns {Promise<Object>}
 */
const restartAudioSystem = createSystemTask({
  script: `
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
`,
  successMsg: '✅ Audio system restarted successfully!',
  errorMsg: 'Failed to restart audio system. Please accept the UAC prompt.'
});

/**
 * Launch Windows Disk Cleanup utility (cleanmgr)
 * @returns {Promise<Object>}
 */
const runDiskCleaner = createSystemTask({
  hidden: true,
  script: `
Start-Process "cleanmgr.exe" -Verb RunAs
`,
  successMsg: '✅ Disk Cleanup utility launched!',
  errorMsg: 'Failed to launch Disk Cleanup. Please accept the UAC prompt.'
});

module.exports = {
  runSfcScan,
  runDismRepair,
  runTempCleanup,
  restartToBios,
  runSparkleDebloat,
  runChrisTitus,
  cleanRecycleBin,
  cleanWindowsCache,
  clearThumbnailCache,
  clearErrorReports,
  flushDnsCache,
  releaseRenewIp,
  fixBluetooth,
  checkDisk,
  networkReset,
  restartAudioSystem,
  runDiskCleaner
};
