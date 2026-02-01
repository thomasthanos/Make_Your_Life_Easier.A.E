@echo off
:: ===============================
:: HARD FORCE Sparkle Cleanup
:: ===============================

:: Self-elevate
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo Killing sparkle / electron related processes...

for %%P in (
    sparkle.exe
    sparkle-updater.exe
    updater.exe
    electron.exe
    node.exe
) do (
    taskkill /f /im %%P >nul 2>&1
)

echo Stopping Explorer...
taskkill /f /im explorer.exe >nul 2>&1

set BASE=C:\Users\Fuck-Windows\AppData\Roaming\make-your-life-easier
set FOLDER1=%BASE%\debloat-sparkle
set FOLDER2=%BASE%\sparkle

for %%F in ("%FOLDER1%" "%FOLDER2%") do (
    if exist %%F (
        echo.
        echo Forcing ownership on %%F
        takeown /f %%F /r /d y >nul
        icacls %%F /grant %username%:F /t >nul

        echo Deleting %%F
        rmdir /s /q %%F
    )
)

echo Restarting Explorer...
start explorer.exe

echo.
echo DONE. If folder still exists, Safe Mode will 100%% remove it.
pause
