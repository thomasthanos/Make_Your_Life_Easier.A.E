/**
 * Process Utilities Module
 * Provides helpers for executing commands and child processes
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

/**
 * Strip ANSI escape codes from a string
 * @param {string} str - The string to clean
 * @returns {string} - The cleaned string
 */
function stripAnsiCodes(str) {
  return str.replace(/\u001b\[[0-?]*[ -\/]*[@-~]/g, '');
}

/**
 * Execute a command via spawn and capture its stdout/stderr
 * @param {string} cmd - The command to run
 * @param {string[]} args - Command arguments
 * @param {Object} options - Spawn options
 * @returns {Promise<{stdout?: string, stderr?: string, error?: string}>}
 */
function runSpawnCommand(cmd, args = [], options = {}) {
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, options);
      let stdout = '';
      let stderr = '';
      
      if (child.stdout) {
        child.stdout.on('data', (data) => { stdout += data.toString(); });
      }
      if (child.stderr) {
        child.stderr.on('data', (data) => { stderr += data.toString(); });
      }
      
      child.on('error', (err) => {
        resolve({ error: err.message, stdout, stderr });
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          resolve({ error: `Command exited with code ${code}`, stdout, stderr });
        }
      });
    } catch (err) {
      resolve({ error: err.message });
    }
  });
}

/**
 * Attach standard output handlers to a child process and resolve when it exits
 * @param {ChildProcess} child - The spawned child process
 * @param {Function} resolve - The promise resolver from the caller
 * @param {string} errorPrefix - The prefix for the error message on failure
 * @param {Function} outputTransform - Function to transform the raw output
 */
function attachChildProcessHandlers(child, resolve, errorPrefix, outputTransform = stripAnsiCodes) {
  let stdout = '';
  let stderr = '';
  
  if (child.stdout) {
    child.stdout.on('data', (data) => { stdout += data.toString(); });
  }
  if (child.stderr) {
    child.stderr.on('data', (data) => { stderr += data.toString(); });
  }
  
  child.on('error', (err) => {
    const output = outputTransform(stdout + stderr);
    resolve({ success: false, error: err.message, output });
  });
  
  child.on('close', (code) => {
    const output = outputTransform(stdout + stderr);
    if (code === 0) {
      resolve({ success: true, output });
    } else {
      resolve({ success: false, error: `${errorPrefix} exited with code ${code}`, output });
    }
  });
}

/**
 * Determine the appropriate PowerShell executable to use on Windows
 * @returns {string|null} - The path to PowerShell or null on non-Windows
 */
function getPowerShellExe() {
  if (process.platform !== 'win32') return null;
  
  try {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows';
    const pwsh64 = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    if (fs.existsSync(pwsh64)) {
      return pwsh64;
    }
  } catch {
    // Ignore fs errors and fall back to default
  }
  
  return 'powershell.exe';
}

/**
 * Run a PowerShell script with elevation and wait for it to finish
 * @param {string} psScript - The PowerShell script contents
 * @param {string} successMessage - Message returned on success
 * @param {string} failureMessage - Message returned on failure
 * @returns {Promise<Object>} - Result object with success/error
 */
function runElevatedPowerShellScript(psScript, successMessage, failureMessage) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ success: false, error: 'This feature is only available on Windows' });
      return;
    }
    
    let psFile;
    try {
      psFile = path.join(os.tmpdir(), `${Date.now()}_elevated.ps1`);
      fs.writeFileSync(psFile, psScript, 'utf8');
      
      const escapedPsFile = psFile.replace(/"/g, '\\"');
      const psCommand = `Start-Process -FilePath "powershell.exe" -ArgumentList '-ExecutionPolicy Bypass -File "${escapedPsFile}"' -Verb RunAs -WindowStyle Normal -Wait`;
      
      const child = spawn('powershell.exe', ['-Command', psCommand], { windowsHide: true });
      
      child.on('error', () => {
        try { if (psFile && fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch { }
        resolve({ 
          success: false, 
          error: 'Administrator privileges required. Please accept the UAC prompt.', 
          code: 'UAC_DENIED' 
        });
      });
      
      child.on('exit', (code) => {
        try { if (psFile && fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch { }
        if (code === 0) {
          resolve({ success: true, message: successMessage });
        } else {
          resolve({ success: false, error: failureMessage, code: 'PROCESS_FAILED' });
        }
      });
    } catch (error) {
      try { if (psFile && fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch { }
      resolve({ success: false, error: 'Failed to start process: ' + error.message });
    }
  });
}

/**
 * Run an elevated PowerShell script in a hidden window
 * @param {string} psScript - The PowerShell script contents
 * @param {string} successMessage - Message returned on success
 * @param {string} failureMessage - Message returned on failure
 * @returns {Promise<Object>} - Result object with success/error
 */
function runElevatedPowerShellScriptHidden(psScript, successMessage, failureMessage) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ success: false, error: 'This feature is only available on Windows' });
      return;
    }
    
    let psFile;
    try {
      psFile = path.join(os.tmpdir(), `${Date.now()}_elevated.ps1`);
      fs.writeFileSync(psFile, psScript, 'utf8');
      
      const escapedPsFile = psFile.replace(/"/g, '\\"');
      const psCommand = `Start-Process -FilePath "powershell.exe" -ArgumentList '-ExecutionPolicy Bypass -File "${escapedPsFile}"' -Verb RunAs -WindowStyle Hidden -Wait`;
      
      const child = spawn('powershell.exe', ['-Command', psCommand], { windowsHide: true });
      
      child.on('error', () => {
        try { if (psFile && fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch { }
        resolve({ 
          success: false, 
          error: 'Administrator privileges required. Please accept the UAC prompt.', 
          code: 'UAC_DENIED' 
        });
      });
      
      child.on('exit', (code) => {
        try { if (psFile && fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch { }
        if (code === 0) {
          resolve({ success: true, message: successMessage });
        } else {
          resolve({ success: false, error: failureMessage, code: 'PROCESS_FAILED' });
        }
      });
    } catch (error) {
      try { if (psFile && fs.existsSync(psFile)) fs.unlinkSync(psFile); } catch { }
      resolve({ success: false, error: 'Failed to start process: ' + error.message });
    }
  });
}

module.exports = {
  stripAnsiCodes,
  runSpawnCommand,
  attachChildProcessHandlers,
  getPowerShellExe,
  runElevatedPowerShellScript,
  runElevatedPowerShellScriptHidden
};
