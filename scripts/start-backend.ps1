param(
  [ValidateSet('mock', 'firestore')]
  [string]$Source = 'mock'
)

$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $rootDir 'backend'

Set-Location $backendDir
$env:STOREFRONT_BACKEND_SOURCE = $Source

Write-Host "Starting CanopyTrove backend in $Source mode..."
cmd /c npx tsx src/server.ts
