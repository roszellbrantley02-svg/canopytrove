param(
  [string]$OutputRoot = "$env:USERPROFILE\.canopytrove-secrets\android-upload-key",
  [string]$PackageName = "com.rezell.canopytrove",
  [string]$AppName = "Canopy Trove",
  [string]$Organization = "Canopy Trove",
  [string]$CountryCode = "US",
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

function New-RandomSecret {
  param([int]$Bytes = 24)

  $buffer = New-Object byte[] $Bytes
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($buffer)
  } finally {
    $rng.Dispose()
  }
  return [Convert]::ToBase64String($buffer).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Protect-PathForCurrentUser {
  param([string]$TargetPath)

  $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls $TargetPath /inheritance:r /grant:r "${currentUser}:(OI)(CI)F" /T | Out-Null
}

if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) {
  throw 'keytool was not found on PATH. Install a JDK before generating a new Android upload key.'
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$artifactDir = Join-Path $OutputRoot $timestamp

if ((Test-Path $artifactDir) -and -not $Force) {
  throw "Output directory already exists: $artifactDir"
}

New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

$alias = "upload-$timestamp"
$keystorePassword = New-RandomSecret
$keyPassword = New-RandomSecret
$keystorePath = Join-Path $artifactDir 'upload-keystore.jks'
$certificatePath = Join-Path $artifactDir 'upload-certificate.pem'
$metadataPath = Join-Path $artifactDir 'metadata.json'
$secretPath = Join-Path $artifactDir 'secrets.clixml'
$notesPath = Join-Path $artifactDir 'next-steps.txt'
$distinguishedName = "CN=$AppName Upload Key, OU=Mobile, O=$Organization, L=New York, S=New York, C=$CountryCode"

& keytool `
  -genkeypair `
  -storetype JKS `
  -keystore $keystorePath `
  -storepass $keystorePassword `
  -keypass $keyPassword `
  -alias $alias `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -dname $distinguishedName `
  -noprompt | Out-Null

& keytool `
  -export `
  -rfc `
  -keystore $keystorePath `
  -storepass $keystorePassword `
  -alias $alias `
  -file $certificatePath `
  -noprompt | Out-Null

$fingerprintLine = & keytool `
  -list `
  -v `
  -keystore $keystorePath `
  -storepass $keystorePassword `
  -alias $alias |
  Select-String 'SHA256:' |
  Select-Object -First 1

$sha256Fingerprint = $null
if ($fingerprintLine) {
  $sha256Fingerprint = ($fingerprintLine.Line -replace '^\s*SHA256:\s*', '').Trim()
}

[pscustomobject]@{
  createdAt = (Get-Date).ToString('o')
  packageName = $PackageName
  alias = $alias
  keystorePath = $keystorePath
  certificatePath = $certificatePath
  sha256Fingerprint = $sha256Fingerprint
  distinguishedName = $distinguishedName
} | ConvertTo-Json | Set-Content -Path $metadataPath

[pscustomobject]@{
  keystorePassword = (ConvertTo-SecureString $keystorePassword -AsPlainText -Force)
  keyPassword = (ConvertTo-SecureString $keyPassword -AsPlainText -Force)
} | Export-Clixml -Path $secretPath

@"
Android upload key artifacts were created for $PackageName.

Files:
- Keystore: $keystorePath
- Upload certificate PEM: $certificatePath
- Metadata: $metadataPath
- Password vault (DPAPI, current Windows user only): $secretPath

Recover the passwords later with:
`$secrets = Import-Clixml '$secretPath'
`$storePassword = [System.Net.NetworkCredential]::new('', `$secrets.keystorePassword).Password
`$keyPassword = [System.Net.NetworkCredential]::new('', `$secrets.keyPassword).Password

Next:
1. Request a Google Play upload key reset and attach $certificatePath.
2. After Google confirms the reset, update the Android keystore in EAS credentials.
"@ | Set-Content -Path $notesPath

Protect-PathForCurrentUser -TargetPath $artifactDir

Write-Host "Created Android upload key artifacts in $artifactDir"
Write-Host "Upload certificate: $certificatePath"
if ($sha256Fingerprint) {
  Write-Host "SHA-256 fingerprint: $sha256Fingerprint"
}
