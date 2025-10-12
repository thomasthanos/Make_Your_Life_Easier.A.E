@echo off
setlocal enabledelayedexpansion
title Make Your Life Easier – NPM Tasks
color 0B

:: === ΡΥΘΜΙΣΕΙΣ ===
set "PROJECT_DIR=A:\github\Make_Your_Life_Easier.A.E"
set "LOG_DIR=%PROJECT_DIR%\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:: === ΕΛΕΓΧΟΣ npm ===
where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Δεν βρέθηκε το npm στο PATH. Εγκατάστησε Node.js / NPM και ξαναδοκίμασε.
  echo https://nodejs.org
  pause
  exit /b 1
)

:: === ΜΕΝΟΥ ===
:menu
cls
echo ===============================================
echo   Make Your Life Easier – NPM Tasks
echo   Project: %PROJECT_DIR%
echo ===============================================
echo [1] npm install
echo [2] npm start
echo [3] npm run build-all
echo [4] Τρέξ' τα ολα (1 -> 3)
echo [5] Άνοιγμα Explorer στο project
echo [6] Άνοιγμα VSCode στο project (κλείνει το παράθυρο)
echo [Q] Έξοδος
echo.
set /p choice=Διάλεξε επιλογή: 

if /i "%choice%"=="1" goto install
if /i "%choice%"=="2" goto start
if /i "%choice%"=="3" goto build
if /i "%choice%"=="4" goto all
if /i "%choice%"=="5" goto explorer
if /i "%choice%"=="6" goto vscode_exit
if /i "%choice%"=="q" goto end
goto menu

:install
echo.
echo === npm install ===
pushd "%PROJECT_DIR%"
call npm install 1>>"%LOG_DIR%\npm-install.log" 2>&1
set "rc=%ERRORLEVEL%"
popd
if %rc% neq 0 (
  echo [FAIL] npm install (κωδ.: %rc%). Δες το log: %LOG_DIR%\npm-install.log
) else (
  echo [OK] Ολοκληρώθηκε. Log: %LOG_DIR%\npm-install.log
)
pause
goto menu

:start
echo.
echo === npm start ===
pushd "%PROJECT_DIR%"
:: Χρησιμοποιούμε call ώστε να επιστρέφει στο batch μετά το end του npm
call npm start
set "rc=%ERRORLEVEL%"
popd
if %rc% neq 0 (
  echo [FAIL] npm start (κωδ.: %rc%)
) else (
  echo [OK] npm start τερμάτισε κανονικά.
)
pause
goto menu

:build
echo.
echo === npm run build-all ===
pushd "%PROJECT_DIR%"
call npm run build-all 1>>"%LOG_DIR%\npm-build-all.log" 2>&1
set "rc=%ERRORLEVEL%"
popd
if %rc% neq 0 (
  echo [FAIL] build-all (κωδ.: %rc%). Δες το log: %LOG_DIR%\npm-build-all.log
) else (
  echo [OK] Build ολοκληρώθηκε. Log: %LOG_DIR%\npm-build-all.log
)
pause
goto menu

:all
call :install
call :start
call :build
goto menu

:explorer
echo.
echo === Άνοιγμα Explorer ===
if exist "%PROJECT_DIR%" (
  explorer "%PROJECT_DIR%"
  echo [OK] Άνοιξε το Explorer στο: %PROJECT_DIR%
) else (
  echo [ERROR] Το directory δεν υπάρχει: %PROJECT_DIR%
)
pause
goto menu

:vscode
echo.
echo === Άνοιγμα VSCode ===
:: Έλεγχος αν το VSCode είναι εγκατεστημένο
where code >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Δεν βρέθηκε το VSCode (code command) στο PATH.
  echo Βεβαιώσου ότι το VSCode είναι εγκατεστημένο και στο PATH.
) else (
  if exist "%PROJECT_DIR%" (
    code "%PROJECT_DIR%"
    echo [OK] Άνοιξε το VSCode στο: %PROJECT_DIR%
  ) else (
    echo [ERROR] Το directory δεν υπάρχει: %PROJECT_DIR%
  )
)
pause
goto menu

:vscode_exit
echo.
echo === Άνοιγμα VSCode (κλείσιμο παραθύρου) ===
:: Έλεγχος αν το VSCode είναι εγκατεστημένο
where code >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Δεν βρέθηκε το VSCode (code command) στο PATH.
  echo Βεβαιώσου ότι το VSCode είναι εγκατεστημένο και στο PATH.
  pause
  exit /b 1
) else (
  if exist "%PROJECT_DIR%" (
    code "%PROJECT_DIR%"
    echo [OK] Άνοιξε το VSCode στο: %PROJECT_DIR%
    echo Το παράθυρο θα κλείσει τώρα...
    timeout /t 2 /nobreak >nul
    exit /b 0
  ) else (
    echo [ERROR] Το directory δεν υπάρχει: %PROJECT_DIR%
    pause
    exit /b 1
  )
)

:end
echo Έξοδος...
exit /b 0