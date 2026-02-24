@echo off
title Open-WebUI Launcher
color 0B

REM Set UTF-8 encoding for proper Unicode support
chcp 65001 >nul 2>&1
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
set LANG=en_US.UTF-8
set LC_ALL=en_US.UTF-8

REM Additional Windows-specific Unicode handling
set PYTHONLEGACYWINDOWSSTDIO=utf-8

echo.
echo  ========================================
echo   Open-WebUI Unicode-Aware Launcher
echo  ========================================
echo.

REM Check if open-webui is available
where open-webui >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] open-webui command not found.
    echo         Please install Open-WebUI first:
    echo         pip install open-webui
    echo.
    pause
    exit /b 1
)

echo [OK] Open-WebUI found in PATH
echo [INFO] Console encoding: UTF-8 (Code Page 65001)
echo.

REM Check for port conflicts with better handling
echo [INFO] Checking for port conflicts on 8080...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
    echo [WARN] Port 8080 is in use by PID %%a
    goto :port_conflict
)
goto :start_service

:port_conflict
echo.
set /p choice="Do you want to use a different port? (y/n): "
if /i "%choice%"=="y" (
    set /p newport="Enter alternative port (e.g., 8081): "
    if defined newport (
        echo [INFO] Starting Open-WebUI on port !newport!...
        goto :start_with_port
    ) else (
        echo [ERROR] No port specified. Exiting.
        pause
        exit /b 1
    )
) else (
    echo [INFO] Attempting to start on default port 8080...
    echo [WARN] This may fail if the port is still in use.
)

:start_service
REM Start Open-WebUI with proper Unicode support
echo [INFO] Starting Open-WebUI with enhanced UTF-8 encoding...
echo [INFO] Access URL will be: http://localhost:8080
echo [INFO] Press Ctrl+C to stop the server
echo.
open-webui serve
goto :end

:start_with_port
echo [INFO] Access URL will be: http://localhost:!newport!
echo [INFO] Press Ctrl+C to stop the server
echo.
open-webui serve --port !newport!
goto :end

:end
REM Check exit code
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Open-WebUI failed to start.
    echo [INFO] Common issues:
    echo         - Port already in use
    echo         - Missing Python dependencies
    echo         - Insufficient permissions
    echo         - Network configuration issues
    echo.
    echo [INFO] Troubleshooting:
    echo         1. Try a different port: open-webui serve --port 8081
    echo         2. Install PyTorch: pip install torch
    echo         3. Run as administrator if needed
    echo.
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Open-WebUI session completed.
pause
