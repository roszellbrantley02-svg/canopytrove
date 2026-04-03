$ErrorActionPreference = 'Stop'

function Get-JavaMajorVersion {
  param(
    [Parameter(Mandatory = $true)]
    [string]$JavaHome
  )

  $releaseFile = Join-Path $JavaHome 'release'
  if (!(Test-Path $releaseFile)) {
    return $null
  }

  $line = Get-Content $releaseFile | Where-Object { $_ -match '^JAVA_VERSION=' } | Select-Object -First 1
  if (-not $line) {
    return $null
  }

  if ($line -match '"(?<major>\d+)') {
    return [int]$Matches.major
  }

  return $null
}

function Get-PreferredJavaHome {
  $candidates = @()

  if ($env:JAVA_HOME) {
    $candidates += $env:JAVA_HOME
  }

  $searchRoots = @(
    'C:\Program Files\Eclipse Adoptium',
    'C:\Program Files\Java'
  )

  foreach ($root in $searchRoots) {
    if (Test-Path $root) {
      $candidates += Get-ChildItem -Path $root -Directory -Filter 'jdk-*' |
        Sort-Object Name -Descending |
        Select-Object -ExpandProperty FullName
    }
  }

  foreach ($candidate in $candidates | Select-Object -Unique) {
    $major = Get-JavaMajorVersion -JavaHome $candidate
    if ($major -ge 21) {
      return $candidate
    }
  }

  return $null
}

$javaHome = Get-PreferredJavaHome
if (-not $javaHome) {
  Write-Error 'Firebase emulators require JDK 21 or newer. Install a compatible JDK or set JAVA_HOME to one before running this script.'
}

$env:JAVA_HOME = $javaHome
$env:Path = "$(Join-Path $javaHome 'bin');$env:Path"

$firebaseCli = Join-Path $PSScriptRoot '..\node_modules\.bin\firebase.cmd'
$vitestCommand = 'npx vitest run --config vitest.rules.config.ts'

& $firebaseCli emulators:exec --project demo-canopytrove --only firestore,storage $vitestCommand
exit $LASTEXITCODE
