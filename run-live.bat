@echo off
title Nagomi Koi Pond - TikTok Live Bridge
color 0b
cd /d "%~dp0"
if exist "%~dp0nagomi" cd /d "%~dp0nagomi"

if not exist node_modules goto need_setup
if not exist live-server\node_modules goto need_setup
if not exist dist goto need_setup
goto start_server

:need_setup
echo ========================================================
echo [!] Phat hien chua cai dat hoac chua bien dich giao dien.
echo Dang tu dong chuyen sang file setup.bat...
echo ========================================================
call setup.bat
exit /b

:start_server
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul

echo ========================================================
echo   HO CA KOI 3D - TIKTOK LIVE INTERACTIVE BRIDGE
echo ========================================================
echo.
echo [*] Link dan vao OBS:       http://localhost:3001/?mobile=1^&live=1
echo [*] Bang dieu khien test:   http://localhost:3001/control
echo.
node --max-old-space-size=512 live-server/server.mjs
pause
