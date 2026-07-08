@echo off
:: WinCTL One-Time Setup
:: Run this as Administrator

title WinCTL Setup

echo.
echo  WinCTL Setup
echo  ============
echo.

:: Check for Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  ERROR: This script must be run as Administrator.
    echo  Right-click setup.bat and choose "Run as administrator".
    pause
    exit /b 1
)

:: Step 1 — Build
echo [1/4] Building WinCTL...
call npm run build
if %errorLevel% neq 0 (
    echo  ERROR: Build failed. Run "npm install" first.
    pause
    exit /b 1
)
echo  Build complete.
echo.

:: Step 2 — Install Windows Service
echo [2/4] Installing WinCTL as a Windows Service...
node scripts\service-install.js
if %errorLevel% neq 0 (
    echo  ERROR: Service installation failed.
    pause
    exit /b 1
)
echo.

:: Step 3 — Firewall rule
echo [3/4] Adding Windows Firewall rule for port 8080...
netsh advfirewall firewall add rule name="WinCTL" dir=in action=allow protocol=TCP localport=8080 >nul
echo  Firewall rule added.
echo.

:: Step 4 — Print IP addresses
echo [4/4] Your local network addresses (access from phone):
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /r "IPv4"') do (
    set ip=%%a
    setlocal enabledelayedexpansion
    set ip=!ip: =!
    echo   http://!ip!:8080
    endlocal
)
echo.

echo  Setup complete!
echo  Open http://localhost:8080 in your browser.
echo  WinCTL will start automatically at boot.
echo.
pause
