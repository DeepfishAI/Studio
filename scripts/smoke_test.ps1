$url = "https://studio-production-adc1.up.railway.app/health"

Write-Host "Running Smoke Test on: $url" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✅ Status: $($response.status)" -ForegroundColor Green
    Write-Host "✅ Agents: Vesper ($($response.agents.vesper)), Mei ($($response.agents.mei))" -ForegroundColor Green
    Write-Host "✅ Timestamp: $($response.timestamp)" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Failed to connect: $($_.Exception.Message)" -ForegroundColor Red
}
