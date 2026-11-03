@echo off
title Nagomi Koi Pond - TikTok Live Bridge
color 0b
cd /d "%~dp0"
if exist "%~dp0nagomi" cd /d "%~dp0nagomi"

powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul

echo ========================================================
echo   HO CA KOI 3D - TIKTOK LIVE INTERACTIVE BRIDGE
echo ========================================================
echo.
echo [*] Link dan vao OBS:       http://localhost:3001/?mobile=1
echo [*] Bang dieu khien test:   http://localhost:3001/control
echo.
node --max-old-space-size=512 live-server/server.mjs
pause
