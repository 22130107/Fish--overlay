@echo off
title Nagomi Koi Pond - TikTok Live Bridge
color 0b
cd /d "%~dp0"
if exist "%~dp0nagomi" cd /d "%~dp0nagomi"

:: Tu dong kiem tra neu chua cai dat thu vien
if not exist "node_modules\" (
    echo [!] Phat hien chua cai dat thu vien. Dang tu dong chuyen sang setup...
    call setup.bat
    exit /b
)
if not exist "live-server\node_modules\" (
    echo [!] Phat hien chua cai dat thu vien live-server. Dang tu dong chuyen sang setup...
    call setup.bat
    exit /b
)
if not exist "dist\" (
    echo [!] Phat hien chua bien dich giao dien (dist). Dang tu dong chuyen sang setup...
    call setup.bat
    exit /b
)

powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul

echo ========================================================
echo   HO CA KOI 3D - TIKTOK LIVE INTERACTIVE BRIDGE
echo ========================================================
echo.
echo [*] Link dan vao OBS:       http://localhost:3001/?mobile=1&live=1
echo [*] Bang dieu khien test:   http://localhost:3001/control
echo.
node --max-old-space-size=512 live-server/server.mjs
pause
