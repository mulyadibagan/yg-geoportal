param(
  [Parameter(Mandatory = $false)]
  [switch]$Online,

  [Parameter(Mandatory = $false)]
  [string]$Message = "",

  [Parameter(Mandatory = $false)]
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

if (-not $Online) {
  Write-Host "[PUBLISH] Dibatalkan: gunakan flag -Online untuk mengizinkan push ke GitHub."
  Write-Host '[PUBLISH] Contoh: powershell -ExecutionPolicy Bypass -File .\scripts\publish-changes.ps1 -Online -Message "deskripsi perubahan"'
  exit 0
}

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

Write-Host "[CHECK] Menjalankan pre-check sebelum commit/push..."

$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($currentBranch -ne $Branch) {
  throw "Branch aktif '$currentBranch' tidak sama dengan target '$Branch'. Pindah branch dulu."
}

git fetch origin $Branch --prune
$behind = [int](git rev-list --count "HEAD..origin/$Branch")
if ($behind -gt 0) {
  throw "Branch lokal tertinggal $behind commit dari origin/$Branch. Sinkronkan dulu sebelum push."
}

# Get a list of all changed files for the conflict marker check
$changedFiles = @(
  $pending |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    ForEach-Object {
      $line = $_
      $fileName = $line.Substring(3).Trim()
      # For renames (e.g., "R  old -> new"), extract both old and new paths
      if ($line.StartsWith("R")) {
        $fileName -split ' -> '
      } else {
        $fileName
      }
    } |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
) | Select-Object -Unique

# Get a list of files to check for sensitive content, excluding deletions.
$filesToCheckForBlock = @(
    $pending |
    # Exclude lines for deleted files. Status for deletion is 'D ' (staged) or ' D' (unstaged).
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and $_.Substring(0, 1) -ne 'D' -and $_.Substring(1, 1) -ne 'D' } |
    ForEach-Object {
        $line = $_
        $fileName = $line.Substring(3).Trim()
        # For renames (e.g., "R  old -> new"), check only the new path.
        if ($line.StartsWith("R")) {
            ($fileName -split ' -> ')[1]
        } else {
            $fileName
        }
    } |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
) | Select-Object -Unique

$blockedPattern = '(?i)(^|[\\/])\.env(\..+)?$|\.pem$|\.key$|id_rsa|id_dsa|credentials|secret|tmp-.*\.txt$|\.tmp$'
$blockedFiles = @($filesToCheckForBlock | Where-Object { $_ -match $blockedPattern })
if ($blockedFiles.Count -gt 0) {
  Write-Host "[CHECK] File sensitif terdeteksi:"
  $blockedFiles | ForEach-Object { Write-Host " - $_" }
  throw "Push diblokir karena ada file sensitif pada perubahan lokal."
}

$hasConflictMarkers = $false
if ($changedFiles.Count -gt 0 -and (Get-Command rg -ErrorAction SilentlyContinue)) {
  rg -n "^(<<<<<<<|=======|>>>>>>>)" -- $changedFiles | Out-Null
  if ($LASTEXITCODE -eq 0) {
    $hasConflictMarkers = $true
  }
}
elseif ($changedFiles.Count -gt 0) {
  $grepResult = git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- $changedFiles
  if (-not [string]::IsNullOrWhiteSpace(($grepResult | Out-String))) {
    $hasConflictMarkers = $true
  }
}

if ($hasConflictMarkers) {
  throw "Ditemukan conflict marker (<<<<<<< ======= >>>>>>>) di file yang diubah. Selesaikan dulu."
}

Write-Host "[CHECK] Lolos pre-check."

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