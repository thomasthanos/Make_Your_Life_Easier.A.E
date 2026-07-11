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

module.exports = {
  runSpawnCommand,
  runStreamingCommand,
  attachChildProcessHandlers,
  getPowerShellExe
};
