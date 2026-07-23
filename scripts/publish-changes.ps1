param(
  [Parameter(Mandatory = $false)]
  [string]$Message = "",

  [Parameter(Mandatory = $false)]
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

$repoPath = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoPath

if (-not (Test-Path (Join-Path $repoPath ".git"))) {
  throw "Folder ini bukan git repository: $repoPath"
}

$pending = git status --porcelain
if ([string]::IsNullOrWhiteSpace(($pending | Out-String))) {
  Write-Host "[PUBLISH] Tidak ada perubahan untuk dipush."
  git status -sb
  exit 0
}

if ([string]::IsNullOrWhiteSpace($Message)) {
  $Message = "update: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}

Write-Host "[PUBLISH] Menambahkan perubahan..."
git add -A

Write-Host "[PUBLISH] Commit: $Message"
git commit -m $Message

Write-Host "[PUBLISH] Push ke origin/$Branch..."
git push origin $Branch

Write-Host "[PUBLISH] Selesai. Status terbaru:"
git status -sb
Write-Host "[PUBLISH] Commit terbaru:"
git log --oneline -n 3