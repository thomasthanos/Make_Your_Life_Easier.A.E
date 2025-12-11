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
  !insertmacro _KillRunningApp
  ; Set default install directory
  StrCpy $INSTDIR "$PROGRAMFILES64\MakeYourLifeEasier\Github Builder"
!macroend

!macro customInstall
  !insertmacro _KillRunningApp
!macroend

!macro customUnInstall
  !insertmacro _KillRunningApp
!macroend