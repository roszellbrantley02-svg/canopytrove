param(
  [string]$ApiBaseUrl,
  [ValidateSet('mock', 'firestore')]
  [string]$BackendSource = 'mock'
)

$ErrorActionPreference = 'Stop'

function Get-PreferredLocalIp {
  $candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike '169.254.*' -and
      $_.IPAddress -ne '127.0.0.1' -and
      $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Virtual'
    }

  if ($candidates) {
    return ($candidates | Select-Object -First 1 -ExpandProperty IPAddress)
  }

  return '127.0.0.1'
}

$rootDir = Split-Path -Parent $PSScriptRoot
$backendScript = Join-Path $PSScriptRoot 'start-backend.ps1'

if (-not $ApiBaseUrl) {
  $ApiBaseUrl = "http://$(Get-PreferredLocalIp):4100"
}

Write-Host "Using API base URL: $ApiBaseUrl"
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-ExecutionPolicy', 'Bypass',
  '-File', $backendScript,
  '-Source', $BackendSource
)

Set-Location $rootDir
$env:EXPO_PUBLIC_STOREFRONT_SOURCE = 'api'
$env:EXPO_PUBLIC_STOREFRONT_API_BASE_URL = $ApiBaseUrl

Write-Host "Starting Expo in api mode..."
cmd /c npm start
