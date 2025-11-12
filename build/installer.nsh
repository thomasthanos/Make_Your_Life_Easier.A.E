; Custom NSIS script for MakeYourLifeEasier

!macro customUnInstall
  ${ifNot} ${isUpdated}
    RMDir /r "$APPDATA\${APP_FILENAME}"
    RMDir /r "$LOCALAPPDATA\${APP_FILENAME}"
    SetShellVarContext current
  ${endIf}
!macroend
