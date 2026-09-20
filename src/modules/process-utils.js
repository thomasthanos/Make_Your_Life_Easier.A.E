
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function stripAnsiCodes(str) {
  return str.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
}

function runSpawnCommand(cmd, args = [], options = {}) {
  return new Promise((resolve) => {
    try {
      const TIMEOUT_MS = options._timeout || 10 * 60 * 1000;
      const child = spawn(cmd, args, options);
      let stdout = '';
      let stderr = '';
      let settled = false;
      const MAX_OUTPUT_SIZE = 10 * 1024 * 1024;

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

function getPowerShellExe() {
  if (process.platform !== 'win32') return null;

  try {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows';
    const pwsh64 = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    if (fs.existsSync(pwsh64)) {
      return pwsh64;
    }
  } catch {
  }

  return 'powershell.exe';
}

function windowsPowerShellEnv(env = process.env) {
  const clean = { ...env };
  for (const key of Object.keys(clean)) {
    if (key.toLowerCase() === 'psmodulepath') delete clean[key];
  }
  return clean;
}

function psFileArgumentList(scriptPath, extraSwitches = []) {
  const switches = ['-NoProfile', '-ExecutionPolicy', 'Bypass', ...extraSwitches, '-File'].join(' ');
  return `'${switches} "${String(scriptPath).replace(/'/g, "''")}"'`;
}

function getAuthenticodeStatus(filePath) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve(null);

    const psExe = getPowerShellExe() || 'powershell.exe';
    const escaped = String(filePath).replace(/'/g, "''");
    const script = `(Get-AuthenticodeSignature -LiteralPath '${escaped}').Status.ToString()`;
    const child = spawn(psExe, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, env: windowsPowerShellEnv() });

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
  windowsPowerShellEnv,
  psFileArgumentList
};
