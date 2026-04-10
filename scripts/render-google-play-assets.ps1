$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $projectRoot 'public-release-pages\google-play-assets'
$outputPath = Join-Path $sourceDir 'feature-graphic-1024x500.png'
$edgeCandidates = @(
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
  'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
)

$edgePath = $edgeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $edgePath) {
  throw 'Microsoft Edge was not found in a standard install location.'
}

$sourcePath = Join-Path $sourceDir 'feature-graphic.html'
if (-not (Test-Path -LiteralPath $sourcePath)) {
  throw "Feature graphic source file was not found at $sourcePath."
}

if (Test-Path -LiteralPath $outputPath) {
  Remove-Item -LiteralPath $outputPath -Force
}

$sourceUri = [System.Uri]::new($sourcePath).AbsoluteUri
$edgeArgs = @(
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--allow-file-access-from-files',
  '--run-all-compositor-stages-before-draw',
  '--virtual-time-budget=2500',
  '--window-size=1024,500',
  "--screenshot=$outputPath",
  $sourceUri
)

& $edgePath @edgeArgs | Out-Null

if (-not (Test-Path -LiteralPath $outputPath)) {
  throw "Edge did not produce the expected feature graphic: $outputPath"
}

Write-Host "Rendered feature graphic to $outputPath"
