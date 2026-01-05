# 🚀 DeepFish Dashboard Launcher
# Opens all relevant project consoles in the default browser

$dashboards = @{
    "Railway Project"       = "https://railway.app/project/f963172f-253c-42b2-9406-04167aaf4c5a"
    "Anthropic Console"     = "https://console.anthropic.com/"
    "Google AI Studio"      = "https://aistudio.google.com/"
    "NVIDIA NIM"            = "https://build.nvidia.com/explore"
    "ElevenLabs"            = "https://elevenlabs.io/app/voice-lab"
    "Twilio Console"        = "https://console.twilio.com/"
    "Stripe Dashboard"      = "https://dashboard.stripe.com/"
    "Localhost (Frontend)"  = "http://localhost:5173"
    "Localhost (Backend)"   = "http://localhost:3001"
}

Write-Host "🌊 Opening DeepFish Dashboards..." -ForegroundColor Cyan

foreach ($name in $dashboards.Keys) {
    $url = $dashboards[$name]
    Write-Host "   Opening $name..." -ForegroundColor Gray
    Start-Process $url
}

Write-Host "✅ Done! Please log in to each service if needed." -ForegroundColor Green
