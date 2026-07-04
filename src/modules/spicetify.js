/**
 * Spicetify Module
 * Handles Spicetify and Spotify-related operations
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { attachChildProcessHandlers } = require('./process-utils');

/**
 * Install Spicetify
 * @returns {{ child: ChildProcess, done: Promise<Object> }}
 */
function installSpicetify(onOutput = () => { }) {
  if (process.platform === 'win32') {
    const tmpScriptName = `spicetify_install_${Date.now()}.ps1`;
    const tmpScriptPath = path.join(os.tmpdir(), tmpScriptName);

    const psLines = [
      "$ErrorActionPreference = 'Stop'",
      "$ProgressPreference = 'SilentlyContinue'",
      "$tempCli = [System.IO.Path]::GetTempFileName() + '.ps1'",
      "Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/spicetify/cli/main/install.ps1' -OutFile $tempCli",
      "$lines = Get-Content $tempCli",
      "$skip = $false",
      "$filtered = @()",
      "foreach ($line in $lines) {",
      " if ($line -match '#region Marketplace') { $skip = $true; continue }",
      " if ($line -match '#endregion Marketplace') { $skip = $false; continue }",
      " if (-not $skip) { $filtered += $line }",
      "}",
      "$filtered | Set-Content $tempCli",
      "& $tempCli",
      "Remove-Item $tempCli -Force",
      "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/spicetify/marketplace/main/resources/install.ps1' | Invoke-Expression } catch {}",
      "spicetify -v",
      "spicetify backup apply"
    ];

    fs.writeFileSync(tmpScriptPath, psLines.join('\n'), 'utf8');

    const child = spawn('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpScriptPath
    ], { windowsHide: true });

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
        try { fs.unlinkSync(tmpScriptPath); } catch { }
        resolve(result);
      };
      child.on('error', (err) => settle({ success: false, error: err.message }));
      child.on('close', (code) => settle({ success: code === 0, code }));
    });

    return { child, done };
  }

  const shell = process.env.SHELL || '/bin/sh';
  const unixCmd = [
    'tmpfile=$(mktemp /tmp/spicetify_install.XXXXXX.sh)',
    'curl -fsSL https://raw.githubusercontent.com/spicetify/cli/main/install.sh -o "$tmpfile"',
    "sed -i '/Do you want to install spicetify Marketplace?/,/spicetify Marketplace installation script/d' \"$tmpfile\"",
    'sh "$tmpfile"',
    'rm -f "$tmpfile"',
    'curl -fsSL https://raw.githubusercontent.com/spicetify/marketplace/main/resources/install.sh | sh || true',
    'spicetify -v',
    'spicetify backup apply'
  ].join(' && ');

  const child = spawn(shell, ['-c', unixCmd]);

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
 * Uninstall Spicetify
 * @returns {Promise<Object>}
 */
async function uninstallSpicetify() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const psCmd = [
        'try { spicetify restore } catch { }',
        'Remove-Item -Recurse -Force "$env:APPDATA\\spicetify" -ErrorAction SilentlyContinue',
        'Remove-Item -Recurse -Force "$env:LOCALAPPDATA\\spicetify" -ErrorAction SilentlyContinue',
        'if ((Test-Path "$env:APPDATA\\spicetify") -or (Test-Path "$env:LOCALAPPDATA\\spicetify")) { exit 1 } else { exit 0 }'
      ].join(' ; ');
      
      const child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCmd], { windowsHide: true });
      attachChildProcessHandlers(child, resolve, 'Uninstall');
    } else {
      const shCmd = 'spicetify restore || true; rm -rf ~/.spicetify || true; rm -rf ~/.config/spicetify || true';
      const child = spawn('sh', ['-c', shCmd]);
      attachChildProcessHandlers(child, resolve, 'Uninstall');
    }
  });
}

/**
 * Full uninstall of Spotify and Spicetify
 * @returns {Promise<Object>}
 */
async function fullUninstallSpotify() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const psParts = [
        'try { Get-Process -Name "Spotify*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue } catch { }',
        'try { spicetify restore } catch { }',
        'try {',
        ' $upd = Join-Path $env:LOCALAPPDATA "Spotify\\Update";',
        ' if (Test-Path $upd) {',
        ' attrib -R -S -H $upd -Recurse -ErrorAction SilentlyContinue;',
        ' takeown /F "$upd" /A /R /D Y | Out-Null;',
        ' icacls "$upd" /grant "*S-1-5-32-544":(OI)(CI)F /T /C | Out-Null;',
        ' icacls "$upd" /grant "$env:USERNAME":(OI)(CI)F /T /C | Out-Null;',
        ' }',
        '} catch { }',
        'try { $roam = Join-Path $env:APPDATA "Spotify"; if (Test-Path $roam) { attrib -R -S -H $roam -Recurse -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $roam -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',
        'try { $loc = Join-Path $env:LOCALAPPDATA "Spotify"; if (Test-Path $loc) { attrib -R -S -H $loc -Recurse -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $loc -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',
        'try { if (Test-Path "HKCU:\\Software\\Spotify") { Remove-Item "HKCU:\\Software\\Spotify" -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',
        'try { Remove-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" -Name "Spotify" -ErrorAction SilentlyContinue } catch { }',
        'try { if (Test-Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Spotify") { Remove-Item "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Spotify" -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',
        'try { Get-ChildItem "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall" -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -like "Spotify*" } | ForEach-Object { Remove-Item $_.PsPath -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',
        'try { if (Test-Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Spotify") { Remove-Item "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Spotify" -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',
        'try { Get-ChildItem "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall" -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -like "Spotify*" } | ForEach-Object { Remove-Item $_.PsPath -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',
        'try { Remove-Item "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Spotify.lnk" -Force -ErrorAction SilentlyContinue } catch { }',
        'try { Remove-Item "$env:PROGRAMDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Spotify.lnk" -Force -ErrorAction SilentlyContinue } catch { }',
        'try { Remove-Item "$env:PUBLIC\\Desktop\\Spotify.lnk" -Force -ErrorAction SilentlyContinue } catch { }',
        '$global:LASTEXITCODE = 0',
        'exit 0'
      ];
      
      const psCmd = psParts.join(' ; ');
      const child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCmd], { windowsHide: true });
      attachChildProcessHandlers(child, resolve, 'Full uninstall');
    } else {
      const shellParts = [
        'pkill -f spotify || true',
        'spicetify restore || true',
        'rm -rf ~/.config/spotify || true',
        'rm -rf ~/.cache/spotify || true',
        'rm -rf ~/.var/app/com.spotify.Client || true',
        'rm -rf ~/.local/share/spotify || true',
        'rm -rf ~/.spicetify || true',
        'rm -rf ~/.config/spicetify || true'
      ];
      
      const shCmd = shellParts.join('; ');
      const child = spawn('sh', ['-c', shCmd]);
      attachChildProcessHandlers(child, resolve, 'Full uninstall');
    }
  });
}

module.exports = {
  installSpicetify,
  uninstallSpicetify,
  fullUninstallSpotify
};
