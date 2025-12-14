!include "StrFunc.nsh"
${StrRep}
${StrStr}

; ============================================================================
; customInit - Runs BEFORE installation to clean up previous versions
; ============================================================================
!macro customInit
  ; First, check for our known registry key (legacy name)
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier" "UninstallString"
  StrCmp $R0 "" check_guid found_known_key

  check_guid:
  ; Check for the electron-builder generated GUID key
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
  StrCmp $R0 "" scan_registry found_known_key

  found_known_key:
  ; Found a known installation, run its uninstaller silently
  ${StrRep} $R0 $R0 '"' ''
  ${If} $R0 != ""
    ExecWait '"$R0" /S _?=$INSTDIR'
  ${EndIf}
  Goto done_scanning  ; ✅ FIX: Exit after uninstalling known version

  scan_registry:
  ; Scan for orphaned registry entries (edge case: corrupted installations)
  StrCpy $0 0

  loop_registry:
  EnumRegKey $1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall" $0
  StrCmp $1 "" done_scanning

  ; Read the DisplayName of this entry
  ReadRegStr $2 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1" "DisplayName"
  
  ; ✅ FIX: Skip entries with empty DisplayName
  StrCmp $2 "" next_key
  
  ; Check if DisplayName contains our app name
  ${StrStr} $3 $2 "MakeYourLifeEasier"
  StrCmp $3 "" check_alternate_name found_orphan

  check_alternate_name:
  ; ✅ FIX: Also check for "Make Your Life Easier" (with spaces)
  ${StrStr} $3 $2 "Make Your Life Easier"
  StrCmp $3 "" next_key found_orphan

  found_orphan:
  ; Found an orphaned entry for our app
  ReadRegStr $4 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1" "UninstallString"
  ${StrRep} $4 $4 '"' ''
  
  ${If} $4 != ""
    ; Run the uninstaller if it exists
    IfFileExists $4 0 +2
      ExecWait '"$4" /S _?=$INSTDIR'
  ${EndIf}

  ; Clean up the orphaned registry key
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1"
  ; ✅ FIX: After deleting, we need to re-check the same index
  ; because the registry shifted, so decrement counter
  IntOp $0 $0 - 1

  next_key:
  IntOp $0 $0 + 1
  Goto loop_registry

  done_scanning:
!macroend

; ============================================================================
; customInstall - Runs AFTER files are installed
; ============================================================================
!macro customInstall
  ; Install certificate to Trusted Root (for code signing verification)
  nsExec::ExecToLog 'certutil -addstore "Root" "$INSTDIR\resources\bin\certificate.cer"'
  
  ; Use the electron-builder generated key for all registry entries
  StrCpy $R0 "${UNINSTALL_APP_KEY}"
  
  ; Write application information to registry
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "DisplayName" "Make Your Life Easier ${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "Publisher" "ThomasThanos"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "DisplayIcon" "$INSTDIR\MakeYourLifeEasier.exe"
  
  ; Write URLs for support and information
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "HelpLink" "https://thomasthanos.github.io/Make_Your_Life_Easier.A.E/src/public/copyright.html"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "URLInfoAbout" "https://thomasthanos.github.io/Make_Your_Life_Easier.A.E/info/info.html"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "Readme" "https://thomasthanos.github.io/Make_Your_Life_Easier.A.E/src/public/readme.html"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "URLUpdateInfo" "https://thomasthanos.github.io/Make_Your_Life_Easier.A.E/src/public/changelog.html"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "Comments" "A modern, user-friendly desktop application with auto-updater"
  
  ; Calculate and write installed size
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "EstimatedSize" $0
  
  ; ✅ FIX: Create legacy key that points to the same uninstaller
  ; This ensures backward compatibility and proper detection in customInit
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier" "DisplayName" "Make Your Life Easier ${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier" "UninstallString" '"$INSTDIR\Uninstall MakeYourLifeEasier.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier" "DisplayVersion" "${VERSION}"
!macroend

; ============================================================================
; customUnInstall - Runs during uninstallation
; ============================================================================
!macro customUnInstall
  ; Remove certificate from Trusted Root
  nsExec::ExecToLog 'certutil -delstore "Root" "ThomasThanos"'
  
  ; Clean up all registry keys
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
  
  ; Only remove app data on full uninstall, not during update
  ${ifNot} ${isUpdated}
    RMDir /r "$APPDATA\MakeYourLifeEasier"
    RMDir /r "$LOCALAPPDATA\MakeYourLifeEasier"
    SetShellVarContext current
  ${endIf}
!macroend
