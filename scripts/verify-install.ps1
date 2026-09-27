<#
.SYNOPSIS
  Checks that Make Your Life Easier is installed (or fully removed) at the expected locations.

.EXAMPLE
  ./scripts/verify-install.ps1            # after running the setup
  ./scripts/verify-install.ps1 -Removed   # after uninstalling
#>
param([switch]$Removed)

$installDir = Join-Path $env:LOCALAPPDATA "ThomasThanos\MakeYourLifeEasier"
$exe = Join-Path $installDir "MakeYourLifeEasier.exe"
$shortcuts = [ordered]@{
  "Desktop"    = Join-Path ([Environment]::GetFolderPath("Desktop")) "Make Your Life Easier.lnk"
  "Start Menu" = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Make Your Life Easier.lnk"
  "Startup"    = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup\Make Your Life Easier.lnk"
}
$uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier"

$failures = 0
function Check([string]$label, [bool]$present, [string]$detail = "") {
  $ok = if ($Removed) { -not $present } else { $present }
  $state = if ($present) { "present" } else { "absent" }
  $mark = if ($ok) { "OK  " } else { "FAIL" }
  Write-Host ("[{0}] {1,-14} {2,-8} {3}" -f $mark, $label, $state, $detail)
  if (-not $ok) { $script:failures++ }
}

Check "Program" (Test-Path $exe) $exe

$shell = New-Object -ComObject WScript.Shell
foreach ($name in $shortcuts.Keys) {
  $path = $shortcuts[$name]
  $present = Test-Path $path
  $detail = $path
  if ($present) {
    $link = $shell.CreateShortcut($path)
    $detail = "-> $($link.TargetPath) $($link.Arguments)".Trim()
    if (-not $Removed -and $link.TargetPath -ne $exe) {
      Write-Host "       shortcut target is not $exe"
      $failures++
    }
  }
  Check $name $present $detail
}

$key = Get-ItemProperty $uninstallKey -ErrorAction SilentlyContinue
$detail = if ($key) { "$($key.DisplayName) $($key.DisplayVersion) ($($key.Publisher))" } else { $uninstallKey }
Check "Uninstall key" ($null -ne $key) $detail

if ($failures) {
  Write-Host "`n$failures check(s) failed." -ForegroundColor Red
  exit 1
}
Write-Host "`nAll checks passed." -ForegroundColor Green
