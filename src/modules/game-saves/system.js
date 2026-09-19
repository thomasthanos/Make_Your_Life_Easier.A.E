/**
 * What only the registry knows, plus registry export and import.
 *
 * One PowerShell run answers everything a scan needs from the registry. reg.exe
 * would be a process per question, and it prints in the OEM code page, which
 * turns a Documents folder redirected to `OneDrive\Έγγραφα` into mojibake.
 * PowerShell is told to use UTF-8 in both directions instead.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const { getPowerShellExe, runSpawnCommand } = require('../process-utils');
const { asArray } = require('./launchers');

const UTF8_PREAMBLE = [
  '[Console]::InputEncoding = [System.Text.Encoding]::UTF8',
  '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
  "$ErrorActionPreference = 'SilentlyContinue'",
  "$ProgressPreference = 'SilentlyContinue'"
].join('\n');

const PROBE_SCRIPT = `
function Get-Value($path, $name) {
  try { return (Get-ItemProperty -LiteralPath $path -Name $name -ErrorAction Stop).$name } catch { return $null }
}
$gog = @()
foreach ($root in @('HKLM:\\SOFTWARE\\WOW6432Node\\GOG.com\\Games', 'HKLM:\\SOFTWARE\\GOG.com\\Games')) {
  foreach ($key in @(Get-ChildItem -LiteralPath $root)) {
    $item = Get-ItemProperty -LiteralPath $key.PSPath
    $gog += [pscustomobject]@{ id = [string]$item.gameID; name = [string]$item.gameName; path = [string]$item.path }
  }
}
[pscustomobject]@{
  documents = [Environment]::GetFolderPath('MyDocuments')
  steam = Get-Value 'HKCU:\\Software\\Valve\\Steam' 'SteamPath'
  ubisoft = Get-Value 'HKLM:\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher' 'InstallDir'
  gog = @($gog)
  hkcuSoftware = @(Get-ChildItem -LiteralPath 'HKCU:\\Software' | ForEach-Object { $_.PSChildName })
} | ConvertTo-Json -Depth 4 -Compress
`;

// The keys arrive wrapped in an object: Windows PowerShell's ConvertFrom-Json
// emits a top-level array as one pipeline item, so a bare array would be
// tested as a single key named "System.Object[]".
const KEYS_SCRIPT = `
$data = [Console]::In.ReadToEnd() | ConvertFrom-Json
$found = @(foreach ($key in @($data.keys)) { if (Test-Path -LiteralPath ('Registry::' + $key)) { $key } })
ConvertTo-Json -InputObject $found -Compress
`;

/**
 * Run a script with UTF-8 input and output.
 * @param {string} script - PowerShell source
 * @param {{input?: string, timeoutMs?: number, spawnImpl?: Function}} [options]
 * @returns {Promise<{stdout: string, error?: string}>}
 */
function runPowerShell(script, { input = '', timeoutMs = 60000, spawnImpl = spawn } = {}) {
  return new Promise((resolve) => {
    const chunks = [];
    let settled = false;
    let timer = null;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const stdout = Buffer.concat(chunks).toString('utf8');
      resolve(error ? { stdout, error } : { stdout });
    };

    let child;
    try {
      const encoded = Buffer.from(`${UTF8_PREAMBLE}\n${script}`, 'utf16le').toString('base64');
      child = spawnImpl(getPowerShellExe() || 'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
        { windowsHide: true });
    } catch (err) {
      finish(err.message);
      return;
    }

    timer = setTimeout(() => {
      try { child.kill(); } catch { /* already exited */ }
      finish('PowerShell timed out');
    }, timeoutMs);
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.on('error', (err) => finish(err.message));
    child.on('close', (code) => finish(code === 0 ? null : `PowerShell exited with code ${code}`));
    child.stdin.on('error', () => { /* the script may not read its input */ });
    child.stdin.end(input, 'utf8');
  });
}

function parseJsonOutput(stdout) {
  try {
    return JSON.parse(String(stdout || '').replace(/^\ufeff/, '').trim());
  } catch {
    return null;
  }
}

/**
 * Documents folder, launcher locations, GOG installs and the names under
 * HKCU\Software, in one PowerShell run.
 * @returns {Promise<{documents: string, steam: string, ubisoft: string, gog: Array, hkcuSoftware: string[]}>}
 */
async function probeSystem(options) {
  const data = parseJsonOutput((await runPowerShell(PROBE_SCRIPT, options)).stdout) || {};
  const text = (value) => (typeof value === 'string' ? value : '');
  return {
    documents: text(data.documents),
    steam: text(data.steam),
    ubisoft: text(data.ubisoft),
    gog: asArray(data.gog),
    hkcuSoftware: asArray(data.hkcuSoftware).filter((name) => typeof name === 'string')
  };
}

/**
 * Which of the given registry keys exist.
 * @param {string[]} keys - Keys such as `HKEY_CURRENT_USER\Software\Vendor\Game`
 * @returns {Promise<Set<string>>} Existing keys, lower-cased
 */
async function findExistingRegistryKeys(keys, options) {
  const unique = [...new Set(keys)];
  if (unique.length === 0) return new Set();
  const result = await runPowerShell(KEYS_SCRIPT, { ...options, input: JSON.stringify({ keys: unique }) });
  return new Set(asArray(parseJsonOutput(result.stdout))
    .filter((key) => typeof key === 'string')
    .map((key) => key.toLowerCase()));
}

async function exportRegistryKey(key, file) {
  const result = await runSpawnCommand('reg', ['export', key, file, '/y'], { windowsHide: true, _timeout: 60000 });
  return result.error ? { success: false, error: String(result.stderr || result.error).trim() } : { success: true };
}

async function importRegistryFile(file) {
  const result = await runSpawnCommand('reg', ['import', file], { windowsHide: true, _timeout: 60000 });
  return result.error ? { success: false, error: String(result.stderr || result.error).trim() } : { success: true };
}

/**
 * Every key a .reg file writes to or deletes.
 * @param {string} file - A file produced by `reg export`
 * @returns {string[]|null} Keys, or null when the file is not a registry export
 */
function readRegistryFileKeys(file, fsImpl = fs) {
  const buffer = fsImpl.readFileSync(file);
  const text = buffer[0] === 0xff && buffer[1] === 0xfe
    ? buffer.subarray(2).toString('utf16le')
    : buffer.toString('utf8').replace(/^\ufeff/, '');
  const lines = text.split(/\r?\n/);
  if (!/^(Windows Registry Editor Version 5\.00|REGEDIT4)\s*$/.test(lines[0] || '')) return null;
  const keys = [];
  for (const line of lines) {
    const match = /^\[-?([^\]]+)\]\s*$/.exec(line);
    if (match) keys.push(match[1]);
  }
  return keys;
}

const registry = {
  exportKey: exportRegistryKey,
  importFile: importRegistryFile,
  readFileKeys: readRegistryFileKeys
};

module.exports = {
  findExistingRegistryKeys,
  probeSystem,
  readRegistryFileKeys,
  registry,
  runPowerShell
};
