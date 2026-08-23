/**
 * Process Utilities Module
 * Provides helpers for executing commands and child processes
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Strip ANSI escape codes from a string
 * @param {string} str - The string to clean
 * @returns {string} - The cleaned string
 */
function stripAnsiCodes(str) {
  return str.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
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
      // Timeout: winget commands should finish within 10 minutes.
      // This prevents indefinite hangs caused by slow msstore source lookups.
      const TIMEOUT_MS = options._timeout || 10 * 60 * 1000;
      const child = spawn(cmd, args, options);
      let stdout = '';
      let stderr = '';
      let settled = false;
      const MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10 MB cap per stream

      const settle = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutHandle);
        resolve(result);
      };

      const timeoutHandle = setTimeout(() => {
        try { child.kill(); } catch { }
        settle({ error: `Command timed out after ${TIMEOUT_MS / 1000}s`, stdout, stderr });
      }, TIMEOUT_MS);

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          if (stdout.length < MAX_OUTPUT_SIZE) {
            stdout += data.toString();
            if (stdout.length > MAX_OUTPUT_SIZE) stdout = stdout.slice(0, MAX_OUTPUT_SIZE);
          }
        });
      }
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          if (stderr.length < MAX_OUTPUT_SIZE) {
            stderr += data.toString();
            if (stderr.length > MAX_OUTPUT_SIZE) stderr = stderr.slice(0, MAX_OUTPUT_SIZE);
          }
        });
      }

      child.on('error', (err) => {
        settle({ error: err.message, stdout, stderr });
      });

      child.on('close', (code) => {
        if (code === 0) {
          settle({ stdout, stderr });
        } else {
          settle({ error: `Command exited with code ${code}`, stdout, stderr });
        }
      });
    } catch (err) {
      resolve({ error: err.message });
    }
  });
}

/**
 * Execute a command via spawn, streaming stdout/stderr chunks to a callback
 * @param {string} cmd - The command to run
 * @param {string[]} args - Command arguments
 * @param {Object} options - Spawn options
 * @param {Function} onOutput - Called with (stream, text) for every chunk
 * @returns {{child: ChildProcess, done: Promise<{success: boolean, code?: number, error?: string}>}}
 */
function runStreamingCommand(cmd, args = [], options = {}, onOutput = () => { }) {
  const child = spawn(cmd, args, options);

  if (child.stdout) {
    child.stdout.on('data', (data) => onOutput('stdout', data.toString()));
  }
  if (child.stderr) {
    child.stderr.on('data', (data) => onOutput('stderr', data.toString()));
  }

  const done = new Promise((resolve) => {
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    child.on('error', (err) => settle({ success: false, error: err.message }));
    child.on('close', (code) => settle({ success: code === 0, code }));
  });

  return { child, done };
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
 * Build the `-ArgumentList` value for launching a .ps1 through Start-Process.
 *
 * Start-Process joins an `-ArgumentList` *array* with plain spaces and adds no
 * quoting of its own, so an element holding a path with a space reaches the child
 * as two separate arguments. `powershell.exe -File` accepts exactly one token, so
 * the script never runs and the process exits -196608. Every script here is
 * written under %TEMP%, which contains a space for any account whose user name
 * does ("C:\Users\John Doe\AppData\Local\Temp"), so the array form breaks these
 * tasks outright for a large share of users. Passing a single pre-quoted string
 * puts the quoting under our control instead.
 *
 * (`-Command` happens to survive the array form because it swallows every
 * remaining argument, which is why only the `-File` launches are affected.)
 * @param {string} scriptPath - Path to the .ps1 to run
 * @param {string[]} extraSwitches - powershell.exe switches to place before -File
 * @returns {string} A PowerShell single-quoted literal ready to follow -ArgumentList
 */
function psFileArgumentList(scriptPath, extraSwitches = []) {
  const switches = ['-NoProfile', '-ExecutionPolicy', 'Bypass', ...extraSwitches, '-File'].join(' ');
  // Outer single quotes make it one PowerShell string; the inner double quotes
  // keep the path together once Start-Process hands it to the child. Windows
  // paths cannot contain a double quote, so only ' needs escaping.
  return `'${switches} "${String(scriptPath).replace(/'/g, "''")}"'`;
}

/**
 * Ask Windows what it thinks of an executable's Authenticode signature.
 *
 * Returns the raw status string (`Valid`, `NotSigned`, `HashMismatch`,
 * `NotTrusted`, …) or null when the check could not be performed at all. The
 * caller decides what to do with it: most of what this app downloads is
 * unsigned, so `NotSigned` is normal and must not block — `HashMismatch` is the
 * one that means the file was altered after it was signed.
 * @param {string} filePath - Absolute path to the file to inspect
 * @returns {Promise<string|null>} Signature status, or null if unavailable
 */
function getAuthenticodeStatus(filePath) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve(null);

    const psExe = getPowerShellExe() || 'powershell.exe';
    // -LiteralPath so nothing in the name is treated as a wildcard, and the path
    // inside a single-quoted PowerShell string with its own quotes doubled.
    const escaped = String(filePath).replace(/'/g, "''");
    const script = `(Get-AuthenticodeSignature -LiteralPath '${escaped}').Status.ToString()`;
    const child = spawn(psExe, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true });

    let out = '';
    const timer = setTimeout(() => { try { child.kill(); } catch { } resolve(null); }, 15000);

    if (child.stdout) child.stdout.on('data', (d) => { out += d.toString(); });
    child.on('error', () => { clearTimeout(timer); resolve(null); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const status = out.trim();
      resolve(code === 0 && status ? status : null);
    });
  });
}

module.exports = {
  runSpawnCommand,
  getAuthenticodeStatus,
  runStreamingCommand,
  attachChildProcessHandlers,
  getPowerShellExe,
  psFileArgumentList
};
