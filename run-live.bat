@echo off
title Nagomi Koi Pond - TikTok Live Bridge
color 0b
cd /d "%~dp0"
if exist "%~dp0nagomi" cd /d "%~dp0nagomi"

where node >nul 2>nul
if errorlevel 1 (
    echo ========================================================
    echo   [!] MAY CHUA CAI DAT NODE.JS!
    echo   Vui long vao https://nodejs.org/ tai ban LTS va cai dat.
    echo   Sau khi cai xong, hay click dup lai vao file nay.
    echo ========================================================
    pause
    exit /b
)

if not exist "node_modules\" (
    echo ========================================================
    echo   [*] Dang cai dat thu vien lan dau (npm install)...
    echo   Qua trinh nay chi chay 1 lan duy nhat, vui long doi!
    echo ========================================================
    call npm install
    if errorlevel 1 (
        echo [!] Loi khi cai dat thu vien. Vui long kiem tra lai internet!
        pause
        exit /b
    )
)

if not exist "dist\" (
    echo ========================================================
    echo   [*] Dang khoi tao giao dien ho ca (npm run build)...
    echo ========================================================
    call npm run build
    if errorlevel 1 (
        echo [!] Loi khi build giao dien.
        pause
        exit /b
    )
)

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
