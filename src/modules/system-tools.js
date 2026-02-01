/**
 * System Tools Module
 * Windows system maintenance tools (SFC, DISM, Temp cleanup, etc.)
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runElevatedPowerShellScript, runElevatedPowerShellScriptHidden, getPowerShellExe, runSpawnCommand } = require('./process-utils');
const { debug } = require('./debug');

/**
 * Run SFC scan with elevation
 * @returns {Promise<Object>}
 */
async function runSfcScan() {
  if (process.platform !== 'win32') {
    return { success: false, error: 'SFC is only available on Windows' };
  }

  const psScript = `
Write-Host "=== SYSTEM FILE CHECK (SFC) ===" -ForegroundColor Cyan
Write-Host "Running sfc /scannow..." -ForegroundColor Yellow
sfc /scannow
exit $LASTEXITCODE
`;

  return runElevatedPowerShellScript(
    psScript,
    '✅ SFC scan completed successfully!',
    'SFC scan encountered errors or was cancelled. Please accept the UAC prompt and try again.'
  );
}

/**
 * Run DISM repair with elevation
 * @returns {Promise<Object>}
 */
async function runDismRepair() {
  if (process.platform !== 'win32') {
    return { success: false, error: 'DISM is only available on Windows' };
  }

  const psScript = `
Write-Host "=== DEPLOYMENT IMAGE SERVICING AND MANAGEMENT (DISM) ===" -ForegroundColor Cyan
Write-Host "Running DISM /Online /Cleanup-Image /RestoreHealth..." -ForegroundColor Yellow
DISM /Online /Cleanup-Image /RestoreHealth
exit $LASTEXITCODE
`;

  return runElevatedPowerShellScript(
    psScript,
    '✅ DISM repair completed successfully!',
    'DISM repair encountered errors or was cancelled. Please accept the UAC prompt and try again.'
  );
}

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
$prefetchPath = "C:\\Windows\\Prefetch"
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
$winTemp = "C:\\Windows\\Temp"
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
    const psPath = path.join(tempDir, `bios_restart_${Date.now()}.ps1`);
    const vbsPath = path.join(tempDir, `bios_elevate_${Date.now()}.vbs`);
    const resultPath = path.join(tempDir, `bios_result_${Date.now()}.txt`);

    const psScript = `
# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    "ADMIN_FAILED" | Out-File -FilePath "${resultPath.replace(/\\/g, '\\\\')}" -Encoding UTF8
    exit 1
}

"ADMIN_OK" | Out-File -FilePath "${resultPath.replace(/\\/g, '\\\\')}" -Encoding UTF8

try {
    shutdown /r /fw /t 3
    "RESTART_OK" | Out-File -FilePath "${resultPath.replace(/\\/g, '\\\\')}" -Encoding UTF8 -Append
    exit 0
} catch {
    "RESTART_FAILED" | Out-File -FilePath "${resultPath.replace(/\\/g, '\\\\')}" -Encoding UTF8 -Append
    exit 1
}
`;

    const vbsScript = `
Set objShell = CreateObject("Shell.Application")
objShell.ShellExecute "powershell.exe", "-NoProfile -ExecutionPolicy Bypass -File ""${psPath.replace(/\\/g, '\\\\')}""", "", "runas", 0
`;

    try {
      fs.writeFileSync(psPath, psScript, 'utf8');
      fs.writeFileSync(vbsPath, vbsScript, 'utf8');

      exec(`cscript //nologo "${vbsPath}"`, () => {
        setTimeout(() => {
          try { fs.unlinkSync(vbsPath); } catch (e) { }
          try { fs.unlinkSync(psPath); } catch (e) { }

          try {
            if (fs.existsSync(resultPath)) {
              const result = fs.readFileSync(resultPath, 'utf8').trim();
              try { fs.unlinkSync(resultPath); } catch (e) { }

              if (result.includes('ADMIN_OK') && result.includes('RESTART_OK')) {
                resolve({ success: true, message: 'Restarting to BIOS in 3 seconds...' });
              } else if (result.includes('ADMIN_FAILED')) {
                resolve({ success: false, error: 'Administrator privileges denied.', code: 'UAC_DENIED' });
              } else {
                resolve({ success: false, error: 'Restart command failed.', code: 'RESTART_FAILED' });
              }
            } else {
              resolve({ success: false, error: 'UAC cancelled.', code: 'UAC_CANCELLED' });
            }
          } catch (readError) {
            resolve({ success: false, error: 'Could not verify restart status: ' + readError.message });
          }
        }, 2000);
      });
    } catch (fileError) {
      try { fs.unlinkSync(vbsPath); } catch (e) { }
      try { fs.unlinkSync(psPath); } catch (e) { }
      try { fs.unlinkSync(resultPath); } catch (e) { }
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
      const existing = sparkleModule.findExistingSparkle();
      if (existing) {
        exeToRun = existing.path;
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

module.exports = {
  runSfcScan,
  runDismRepair,
  runTempCleanup,
  restartToBios,
  runSparkleDebloat,
  runChrisTitus
};
