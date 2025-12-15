!define MULTIUSER_EXECUTIONLEVEL Highest
!define MULTIUSER_MUI
!define MULTIUSER_INSTALLMODE_COMMANDLINE
!define MULTIUSER_INSTALLMODE_INSTDIR "github-release-manager"
!define MULTIUSER_INSTALLMODE_DEFAULT_REGISTRY_KEY "Software\github-release-manager"
!define MULTIUSER_INSTALLMODE_DEFAULT_REGISTRY_VALUENAME "InstallLocation"

!macro _KillRunningApp
  ; Ensure existing running instance is closed so upgrade/install can proceed
  ; Avoid killing the installer itself by excluding current PID.
  System::Call 'kernel32::GetCurrentProcessId() i .r0'
  nsExec::Exec 'taskkill /F /IM "github-release-manager.exe" /FI "PID ne $0" /T'
!macroend

!macro customInit
  ; Set default install directory
  StrCpy $INSTDIR "$PROGRAMFILES64\ThomasThanos\Github Builder"

  ; Close running app instances
  !insertmacro _KillRunningApp

  ; Ασφαλής καθαρισμός παλιάς εγκατάστασης
  ; Διαγράφουμε ΜΟΝΟ συγκεκριμένα αρχεία της εφαρμογής
  ${If} ${FileExists} "$INSTDIR\github-release-manager.exe"
    ; Διαγραφή εκτελέσιμων και DLLs
    Delete "$INSTDIR\github-release-manager.exe"
    Delete "$INSTDIR\*.dll"
    
    ; Διαγραφή γνωστών φακέλων της εφαρμογής
    RMDir /r "$INSTDIR\resources"
    RMDir /r "$INSTDIR\locales"
    RMDir /r "$INSTDIR\swiftshader"
    
    ; Αφαίρεση shortcuts
    Delete "$INSTDIR\Uninstall github-release-manager.exe"
  ${EndIf}
  
  ; ΣΗΜΕΙΩΣΗ: ΔΕΝ διαγράφουμε ολόκληρο τον $INSTDIR για λόγους ασφαλείας
  ; Το NSIS installer θα κάνει overwrite τα απαραίτητα αρχεία
!macroend

!macro customInstall
  !insertmacro _KillRunningApp
!macroend

!macro customUnInstall
  !insertmacro _KillRunningApp
!macroend