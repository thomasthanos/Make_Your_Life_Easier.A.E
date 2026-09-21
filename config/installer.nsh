!include "StrFunc.nsh"
${StrRep}
${StrStr}

SetCompressor /SOLID lzma
SetCompressorDictSize 32
SetDatablockOptimize on
AutoCloseWindow true



!macro ValidateUninstallerPath _PATH _RESULT
  Push "${_PATH}"
  Call ValidateUninstallerPathFunc
  Pop ${_RESULT}
!macroend

Function ValidateUninstallerPathFunc
  Exch $0
  Push $1
  Push $2

  System::Call 'kernel32::CharLowerA(t r0) t .r0'

  StrCpy $2 $0 15
  StrCmp $2 "c:\program file" valid_path

  StrCpy $2 $0 21
  StrCmp $2 "c:\users\" check_appdata

  StrCpy $1 "0"
  Goto done

  check_appdata:
  ${StrStr} $2 $0 "\appdata\"
  StrCmp $2 "" invalid_path valid_path

  invalid_path:
  StrCpy $1 "0"
  Goto done

  valid_path:
  StrCpy $2 $0 "" -4
  StrCmp $2 ".exe" 0 invalid_path
  StrCpy $1 "1"

  done:
  Pop $2
  Exch $1
  Exch
  Pop $0
FunctionEnd

!macro customInit
  StrCpy $INSTDIR "$LOCALAPPDATA\ThomasThanos\MakeYourLifeEasier"

  nsExec::ExecToStack 'wmic process where "name='\''MakeYourLifeEasier.exe'\''" get ProcessId /FORMAT:LIST'
  Pop $0
  Pop $1

  ${If} $0 == 0
    ${StrStr} $2 $1 "ProcessId="
    ${If} $2 != ""
      StrCpy $0 0
      wait_for_exit:
        FindWindow $3 "" "Make Your Life Easier"
        ${If} $3 == 0
          Goto process_exited
        ${EndIf}
        IntOp $0 $0 + 1
        IntCmp $0 5 process_exited
        Sleep 250
        Goto wait_for_exit
    ${EndIf}
  ${EndIf}

  process_exited:

  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier" "UninstallString"
  StrCmp $R0 "" check_guid found_known_key

  check_guid:
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
  StrCmp $R0 "" scan_registry found_known_key

  found_known_key:
  ${StrRep} $R0 $R0 '"' ''

  !insertmacro ValidateUninstallerPath $R0 $R1
  ${If} $R1 == "1"
  ${AndIf} ${FileExists} "$R0"
    ExecWait '"$R0" /S _?=$INSTDIR'
  ${Else}
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
  ${EndIf}
  Goto done_scanning

  scan_registry:
  StrCpy $0 0

  loop_registry:
  EnumRegKey $1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall" $0
  StrCmp $1 "" done_scanning

  ReadRegStr $2 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1" "DisplayName"

  StrCmp $2 "" next_key

  StrCmp $2 "Make Your Life Easier" found_orphan
  ${StrStr} $3 $2 "Make Your Life Easier "
  StrCmp $3 "" next_key found_orphan

  found_orphan:
  ReadRegStr $4 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1" "UninstallString"
  ${StrRep} $4 $4 '"' ''

  !insertmacro ValidateUninstallerPath $4 $R2
  ${If} $R2 == "1"
  ${AndIf} ${FileExists} "$4"
    ExecWait '"$4" /S _?=$INSTDIR'
  ${EndIf}

  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1"
  IntOp $0 $0 - 1

  next_key:
  IntOp $0 $0 + 1
  Goto loop_registry

  done_scanning:
!macroend

!macro customInstall

  SetShellVarContext current
  CreateShortCut "$DESKTOP\Make Your Life Easier.lnk" "$INSTDIR\MakeYourLifeEasier.exe" "" "$INSTDIR\MakeYourLifeEasier.exe" 0

  CreateDirectory "$SMPROGRAMS\Make Your Life Easier"
  CreateShortCut "$SMPROGRAMS\Make Your Life Easier\Make Your Life Easier.lnk" "$INSTDIR\MakeYourLifeEasier.exe" "" "$INSTDIR\MakeYourLifeEasier.exe" 0

  StrCpy $R0 "${UNINSTALL_APP_KEY}"

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "DisplayName" "Make Your Life Easier ${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "Publisher" "ThomasThanos"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "DisplayIcon" "$INSTDIR\MakeYourLifeEasier.exe"

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "HelpLink" "https://thomasthanos.github.io/Make_Your_Life_Easier.A.E/src/public/copyright.html"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "URLInfoAbout" "https://thomasthanos.github.io/Make_Your_Life_Easier.A.E/src/renderer/info/info.html"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "Readme" "https://thomasthanos.github.io/Make_Your_Life_Easier.A.E/src/public/readme.html"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "URLUpdateInfo" "https://thomasthanos.github.io/Make_Your_Life_Easier.A.E/src/public/changelog.html"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "Comments" "A modern, user-friendly desktop application with auto-updater"

  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R0" "EstimatedSize" 0x0000C800

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier" "DisplayName" "Make Your Life Easier ${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier" "UninstallString" '"$INSTDIR\Uninstall MakeYourLifeEasier.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier" "DisplayVersion" "${VERSION}"
!macroend

!macro customUnInstall

  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MakeYourLifeEasier"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"

  ${ifNot} ${isUpdated}
    ${If} ${FileExists} "$APPDATA\MakeYourLifeEasier\*.*"
      RMDir /r "$APPDATA\MakeYourLifeEasier"
    ${EndIf}
    ${If} ${FileExists} "$LOCALAPPDATA\MakeYourLifeEasier\*.*"
      RMDir /r "$LOCALAPPDATA\MakeYourLifeEasier"
    ${EndIf}
    SetShellVarContext current
  ${endIf}
!macroend
