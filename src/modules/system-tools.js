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
 * @returns {Promise<Object>}
 */
async function restartToBios() {
  return new Promise((resolve) => {
    const tempDir = os.tmpdir();
    const vbsPath = path.join(tempDir, 'bios_restart.vbs');

    const vbsContent = [
      'Set UAC = CreateObject("Shell.Application")',
      'UAC.ShellExecute "cmd.exe", "/c shutdown /r /fw /t 0", "", "runas", 1'
    ].join('\r\n');

    try {
      fs.writeFileSync(vbsPath, vbsContent);
      exec(`cscript //nologo "${vbsPath}"`, (error) => {
        try { fs.unlinkSync(vbsPath); } catch { }

        if (error) {
          resolve({
            success: false,
            error: 'Administrator privileges required. Please run as Administrator.',
            code: 'ADMIN_REQUIRED'
          });
        } else {
          resolve({
            success: true,
            message: 'UAC prompt appeared. Grant permissions to restart to BIOS.'
          });
        }
      });
    } catch (fileError) {
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
