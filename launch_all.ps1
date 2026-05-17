# launch_all.ps1
# This script starts the full Urban Air Taxi AI System

Write-Host "Starting Urban Air Taxi AI System..." -ForegroundColor Cyan

# 1. Start Python Simulation (Background)
Write-Host "Launching Simulation Engine (main.py)..." -ForegroundColor Yellow
Start-Process python -ArgumentList "main.py" -WindowStyle Minimized

# 2. Start API Bridge (Background)
Write-Host "Launching API Bridge (api.py)..." -ForegroundColor Green
Start-Process python -ArgumentList "api.py" -WindowStyle Minimized

# 3. Start React Dashboard
Write-Host "Launching Dashboard (React)..." -ForegroundColor Blue
Set-Location dashboard
Start-Process npm -ArgumentList "run dev -- --port 5173" -WindowStyle Minimized

Write-Host "`nALL SYSTEMS ARE RUNNING!" -ForegroundColor Magenta
Write-Host "----------------------------------"
Write-Host "Simulation: Running in background"
Write-Host "API: http://127.0.0.1:8000"
Write-Host "Dashboard: http://localhost:5173"
Write-Host "----------------------------------"
Write-Host "Wait 5 seconds for systems to initialize..."
Start-Sleep -Seconds 5

# Open browser to dashboard
Start-Process "http://localhost:5173"
