Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c ""cd /d C:\Users\mateo\Documents\Nexa CRM\apps\api && pnpm start:dev""", 0, False
WshShell.Run "cmd /c ""cd /d C:\Users\mateo\Documents\Nexa CRM\apps\web && pnpm dev""", 0, False
