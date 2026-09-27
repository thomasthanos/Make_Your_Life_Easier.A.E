<#
.SYNOPSIS
  Installs, updates and uninstalls a built setup silently, and checks what
  each step leaves on disk and in the registry. CI runs it on every change.

.EXAMPLE
  ./scripts/smoke-test-setup.ps1 -Setup backend/target/release/bundle/setup/MakeYourLifeEasier_7.0.1_x64-setup.exe
#>
param([Parameter(Mandatory = $true)][string]$Setup)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$config = Get-Content (Join-Path $root "backend/tauri.conf.json") -Raw | ConvertFrom-Json
$version = (Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json).version
$binary = $config.mainBinaryName
$uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$binary"
# RUNNER_TEMP on CI; %TEMP% may be spelled with 8.3 short names elsewhere.
$base = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }
$dir = Join-Path $base "myle-setup-smoke-test\$binary"

function Assert([bool]$Condition, [string]$What) {
  if (-not $Condition) { throw "FAILED: $What" }
  Write-Host "ok  $What"
}

function Invoke-Silently([string]$Program, [string[]]$Arguments) {
  $process = Start-Process -FilePath $Program -ArgumentList $Arguments -Wait -PassThru
  return $process.ExitCode
}

if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }

# Install
Assert ((Invoke-Silently $Setup @("/S", "/D=$dir")) -eq 0) "silent install exits 0"
foreach ($file in @("$binary.exe", "uninstall.exe", "install.json")) {
  Assert (Test-Path (Join-Path $dir $file)) "installed $file"
}
foreach ($resource in $config.bundle.resources.PSObject.Properties) {
  Assert (Test-Path (Join-Path $dir $resource.Value)) "installed $($resource.Value)"
}
$entry = Get-ItemProperty $uninstallKey
Assert ($entry.DisplayVersion -eq $version) "Installed apps lists version $version"
Assert ($entry.UninstallString -like "*uninstall.exe*") "Installed apps knows the uninstaller"
Assert ($entry.QuietUninstallString -like "*/S") "Installed apps has a quiet uninstall"
$startMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "$($config.productName).lnk"
Assert (Test-Path $startMenu) "Start menu shortcut created"
$link = (New-Object -ComObject WScript.Shell).CreateShortcut($startMenu)
Assert ($link.TargetPath -ieq (Join-Path $dir "$binary.exe")) "shortcut opens the installed app"

# Update over it, as the in-app updater does (without relaunching)
Assert ((Invoke-Silently $Setup @("/S", "/UPDATE")) -eq 0) "silent update exits 0"
Assert (-not (Get-ChildItem $dir -Recurse -Filter "*.myle-*")) "no leftovers from the update"
Assert (Test-Path $startMenu) "an update keeps the shortcut"

# Uninstall
Assert ((Invoke-Silently (Join-Path $dir "uninstall.exe") @("/S")) -eq 0) "silent uninstall exits 0"
Assert (-not (Test-Path $uninstallKey)) "Installed apps entry removed"
Assert (-not (Test-Path $startMenu)) "Start menu shortcut removed"
# The uninstaller runs from a copy in %TEMP%, which removes the original
# and the folder once the original has exited.
$deadline = (Get-Date).AddSeconds(30)
while ((Test-Path $dir) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
if (Test-Path $dir) {
  $left = Get-ChildItem $dir -Recurse -Force | ForEach-Object { $_.FullName.Substring($dir.Length) }
  Write-Host "Still in the install folder: $($left -join ', ')"
  Get-Process | Where-Object { $_.Path -like "*$binary*" -or $_.Path -like "*uninstall*" } |
    ForEach-Object { Write-Host "Running: $($_.Id) $($_.Path)" }
}
Assert (-not (Test-Path $dir)) "install folder removed"
Write-Host "Setup smoke test passed."
