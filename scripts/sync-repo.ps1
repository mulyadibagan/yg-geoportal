param(
  [Parameter(Mandatory = $true)]
  [string]$RepoPath,

  [Parameter(Mandatory = $false)]
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $RepoPath)) {
  throw "RepoPath tidak ditemukan: $RepoPath"
}

Set-Location $RepoPath

$gitDir = Join-Path $RepoPath ".git"
if (-not (Test-Path $gitDir)) {
  throw "Folder bukan git repository: $RepoPath"
}

Write-Host "[SYNC] RepoPath: $RepoPath"
Write-Host "[SYNC] Branch: $Branch"

git fetch origin $Branch --prune

$behind = git rev-list --count "HEAD..origin/$Branch"
$ahead = git rev-list --count "origin/$Branch..HEAD"

Write-Host "[SYNC] Ahead: $ahead | Behind: $behind"

if ([int]$ahead -gt 0) {
  throw "Local branch punya commit sendiri (ahead $ahead). Stop untuk mencegah overwrite."
}

if ([int]$behind -eq 0) {
  Write-Host "[SYNC] Sudah sinkron. Tidak ada perubahan."
  git log --oneline -n 1
  exit 0
}

git pull --ff-only origin $Branch

Write-Host "[SYNC] Selesai pull fast-forward. Commit terbaru:"
git log --oneline -n 3