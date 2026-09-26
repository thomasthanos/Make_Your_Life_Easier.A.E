<#
.SYNOPSIS
  Authenticode-signs one file. Tauri calls it (bundle.windows.signCommand) for
  the app exe, the installer and the uninstaller during a release build.

.DESCRIPTION
  The certificate comes from the environment, set by .github/workflows/release.yml
  from the WIN_CSC_LINK / WIN_CSC_KEY_PASSWORD secrets:
    MYLE_SIGN_PFX       path to the .pfx file
    MYLE_SIGN_PASSWORD  its password
#>
param([Parameter(Mandatory = $true)][string]$Path)

$ErrorActionPreference = "Stop"

if (-not $env:MYLE_SIGN_PFX -or -not (Test-Path -LiteralPath $env:MYLE_SIGN_PFX)) {
  throw "MYLE_SIGN_PFX does not point at a certificate file."
}

# signtool ships with the Windows SDK; take the newest x64 build.
$signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending |
  Select-Object -First 1
if (-not $signtool) { throw "signtool.exe was not found (Windows SDK missing)." }

$arguments = @(
  "sign", "/fd", "sha256",
  "/f", $env:MYLE_SIGN_PFX,
  "/p", $env:MYLE_SIGN_PASSWORD,
  "/tr", "http://timestamp.digicert.com", "/td", "sha256",
  $Path
)

# The timestamp server is occasionally busy; a signature without one would
# stop validating when the certificate expires, so retry instead of skipping.
for ($attempt = 1; $attempt -le 3; $attempt++) {
  & $signtool.FullName @arguments | Out-Host
  if ($LASTEXITCODE -eq 0) { exit 0 }
  Start-Sleep -Seconds (5 * $attempt)
}
throw "signtool could not sign $Path"
