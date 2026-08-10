@echo off
REM ============================================================
REM quick-restart.bat — relanza frontend + API si se cayeron los procesos
REM Uso: doble click en el archivo o ejecutar desde terminal.
REM Logs quedan en %TEMP%\opencode\{api,web}.log
REM ============================================================

setlocal EnableDelayedExpansion

set ROOT=C:\Users\mateo\Documents\Nexa CRM
set LOGDIR=%TEMP%\opencode
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

echo === Liberando puertos 3000 / 4000 si están ocupados ===
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4000.*LISTENING') do (taskkill /F /PID %%a 1>nul 2>&1)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000.*LISTENING') do (taskkill /F /PID %%a 1>nul 2>&1)
timeout /t 3 /nobreak >nul

echo.
echo === Arancando API en :4000 ===
start "neva-api" /min cmd /k "cd /d %ROOT%\apps\api && node dist\main.js 1>%LOGDIR%\api.log 2>&1"
timeout /t 5 /nobreak >nul

echo.
echo === Arancando Frontend en :3000 ===
start "neva-web" /min cmd /k "cd /d %ROOT%\apps\web && npm run dev 1>%LOGDIR%\web.log 2>&1"

echo.
echo Esperando que Next.js termine de compilar...
timeout /t 20 /nobreak >nul

echo.
echo === Sanity checks ===
curl -s -o NUL -w "Frontend :3000 -> HTTP %%{http_code}\n" http://localhost:3000/
curl -s -o NUL -w "API      :4000 -> HTTP %%{http_code}\n" http://localhost:4000/api/v1/webhooks/whatsapp/incoming

echo.
echo Para parar todo: taskkill /F /IM node.exe
pause
endlocal
