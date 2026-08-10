@echo off
REM ============================================================
REM start-nexa.bat — Arranca toda la app (Docker + API + Web)
REM
REM Para uso diario. No cierra ni requiere intervención.
REM Logs en %TEMP%\opencode\: api.log, web.log, output
REM ============================================================

setlocal EnableDelayedExpansion
set ROOT=C:\Users\mateo\Documents\Nexa CRM
set LOGDIR=%TEMP%\opencode
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

title Nexa CRM Starter

echo =============================================================
echo   Nexa CRM Starter - %date% %time%
echo =============================================================

REM 1. Containers
echo.
echo [1/4] Verificando containers Docker...
where docker >nul 2>&1
if errorlevel 1 (
    echo Docker no esta corriendo. Arranca Docker Desktop y volve a ejecutar.
    pause
    exit /b 1
)
docker ps --filter "name=nexa-postgres" --format "{{.Status}}" 2>nul | findstr /C:"healthy" >nul
if errorlevel 1 (
    echo Levantando stack Docker...
    pushd "%ROOT%"
    docker compose up -d postgres redis n8n || (echo fallo docker compose & pause & exit /b 1)
    popd
    timeout /t 8 /nobreak >nul
)

REM 2. Liberar puertos
echo.
echo [2/4] Liberando puertos 3000 / 4000 si están ocupados...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4000.*LISTENING') do (taskkill /F /PID %%a 1>nul 2>&1)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000.*LISTENING') do (taskkill /F /PID %%a 1>nul 2>&1)
timeout /t 3 /nobreak >nul

REM 3. API
echo.
echo [3/4] Arrancando API NestJS ( : 4000 )...
if not exist "%ROOT%\apps\api\dist\main.js" (
    echo Construyendo...
    pushd "%ROOT%\apps\api"
    call npx nest build || (echo fallo build api & pause & exit /b 1)
    popd
)
start "neva-api" /min cmd /k "cd /d %ROOT%\apps\api && node dist\main.js 1>%LOGDIR%\api.log 2>&1"
timeout /t 5 /nobreak >nul

REM 4. Frontend
echo.
echo [4/4] Arrancando Frontend Next.js ( : 3000 )...
start "neva-web" /min cmd /k "cd /d %ROOT%\apps\web && npm run dev 1>%LOGDIR%\web.log 2>&1"

echo.
echo Esperando que Next.js compile (30s)...
timeout /t 30 /nobreak >nul

echo.
echo =============================================================
echo     Estado de los servicios
echo =============================================================
netstat -ano | findstr ":3000.*LISTENING" | head -1
netstat -ano | findstr ":4000.*LISTENING" | head -1
netstat -ano | findstr ":5678.*LISTENING" | head -1
echo.
curl -s -o NUL -w "Frontend :3000 -> HTTP %%{http_code}\n" http://localhost:3000/
curl -s -o NUL -w "API      :4000 -> HTTP %%{http_code}\n" http://localhost:4000/api/v1/webhooks/whatsapp/incoming
echo.
echo =============================================================
echo Listo. Creds default: admin@nexacrm.com / admin123
echo Para parar todo: taskkill /F /IM node.exe
echo =============================================================

REM Salvo estado de PID
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000,4000 -State Listen | Select-Object OwningProcess,LocalPort | ConvertTo-Json" > "%LOGDIR%\pidinfo.json" 2>nul

exit /b 0
endlocal
