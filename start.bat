@echo off
start "Nexa API" cmd /c "cd /d C:\Users\mateo\Documents\Nexa CRM\apps\api && pnpm start:dev"
start "Nexa Web" cmd /c "cd /d C:\Users\mateo\Documents\Nexa CRM\apps\web && pnpm dev"
echo Both servers started.
