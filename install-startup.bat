@echo off
:: Run as Administrator to register WinCTL as a startup task

set WINCTL_DIR=%~dp0
set NODE_PATH=node

echo.
echo  Creating Windows Task Scheduler entry for WinCTL...
echo  (This keeps WinCTL running automatically at login)
echo.

schtasks /create /tn "WinCTL" /tr "%NODE_PATH% \"%WINCTL_DIR%server.js\"" /sc onlogon /ru "%USERNAME%" /f /rl highest

if %errorlevel% equ 0 (
    echo [OK] Task created. WinCTL will start at every login.
    echo      You can manage it in Task Scheduler (taskschd.msc)
) else (
    echo [WARN] Task creation may have failed.
    echo        Try running this script as Administrator.
)

echo.
pause
