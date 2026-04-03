param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$statusLines = git -C $RepoRoot status --short

if (-not $statusLines) {
  Write-Output "Worktree is clean."
  exit 0
}

$entries = foreach ($line in $statusLines) {
  $change = $line.Substring(0, 2)
  $path = $line.Substring(3).Trim()

  if ($path -like '* -> *') {
    $path = ($path -split ' -> ')[-1].Trim()
  }

  $normalizedPath = $path -replace '\\', '/'
  $topLevel = ($normalizedPath -split '/')[0]

  [pscustomobject]@{
    Change = $change
    TopLevel = $topLevel
    Path = $normalizedPath
  }
}

$shortStat = git -C $RepoRoot diff --shortstat

Write-Output "Worktree summary for $RepoRoot"
Write-Output ""

if ($shortStat) {
  Write-Output $shortStat
  Write-Output ""
}

Write-Output "By change kind:"
$entries |
  Group-Object Change |
  Sort-Object Name |
  Select-Object @{Name = 'Change'; Expression = { $_.Name } }, Count |
  Format-Table -AutoSize

Write-Output ""
Write-Output "Top-level folders by touched files:"
$entries |
  Group-Object TopLevel |
  Sort-Object Count -Descending, Name |
  Select-Object @{Name = 'TopLevel'; Expression = { $_.Name } }, Count |
  Format-Table -AutoSize

Write-Output ""
Write-Output "Top-level folders by change kind:"
$entries |
  Group-Object TopLevel, Change |
  Sort-Object Count -Descending |
  Select-Object @{Name = 'TopLevel'; Expression = { ($_.Name -split ', ')[0] } }, @{Name = 'Change'; Expression = { ($_.Name -split ', ')[1] } }, Count |
  Format-Table -AutoSize

Write-Output ""
Write-Output "Sample touched paths:"
$entries |
  Sort-Object TopLevel, Path |
  Select-Object -First 40 Change, TopLevel, Path |
  Format-Table -AutoSize
