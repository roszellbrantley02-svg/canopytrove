$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $projectRoot 'public-release-pages\store-screenshots'
$outputDir = Join-Path $sourceDir 'rendered'
$edgeCandidates = @(
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
  'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
)

$edgePath = $edgeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $edgePath) {
  throw 'Microsoft Edge was not found in a standard install location.'
}

if (-not (Test-Path -LiteralPath $sourceDir)) {
  throw "Screenshot source directory was not found at $sourceDir."
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$screens = @(
  '01-discovery.html',
  '02-confidence.html',
  '03-detail.html',
  '04-profile.html',
  '05-review.html',
  '06-owner.html'
)

foreach ($screen in $screens) {
  $sourcePath = Join-Path $sourceDir $screen

  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Missing screenshot source: $sourcePath"
  }

  $outputPath = Join-Path $outputDir (($screen -replace '\.html$', '') + '.png')
  $sourceUri = [System.Uri]::new($sourcePath).AbsoluteUri

  if (Test-Path -LiteralPath $outputPath) {
    Remove-Item -LiteralPath $outputPath -Force
  }

  $edgeArgs = @(
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--allow-file-access-from-files',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=2500',
    '--window-size=1290,2796',
    "--screenshot=$outputPath",
    $sourceUri
  )

  & $edgePath @edgeArgs | Out-Null

  if (-not (Test-Path -LiteralPath $outputPath)) {
    throw "Edge did not produce the expected screenshot: $outputPath"
  }
}

Write-Host "Rendered screenshots to $outputDir"
