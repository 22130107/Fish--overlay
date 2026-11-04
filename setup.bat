@echo off
title Cai Dat Tu Dong - Ho Ca Koi 3D Live
color 0a
cd /d "%~dp0"
if exist "%~dp0nagomi" cd /d "%~dp0nagomi"

echo ========================================================
echo       HE THONG CAI DAT TU DONG - HO CA KOI 3D LIVE
echo ========================================================
echo.

:: 1. Kiem tra Node.js
echo [1/4] Kiem tra moi truong Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [-] May tinh chua co Node.js! Dang tien hanh tu dong cai dat qua winget...
    where winget >nul 2>nul
    if %errorlevel% equ 0 (
        echo Dang tai va cai dat Node.js LTS, vui long doi...
        winget install OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
        echo.
        echo ========================================================
        echo [!] Da cai xong Node.js! 
        echo De he thong nhan dien moi truong moi, vui long dong cua so nay 
        echo va chay lai file setup.bat nay 1 lan nua!
        echo ========================================================
        pause
        exit /b
    ) else (
        echo [!] May tinh khong co cong cu winget.
        echo Vui long truy cap https://nodejs.org/ de tai va cai dat Node.js ban LTS.
        pause
        exit /b
    )
) else (
    for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
    echo [+] Da tim thay Node.js: %NODE_VER%
)

echo.
:: 2. Cai dat thu vien goc
echo [2/4] Dang cai dat thu vien giao dien (npm install)...
call npm install
if %errorlevel% neq 0 (
    echo [!] Co loi xay ra khi cai dat thu vien goc.
    pause
    exit /b
)

echo.
:: 3. Cai dat thu vien live-server
echo [3/4] Dang cai dat thu vien TikTok Live Server...
cd live-server
call npm install
cd ..
if %errorlevel% neq 0 (
    echo [!] Co loi xay ra khi cai dat live-server.
    pause
    exit /b
)

echo.
:: 4. Build giao dien
echo [4/4] Dang bien dich giao dien Ho ca (npm run build)...
call npm run build
if %errorlevel% neq 0 (
    echo [!] Co loi xay ra khi bien dich giao dien.
    pause
    exit /b
)

echo.
echo ========================================================
echo          CAI DAT HOAN TAT THANH CONG 100%!
echo ========================================================
echo.
echo Tu bay gio ban chi can nhap dup chuot vao file "run-live.bat" de chay live!
echo.
set /p START_NOW="Ban co muon khoi chay server luon bay gio khong? (Y/N): "
if /i "%START_NOW%"=="Y" (
    start run-live.bat
)
pause
