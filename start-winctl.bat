@echo off
title WinCTL Auto-Start
color 0A

REM Set UTF-8 encoding for proper Unicode support
chcp 65001 >nul 2>&1
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
set LANG=en_US.UTF-8
set LC_ALL=en_US.UTF-8

REM Enable delayed expansion for variable handling
setlocal enabledelayedexpansion

echo.
echo  ========================================
echo   WinCTL Auto-Start Service
echo  ========================================
echo.

REM Check if Node.js is available
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found in PATH.
    echo         Please install Node.js: https://nodejs.org
    pause
    exit /b 1
)

REM Check if settings file exists
if not exist "%USERPROFILE%\.winctl\settings.json" (
    echo [INFO] Settings file not found, creating default...
    if not exist "%USERPROFILE%\.winctl" mkdir "%USERPROFILE%\.winctl"
    echo {"folderStatePreference": "remember", "showFolderCount": true, "autoStart": false} > "%USERPROFILE%\.winctl\settings.json"
)

REM Check if auto-start is enabled
findstr /C:"\"autoStart\":true" "%USERPROFILE%\.winctl\settings.json" >nul 2>&1
if !errorlevel! equ 0 (
    echo [INFO] Auto-start is enabled, starting WinCTL...
    echo [INFO] Using UTF-8 encoding (Code Page 65001)
    
    REM Check if port 3500 is available
    netstat -ano | findstr :3500 | findstr LISTENING >nul 2>&1
    if !errorlevel! equ 0 (
        echo [WARN] Port 3500 is already in use.
        echo [INFO] WinCTL will attempt to start anyway.
    )
    
    REM Start WinCTL in background
    start /B node server.js --no-browser
    
    REM Wait a moment to check if it started
    timeout /t 2 >nul
    
    REM Check if WinCTL is running
    netstat -ano | findstr :3500 | findstr LISTENING >nul 2>&1
    if !errorlevel! equ 0 (
        echo [SUCCESS] WinCTL started successfully!
        echo [INFO] Access at: http://localhost:3500
    ) else (
        echo [ERROR] Failed to start WinCTL.
        echo [INFO] Check logs or run manually: node server.js
    )
) else (
    echo [INFO] Auto-start is disabled.
    echo [INFO] Enable in WinCTL settings or run manually:
    echo         start.bat
)

echo.
timeout /t 3 >nul
