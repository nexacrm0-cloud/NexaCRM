$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== Nexa CRM - Inicio Rapido ===" -ForegroundColor Cyan

# 1. Verificar Docker
docker ps 2>$null | Out-Null
if (-not $?) {
    Write-Host "[ERROR] Docker no esta corriendo." -ForegroundColor Red
    Write-Host "  Abri Docker Desktop e intenta de nuevo." -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Docker corriendo" -ForegroundColor Green

# 2. Levantar contenedores
docker compose -f "$ROOT\docker-compose.yml" up -d 2>$null
if ($?) { Write-Host "[OK] Contenedores listos (PostgreSQL :5433, Redis :6379)" -ForegroundColor Green }

# 3. Iniciar servidores
Write-Host "[...] Iniciando API (puerto 4000)..." -ForegroundColor Yellow
$apiJob = Start-Job -ScriptBlock {
    param($dir) npm run --prefix "$dir\apps\api" start:dev
} -ArgumentList $ROOT

Start-Sleep 2

Write-Host "[...] Iniciando Web (puerto 3000)..." -ForegroundColor Yellow
$webJob = Start-Job -ScriptBlock {
    param($dir) npm run --prefix "$dir\apps\web" dev
} -ArgumentList $ROOT

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  API:  http://localhost:4000" -ForegroundColor Green
Write-Host "  Web:  http://localhost:3000" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "`nPresiona Ctrl+C para detener todo.`n" -ForegroundColor Gray

try {
    Wait-Job $apiJob, $webJob
} finally {
    Write-Host "[...] Deteniendo servidores..." -ForegroundColor Yellow
    Stop-Job $apiJob, $webJob -ErrorAction SilentlyContinue
    Remove-Job $apiJob, $webJob -ErrorAction SilentlyContinue
    Write-Host "[OK] Servidores detenidos" -ForegroundColor Green
}
