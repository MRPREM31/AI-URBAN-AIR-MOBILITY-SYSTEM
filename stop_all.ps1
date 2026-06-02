# stop_all.ps1
# This script stops all running services of the Urban Air Taxi AI System

Write-Host "Stopping Urban Air Taxi AI System..." -ForegroundColor Yellow

# 1. Stop React Dashboard (Port 5173)
try {
    $dashboardConn = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
    if ($dashboardConn) {
        $dashPid = $dashboardConn.OwningProcess[0]
        Write-Host "Stopping Dashboard (PID: $dashPid)..." -ForegroundColor Blue
        Stop-Process -Id $dashPid -Force -ErrorAction SilentlyContinue
    }
} catch {}

# 2. Stop API Bridge (Port 8000)
try {
    $apiConn = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
    if ($apiConn) {
        $apiPid = $apiConn.OwningProcess[0]
        Write-Host "Stopping API Bridge (PID: $apiPid)..." -ForegroundColor Green
        Stop-Process -Id $apiPid -Force -ErrorAction SilentlyContinue
    }
} catch {}

# 3. Stop Python processes running main.py and api.py
try {
    $pythonProcs = Get-Process python -ErrorAction SilentlyContinue
    foreach ($proc in $pythonProcs) {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
        if ($cmdLine -like "*main.py*" -or $cmdLine -like "*api.py*") {
            Write-Host "Stopping Python Process (PID: $($proc.Id))..." -ForegroundColor Cyan
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }
} catch {}

Write-Host "`nALL SYSTEMS STOPPED!" -ForegroundColor Magenta
