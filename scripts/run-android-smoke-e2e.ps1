param(
  [string]$AppId = 'com.rezell.canopytrove',
  [string]$ApkPath = '',
  [switch]$InstallApk,
  [switch]$ResetData,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outputDir = Join-Path $repoRoot 'build-artifacts\e2e'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$remoteScreenshot = '/sdcard/canopytrove-smoke.png'
$remoteUiDump = '/sdcard/canopytrove-smoke.xml'
$localScreenshot = Join-Path $outputDir "android-smoke-$timestamp.png"
$localUiDump = Join-Path $outputDir "android-smoke-$timestamp.xml"
$expectedMarkers = @(
  'Adults 21+',
  'Before you continue',
  'Yes, I am 21 or older',
  'Browse',
  'Nearby',
  'Profile'
)

function Invoke-AdbCommand {
  param(
    [string[]]$Arguments
  )

  if ($DryRun) {
    Write-Host ("DRY RUN adb {0}" -f ($Arguments -join ' '))
    return ''
  }

  $output = & adb @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ("adb {0} failed:`n{1}" -f ($Arguments -join ' '), ($output -join [Environment]::NewLine))
  }

  return ($output -join [Environment]::NewLine)
}

if (-not $DryRun -and -not (Get-Command adb -ErrorAction SilentlyContinue)) {
  throw 'adb is required for the Android smoke E2E lane.'
}

if ($DryRun) {
  Write-Host 'Dry run mode skips adb availability checks.'
}

if (-not $ApkPath) {
  $ApkPath = $env:ANDROID_E2E_APK_PATH
}

$resolvedApkPath = $null
if ($ApkPath) {
  $resolvedApkPath = (Resolve-Path $ApkPath).Path
}

if ($InstallApk -and -not $resolvedApkPath) {
  throw 'Pass -ApkPath or set ANDROID_E2E_APK_PATH when using -InstallApk.'
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

Write-Host 'Waiting for Android device or emulator...'
Invoke-AdbCommand -Arguments @('wait-for-device') | Out-Null

if ($InstallApk -and $resolvedApkPath) {
  Write-Host ("Installing APK: {0}" -f $resolvedApkPath)
  Invoke-AdbCommand -Arguments @('install', '-r', $resolvedApkPath) | Out-Null
}

if ($ResetData) {
  Write-Host ("Clearing app data for {0}" -f $AppId)
  Invoke-AdbCommand -Arguments @('shell', 'pm', 'clear', $AppId) | Out-Null
}

Write-Host ("Force stopping {0}" -f $AppId)
Invoke-AdbCommand -Arguments @('shell', 'am', 'force-stop', $AppId) | Out-Null

Write-Host ("Launching {0}" -f $AppId)
Invoke-AdbCommand -Arguments @('shell', 'monkey', '-p', $AppId, '-c', 'android.intent.category.LAUNCHER', '1') | Out-Null

if (-not $DryRun) {
  Start-Sleep -Seconds 6
}

Write-Host 'Capturing screenshot and UI dump...'
Invoke-AdbCommand -Arguments @('shell', 'rm', '-f', $remoteScreenshot, $remoteUiDump) | Out-Null
Invoke-AdbCommand -Arguments @('shell', 'screencap', '-p', $remoteScreenshot) | Out-Null
Invoke-AdbCommand -Arguments @('pull', $remoteScreenshot, $localScreenshot) | Out-Null
Invoke-AdbCommand -Arguments @('shell', 'uiautomator', 'dump', $remoteUiDump) | Out-Null
Invoke-AdbCommand -Arguments @('pull', $remoteUiDump, $localUiDump) | Out-Null

if ($DryRun) {
  Write-Host 'Dry run completed.'
  return
}

$uiDump = Get-Content -Raw $localUiDump
$matchedMarker = $expectedMarkers | Where-Object { $uiDump.Contains($_) } | Select-Object -First 1

if (-not $matchedMarker) {
  throw ("Smoke launch completed but none of the expected markers were found in {0}." -f $localUiDump)
}

Write-Host ("Smoke lane passed. Detected marker: {0}" -f $matchedMarker)
Write-Host ("Screenshot: {0}" -f $localScreenshot)
Write-Host ("UI dump: {0}" -f $localUiDump)
