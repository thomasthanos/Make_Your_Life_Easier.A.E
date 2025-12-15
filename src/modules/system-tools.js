/**
 * System Tools Module
 * Windows system maintenance tools (SFC, DISM, Temp cleanup, etc.)
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runElevatedPowerShellScript, runElevatedPowerShellScriptHidden, getPowerShellExe, runSpawnCommand, attachChildProcessHandlers, stripAnsiCodes } = require('./process-utils');
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

# NOTE: Do NOT use 'exit' here! The wrapper script needs to write SUCCESS marker.
# The wrapper will handle the exit code.
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
      fs.unlinkSync(logFile); // Clean up log file
      result.details = logContent;

      // If there were errors, mark as warning but keep success = true
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
 * Requests admin permissions first, then restarts to BIOS
 * @returns {Promise<Object>}
 */
async function restartToBios() {
  return new Promise((resolve) => {
    const tempDir = os.tmpdir();
    const psPath = path.join(tempDir, `bios_restart_${Date.now()}.ps1`);
    const vbsPath = path.join(tempDir, `bios_elevate_${Date.now()}.vbs`);
    const resultPath = path.join(tempDir, `bios_result_${Date.now()}.txt`);

    // PowerShell script that checks admin rights and performs restart
    const psScript = `
# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    "ADMIN_FAILED" | Out-File -FilePath "${resultPath.replace(/\\/g, '\\\\')}" -Encoding UTF8
    exit 1
}

# Write success marker
"ADMIN_OK" | Out-File -FilePath "${resultPath.replace(/\\/g, '\\\\')}" -Encoding UTF8

# Perform BIOS restart
try {
    shutdown /r /fw /t 3
    "RESTART_OK" | Out-File -FilePath "${resultPath.replace(/\\/g, '\\\\')}" -Encoding UTF8 -Append
    exit 0
} catch {
    "RESTART_FAILED" | Out-File -FilePath "${resultPath.replace(/\\/g, '\\\\')}" -Encoding UTF8 -Append
    exit 1
}
`;

    // VBS script to request elevation via UAC
    const vbsScript = `
Set objShell = CreateObject("Shell.Application")
objShell.ShellExecute "powershell.exe", "-NoProfile -ExecutionPolicy Bypass -File ""${psPath.replace(/\\/g, '\\\\')}""", "", "runas", 0
`;

    try {
      // Write PowerShell script
      fs.writeFileSync(psPath, psScript, 'utf8');
      // Write VBS script
      fs.writeFileSync(vbsPath, vbsScript, 'utf8');

      // Execute VBS which will show UAC prompt
      exec(`cscript //nologo "${vbsPath}"`, (error) => {
        // Wait a bit for the elevated PowerShell to complete
        setTimeout(() => {
          // Cleanup temp files
          try { fs.unlinkSync(vbsPath); } catch (e) { debug('warn', 'Failed to cleanup vbs file:', e.message); }
          try { fs.unlinkSync(psPath); } catch (e) { debug('warn', 'Failed to cleanup ps file:', e.message); }

          try {
            if (fs.existsSync(resultPath)) {
              const result = fs.readFileSync(resultPath, 'utf8').trim();
              try { fs.unlinkSync(resultPath); } catch (e) { debug('warn', 'Failed to cleanup result file:', e.message); }

              if (result.includes('ADMIN_OK') && result.includes('RESTART_OK')) {
                resolve({
                  success: true,
                  message: 'Restarting to BIOS in 3 seconds...'
                });
              } else if (result.includes('ADMIN_FAILED')) {
                resolve({
                  success: false,
                  error: 'Administrator privileges denied. Please accept the UAC prompt.',
                  code: 'UAC_DENIED'
                });
              } else {
                resolve({
                  success: false,
                  error: 'Restart command failed. Your system may not support UEFI firmware access.',
                  code: 'RESTART_FAILED'
                });
              }
            } else {
              // No result file means UAC was cancelled or error occurred
              resolve({
                success: false,
                error: 'Administrator privileges required. Please accept the UAC prompt to restart to BIOS.',
                code: 'UAC_CANCELLED'
              });
            }
          } catch (readError) {
            resolve({
              success: false,
              error: 'Could not verify restart status: ' + readError.message
            });
          }
        }, 2000); // Wait 2 seconds for elevated script to complete
      });
    } catch (fileError) {
      // Cleanup on error
      try { fs.unlinkSync(vbsPath); } catch (e) { /* Cleanup failed, ignore */ }
      try { fs.unlinkSync(psPath); } catch (e) { /* Cleanup failed, ignore */ }
      try { fs.unlinkSync(resultPath); } catch (e) { /* Cleanup failed, ignore */ }

      resolve({
        success: false,
        error: 'Failed to create elevation script: ' + fileError.message
      });
    }
  });
}

/**
 * Run Raphi debloat script
 * @returns {Promise<Object>}
 */
async function runRaphiDebloat() {
  if (process.platform !== 'win32') {
    return { success: false, error: 'Debloat is only supported on Windows.' };
  }

  const psExe = getPowerShellExe() || 'powershell.exe';
  const scriptCmd = '& ([scriptblock]::Create((irm "https://debloat.raphi.re/")))';

  return new Promise((resolve) => {
    const escapedCmd = scriptCmd.replace(/"/g, '\\"');
    const argList = `-NoProfile -ExecutionPolicy Bypass -Command \"${escapedCmd}\"`;
    const psCommand = `Start-Process -FilePath \"${psExe}\" -ArgumentList '${argList}' -Verb RunAs -WindowStyle Normal -Wait`;

    const child = spawn(psExe, ['-Command', psCommand], { windowsHide: false });
    let stderrData = '';

    child.stderr.on('data', (buf) => { stderrData += buf.toString(); });

    child.on('error', (err) => {
      resolve({ success: false, error: 'Failed to launch PowerShell: ' + err.message });
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ success: true, message: 'Debloat script executed successfully. A restart may be required.' });
      } else {
        const msg = stderrData.trim() || 'Debloat script failed or was cancelled.';
        resolve({ success: false, error: msg });
      }
    });
  });
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
  runRaphiDebloat,
  runChrisTitus
};
