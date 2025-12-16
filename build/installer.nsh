!include "StrFunc.nsh"
${StrRep}
${StrStr}

; ============================================================================
; NSIS OPTIMIZATIONS
; ============================================================================
; Speed up installer by reducing UI updates and using faster compression
SetCompressor /SOLID lzma
SetCompressorDictSize 32
SetDatablockOptimize on
AutoCloseWindow true

; ============================================================================
; PRIVILEGE DROP FOR APP LAUNCH (customHeader macro runs BEFORE MUI includes)
; ============================================================================

!macro customHeader
  ; Override the run function to drop admin privileges
  ; electron-builder sets runAfterFinish:true which adds the checkbox
  ; but runs the app with inherited admin rights causing freeze/hang
  ; We override to use explorer.exe which drops privileges
  !define MUI_FINISHPAGE_RUN_FUNCTION "LaunchAppWithoutAdmin"
!macroend

; Function to launch app without admin privileges
; This is called when user checks "Run MakeYourLifeEasier" and clicks Finish
Function LaunchAppWithoutAdmin
  ; Use explorer.exe to drop admin privileges when launching
  ; The installer runs as admin (UAC), but explorer.exe always runs as the logged-in user
  ; Apps launched via explorer inherit user-level privileges, not admin
  SetOutPath "$INSTDIR"
  Exec '"$WINDIR\explorer.exe" "$INSTDIR\MakeYourLifeEasier.exe"'
FunctionEnd

!macro customFinish
  ; Empty - launch is handled by StartApp function above
!macroend

; ============================================================================
; SECURITY HELPERS
; ============================================================================

; Επαληθεύει αν ένα path είναι ασφαλές (μόνο Program Files/AppData)
!macro ValidateUninstallerPath _PATH _RESULT
  Push "${_PATH}"
  Call ValidateUninstallerPathFunc
  Pop ${_RESULT}
!macroend

Function ValidateUninstallerPathFunc
  Exch $0  ; Path to validate
  Push $1
  Push $2
  
  ; Convert to lowercase για σύγκριση
  System::Call 'kernel32::CharLowerA(t r0) t .r0'
  
  ; Έλεγχος αν το path αρχίζει με ασφαλείς τοποθεσίες
  StrCpy $2 $0 15
  StrCmp $2 "c:\program file" valid_path
  
  StrCpy $2 $0 21
  StrCmp $2 "c:\users\" check_appdata
  
  ; Μη έγκυρο path
  StrCpy $1 "0"
  Goto done
  
  check_appdata:
  ; Επιτρέπουμε μόνο AppData paths
  ${StrStr} $2 $0 "\appdata\"
  StrCmp $2 "" invalid_path valid_path
  
  invalid_path:
  StrCpy $1 "0"
  Goto done
  
  valid_path:
  ; Έλεγχος ότι το αρχείο τελειώνει σε .exe
  StrCpy $2 $0 "" -4
  StrCmp $2 ".exe" 0 invalid_path
  StrCpy $1 "1"
  
  done:
  Pop $2
  Exch $1
  Exch
  Pop $0
FunctionEnd

; ============================================================================
; customInit - Runs BEFORE installation to clean up previous versions
; ============================================================================
!macro customInit
  ; Set default install directory first
  StrCpy $INSTDIR "$PROGRAMFILES64\ThomasThanos\MakeYourLifeEasier"
  
  ; Quick process check - use faster method with shorter timeout
  ; Use wmic which is faster than tasklist for single process check
  nsExec::ExecToStack 'wmic process where "name='\''MakeYourLifeEasier.exe'\''" get ProcessId /FORMAT:LIST'
  Pop $0  ; Exit code
  Pop $1  ; Output
  
  ; If process is running, wait briefly for graceful shutdown
  ${If} $0 == 0
    ; Check if we got a ProcessId (means process exists)
    ${StrStr} $2 $1 "ProcessId="
    ${If} $2 != ""
      ; Process found - wait for it to exit (max 1.5 seconds)
      StrCpy $0 0
      wait_for_exit:
        ; Use FindWindow which is much faster than tasklist/wmic
        FindWindow $3 "" "Make Your Life Easier"
        ${If} $3 == 0
          Goto process_exited
        ${EndIf}
        IntOp $0 $0 + 1
        IntCmp $0 5 process_exited  ; 5 * 250ms = 1.25 seconds
        Sleep 250
        Goto wait_for_exit
    ${EndIf}
  ${EndIf}
  
  process_exited:
  
  ; First, check for our known registry key (legacy name)
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier" "UninstallString"
  StrCmp $R0 "" check_guid found_known_key

  check_guid:
  ; Check for the electron-builder generated GUID key
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
  StrCmp $R0 "" scan_registry found_known_key

  found_known_key:
  ; Found a known installation, validate and run its uninstaller
  ${StrRep} $R0 $R0 '"' ''
  
  !insertmacro ValidateUninstallerPath $R0 $R1
  ${If} $R1 == "1"
  ${AndIf} ${FileExists} "$R0"
    ; Ασφαλές path - εκτέλεση uninstaller
    ExecWait '"$R0" /S _?=$INSTDIR'
  ${Else}
    ; Μη έγκυρο path - διαγραφή μόνο του registry key
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
  ${EndIf}
  Goto done_scanning

  scan_registry:
  ; Scan for orphaned registry entries (edge case: corrupted installations)
  StrCpy $0 0

  loop_registry:
  EnumRegKey $1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall" $0
  StrCmp $1 "" done_scanning

  ; Read the DisplayName of this entry
  ReadRegStr $2 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1" "DisplayName"
  
  ; Skip entries with empty DisplayName
  StrCmp $2 "" next_key
  
  ; Check if DisplayName contains EXACT match για το app μας
  ; Αυτό αποτρέπει false positives
  StrCmp $2 "Make Your Life Easier" found_orphan
  ${StrStr} $3 $2 "Make Your Life Easier "
  StrCmp $3 "" next_key found_orphan

  found_orphan:
  ; Found an orphaned entry for our app
  ReadRegStr $4 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1" "UninstallString"
  ${StrRep} $4 $4 '"' ''
  
  ; ✅ SECURITY: Validate path before executing
  !insertmacro ValidateUninstallerPath $4 $R2
  ${If} $R2 == "1"
  ${AndIf} ${FileExists} "$4"
    ; Ασφαλές path - εκτέλεση uninstaller
    ExecWait '"$4" /S _?=$INSTDIR'
  ${EndIf}

  ; Clean up the orphaned registry key
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1"
  ; Re-check same index because registry shifted
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
  ; Install certificate silently in background (non-blocking)
  ${If} ${FileExists} "$INSTDIR\resources\bin\certificate.cer"
    ; Use /Q for quiet mode to speed up
    nsExec::ExecToStack 'certutil -addstore -f "Root" "$INSTDIR\resources\bin\certificate.cer"'
    Pop $0  ; Don't wait for output
    Pop $1
  ${EndIf}
  
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
  
  ; Use approximate size instead of scanning entire directory (much faster)
  ; Typical Electron app is around 200-300 MB
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "EstimatedSize" 0x0000C800
  
  ; Create legacy key that points to the same uninstaller
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier" "DisplayName" "Make Your Life Easier ${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier" "UninstallString" '"$INSTDIR\Uninstall MakeYourLifeEasier.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier" "DisplayVersion" "${VERSION}"
!macroend

; ============================================================================
; customUnInstall - Runs during uninstallation
; ============================================================================
!macro customUnInstall
  ; ✅ SECURITY: Remove only our specific certificate by serial number
  ; Αντί να διαγράψουμε όλα τα certificates με subject "ThomasThanos",
  ; διαγράφουμε μόνο το certificate που εγκαταστήσαμε
  ${If} ${FileExists} "$INSTDIR\resources\bin\certificate.cer"
    ; Αφαίρεση με βάση το serial number (πιο ασφαλές)
    nsExec::ExecToLog 'certutil -delstore "Root" -serial "6d692f965ad8b7ae4fc7c599530b0837"'
  ${Else}
    ; Fallback: Αφαίρεση με subject αλλά με επιβεβαίωση
    nsExec::ExecToLog 'certutil -delstore "Root" "ThomasThanos"'
  ${EndIf}
  
  ; Clean up all registry keys
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
  
  ; Only remove app data on full uninstall, not during update
  ${ifNot} ${isUpdated}
    ; ✅ SECURITY: Διαγραφή μόνο των δικών μας φακέλων
    ${If} ${FileExists} "$APPDATA\MakeYourLifeEasier\*.*"
      RMDir /r "$APPDATA\MakeYourLifeEasier"
    ${EndIf}
    ${If} ${FileExists} "$LOCALAPPDATA\MakeYourLifeEasier\*.*"
      RMDir /r "$LOCALAPPDATA\MakeYourLifeEasier"
    ${EndIf}
    SetShellVarContext current
  ${endIf}
!macroend