<#
.SYNOPSIS
  Builds the ready-to-ship setup: the app, its uninstaller, and the setup
  that carries both (backend/installer).

.DESCRIPTION
  1. the app's release exe (Tauri, no bundle) and the pinned Game Saves files
  2. the setup window's page and uninstall.exe
  3. the install folder, staged exactly as it lands on a PC
     (bundle.resources in backend/tauri.conf.json says where each file goes)
  4. that folder packed into one XZ payload, then setup.exe built around it

  Output: backend/target/release/bundle/setup/<mainBinaryName>.exe (MakeYourLifeEasier.exe).
  release.yml gives the published copy its versioned name.

  The app, the uninstaller and the setup are signed when MYLE_SIGN_PFX is set
  (release.yml sets it from the certificate secrets); see scripts/sign.ps1.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$tauriDir = Join-Path $root "backend"
$manifest = Join-Path $tauriDir "Cargo.toml"
$release = Join-Path $tauriDir "target\release"

function Invoke-Step([string]$Title, [scriptblock]$Command) {
  Write-Host "==> $Title"
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "$Title failed (exit code $LASTEXITCODE)" }
}

function Set-Signature([string]$Path) {
  if ($env:MYLE_SIGN_PFX) {
    & (Join-Path $PSScriptRoot "sign.ps1") -Path $Path
  } else {
    Write-Host "Not signed (MYLE_SIGN_PFX is not set): $Path"
  }
}

$version = (Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json).version
$config = Get-Content (Join-Path $tauriDir "tauri.conf.json") -Raw | ConvertFrom-Json
$binary = $config.mainBinaryName

Push-Location $root
try {
  # 1. The app. `npm run tauri` fetches and verifies the pinned Ludusavi first.
  Invoke-Step "App $version" { npm run tauri -- build --no-bundle }
  $appExe = Join-Path $release "$binary.exe"
  Set-Signature $appExe

  # 2. The uninstaller, which the setup carries inside it.
  Invoke-Step "Setup window" { npm run web:setup }
  Invoke-Step "Uninstaller" {
    cargo build --release --locked --manifest-path $manifest -p myle-setup --bin uninstall --bin myle-pack
  }
  $uninstaller = Join-Path $release "uninstall.exe"
  Set-Signature $uninstaller

  # 3. The install folder, as it will look on the user's PC.
  $work = Join-Path $tauriDir "target\setup"
  $stage = Join-Path $work "payload"
  if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
  New-Item -ItemType Directory -Force $stage | Out-Null
  Copy-Item $appExe (Join-Path $stage "$binary.exe")
  Copy-Item $uninstaller (Join-Path $stage "uninstall.exe")
  foreach ($resource in $config.bundle.resources.PSObject.Properties) {
    $source = Join-Path $tauriDir $resource.Name
    $target = Join-Path $stage $resource.Value
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
      throw "Bundled resource missing: $source"
    }
    New-Item -ItemType Directory -Force (Split-Path -Parent $target) | Out-Null
    Copy-Item -LiteralPath $source $target
  }

  # 4. Pack it and build the setup around it.
  $payload = Join-Path $work "payload.xz"
  Invoke-Step "Payload" { & (Join-Path $release "myle-pack.exe") $stage $version $payload }
  $env:MYLE_PAYLOAD = $payload
  try {
    Invoke-Step "Setup" {
      cargo build --release --locked --manifest-path $manifest -p myle-setup --bin setup
    }
  } finally {
    Remove-Item Env:MYLE_PAYLOAD -ErrorAction SilentlyContinue
  }

  $out = Join-Path $release "bundle\setup"
  # Only this build's setup in there, under the product's plain name.
  if (Test-Path $out) {
    try {
      Remove-Item (Join-Path $out "*.exe") -Force -ErrorAction Stop
    } catch {
      throw "The previous setup in $out is still open. Close it and build again."
    }
  }
  New-Item -ItemType Directory -Force $out | Out-Null
  $setup = Join-Path $out "$binary.exe"
  Copy-Item (Join-Path $release "setup.exe") $setup -Force
  Remove-Item (Join-Path $release "setup.exe"), (Join-Path $release "uninstall.exe"), (Join-Path $release "myle-pack.exe"), (Join-Path $release "myle_pack.exe") -Force -ErrorAction SilentlyContinue
  Set-Signature $setup
  $size = [math]::Round((Get-Item $setup).Length / 1MB, 1)
  Write-Host "==> Done: $setup ($size MB)"
} finally {
  Pop-Location
}
