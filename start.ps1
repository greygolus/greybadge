$ErrorActionPreference = 'Stop'
$url = 'http://localhost:8765'
Set-Location $PSScriptRoot
if (-not (Test-Path (Join-Path $PSScriptRoot 'node_modules'))) { npm install }
Write-Host 'BadgeBetter is starting...'
Write-Host 'Keep this window open while using the app. Press Ctrl+C to stop it.'
Start-Process $url
npm run dev
