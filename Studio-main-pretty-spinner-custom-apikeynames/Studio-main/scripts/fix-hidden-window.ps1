# Quick fix to make auto-sync run hidden (no flashing window)
# Right-click this file → "Run with PowerShell as Administrator"

Write-Host "Updating DeepFish-GitSync to run hidden..." -ForegroundColor Cyan

schtasks /delete /tn "DeepFish-GitSync" /f 2>$null
schtasks /create /tn "DeepFish-GitSync" /xml "C:\REPOS\DF.1.251216.2033\scripts\git-auto-sync-task.xml"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDone! No more flashing windows." -ForegroundColor Green
}
else {
    Write-Host "`nFailed - make sure you're running as Administrator" -ForegroundColor Red
}

Read-Host "Press Enter to close"
