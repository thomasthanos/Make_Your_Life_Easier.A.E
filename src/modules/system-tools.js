/**
 * System Tools Module
 * Windows system maintenance tools (SFC, DISM, Temp cleanup, etc.)
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runElevatedPowerShellScript, runElevatedPowerShellScriptHidden, getPowerShellExe, runSpawnCommand, attachChildProcessHandlers, stripAnsiCodes } = require('./process-utils');

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

  const psScript = `
Write-Host "=== TEMPORARY FILES CLEANUP ===" -ForegroundColor Cyan
Write-Host "Running with Administrator privileges..." -ForegroundColor Green
Write-Host ""

# 1. Clean Recent files
Write-Host "1. Cleaning Recent files..." -ForegroundColor Yellow
if (Test-Path "$env:USERPROFILE\\Recent") {
    Get-ChildItem "$env:USERPROFILE\\Recent\\*.*" -Force -ErrorAction SilentlyContinue | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
    Write-Host "   ✓ Recent files cleaned" -ForegroundColor Green
} else {
    Write-Host "   ! Recent folder not found" -ForegroundColor Red
}

# 2. Clean Prefetch
Write-Host "2. Cleaning Prefetch..." -ForegroundColor Yellow
if (Test-Path "C:\\Windows\\Prefetch") {
    Get-ChildItem "C:\\Windows\\Prefetch\\*.*" -Force -ErrorAction SilentlyContinue | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
    Write-Host "   ✓ Prefetch cleaned" -ForegroundColor Green
} else {
    Write-Host "   ! Prefetch folder not found" -ForegroundColor Red
}

# 3. Clean Windows Temp
Write-Host "3. Cleaning Windows Temp..." -ForegroundColor Yellow
if (Test-Path "C:\\Windows\\Temp") {
    Get-ChildItem "C:\\Windows\\Temp\\*.*" -Force -ErrorAction SilentlyContinue | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
    Write-Host "   ✓ Windows Temp cleaned" -ForegroundColor Green
} else {
    Write-Host "   ! Windows Temp folder not found" -ForegroundColor Red
}

# 4. Clean User Temp
Write-Host "4. Cleaning User Temp..." -ForegroundColor Yellow
if (Test-Path "$env:USERPROFILE\\AppData\\Local\\Temp") {
    Get-ChildItem "$env:USERPROFILE\\AppData\\Local\\Temp\\*.*" -Force -ErrorAction SilentlyContinue | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
    Write-Host "   ✓ User Temp cleaned" -ForegroundColor Green
} else {
    Write-Host "   ! User Temp folder not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== CLEANUP COMPLETED ===" -ForegroundColor Cyan
Write-Host "All temporary files have been cleaned successfully!" -ForegroundColor Green
Write-Host ""
`;

  return runElevatedPowerShellScriptHidden(
    psScript,
    '✅ Temporary files cleanup completed successfully!',
    'Administrator privileges required or cleanup failed. Please accept the UAC prompt and try again.'
  );
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
          try { fs.unlinkSync(vbsPath); } catch { }
          try { fs.unlinkSync(psPath); } catch { }

          // Check result
          try {
            if (fs.existsSync(resultPath)) {
              const result = fs.readFileSync(resultPath, 'utf8').trim();
              try { fs.unlinkSync(resultPath); } catch { }

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
      try { fs.unlinkSync(vbsPath); } catch { }
      try { fs.unlinkSync(psPath); } catch { }
      try { fs.unlinkSync(resultPath); } catch { }
      
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
