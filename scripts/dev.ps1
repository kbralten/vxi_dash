# Runs backend and frontend dev servers in separate PowerShell windows.
$backendPath = Join-Path $PSScriptRoot "..\backend"
$frontendPath = Join-Path $PSScriptRoot "..\frontend"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$backendPath'; poetry run uvicorn app.main:app --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendPath'; npm run dev"
