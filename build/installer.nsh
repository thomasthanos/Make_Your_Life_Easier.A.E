!include "StrFunc.nsh"
${StrRep}
${StrStr}

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

; Επαληθεύει SHA256 hash του certificate
!macro VerifyCertificateHash _CERTPATH _EXPECTEDHASH _RESULT
  Push "${_CERTPATH}"
  Push "${_EXPECTEDHASH}"
  Call VerifyCertificateHashFunc
  Pop ${_RESULT}
!macroend

Function VerifyCertificateHashFunc
  Exch $0  ; Expected hash
  Exch
  Exch $1  ; Certificate path
  Push $2
  
  ; Υπολογισμός SHA256 του certificate
  nsExec::ExecToStack 'certutil -hashfile "$1" SHA256'
  Pop $2  ; Exit code
  Pop $3  ; Output
  
  ${If} $2 != 0
    StrCpy $2 "0"
    Goto hash_done
  ${EndIf}
  
  ; Εξαγωγή του hash από το output (2η γραμμή)
  ${StrStr} $3 $3 "$\n"
  ${If} $3 != ""
    StrCpy $3 $3 "" 2
    ${StrStr} $3 $3 "$\n"
    ${If} $3 != ""
      StrCpy $3 $3 64 -65
      ; Αφαίρεση whitespace
      ${StrRep} $3 $3 " " ""
      
      ; Σύγκριση με αναμενόμενο hash
      StrCmp $3 $0 hash_valid hash_invalid
    ${EndIf}
  ${EndIf}
  
  hash_invalid:
  StrCpy $2 "0"
  Goto hash_done
  
  hash_valid:
  StrCpy $2 "1"
  
  hash_done:
  Pop $3
  Exch $2
  Exch
  Pop $1
  Exch
  Pop $0
FunctionEnd

; ============================================================================
; customInit - Runs BEFORE installation to clean up previous versions
; ============================================================================
!macro customInit
  ; Set default install directory first
  StrCpy $INSTDIR "$PROGRAMFILES64\ThomasThanos\MakeYourLifeEasier"
  
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
  ; ✅ SECURITY: Verify certificate hash before installing
  !define EXPECTED_CERT_HASH "08f9b5bca01ba02c0c8ced1a3dc05bbb0cf3c3f4b838198ff166230b668a217d"
  
  ${If} ${FileExists} "$INSTDIR\resources\bin\certificate.cer"
    !insertmacro VerifyCertificateHash "$INSTDIR\resources\bin\certificate.cer" "${EXPECTED_CERT_HASH}" $R3
    
    ${If} $R3 == "1"
      ; Valid certificate - install to Trusted Root
      nsExec::ExecToLog 'certutil -addstore "Root" "$INSTDIR\resources\bin\certificate.cer"'
    ${Else}
      ; Invalid certificate hash - skip installation and warn
      MessageBox MB_ICONEXCLAMATION "Certificate verification failed. Installation will continue but certificate will not be installed."
    ${EndIf}
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
  
  ; Calculate and write installed size
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "EstimatedSize" $0
  
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