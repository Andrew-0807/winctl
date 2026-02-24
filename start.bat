@echo off
title WinCTL Setup
color 0A

REM Set UTF-8 encoding for proper Unicode support
chcp 65001 >nul 2>&1
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
set LANG=en_US.UTF-8
set LC_ALL=en_US.UTF-8

echo.
echo  ================================
echo   WinCTL - Windows Service Manager
echo  ================================
echo.
echo [INFO] Using UTF-8 encoding (Code Page 65001)
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo         Download from: https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js found: %NODE_VER%

:: Install dependencies
echo.
echo [INFO] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
)

echo [OK] Dependencies installed.
echo.
echo  ================================
echo   Starting WinCTL on port 3500
echo   Open: http://localhost:3500
echo   (accessible from any device on your network)
echo  ================================
echo.

node server.js
