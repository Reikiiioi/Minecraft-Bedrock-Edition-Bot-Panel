Write-Host "============================================" -ForegroundColor Cyan
Write-Host "       MineDDoS Bot Panel - Launch" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "[ERROR] Node.js not found. Install Node.js: https://nodejs.org/" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[*] Node.js found" -ForegroundColor Green
Write-Host ""

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path "$dir\node_modules")) {
    Write-Host "[*] Installing dependencies..." -ForegroundColor Yellow
    Push-Location $dir
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to install dependencies." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Pop-Location
    Write-Host "[OK] Dependencies installed." -ForegroundColor Green
    Write-Host ""
}

Push-Location $dir
Write-Host "[*] Starting panel..." -ForegroundColor Yellow
Write-Host ""
node start.js
Read-Host "Press Enter to exit"