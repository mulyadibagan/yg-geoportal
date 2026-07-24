param(
  [Parameter(Mandatory = $false)]
  [string]$ProjectDir = "",

  [Parameter(Mandatory = $false)]
  [string]$DeploymentId = "",

  [Parameter(Mandatory = $false)]
  [string]$VersionDescription = "",

  [Parameter(Mandatory = $false)]
  [string]$DeploymentDescription = "",

  [Parameter(Mandatory = $false)]
  [switch]$CreateIfMissing
)

$ErrorActionPreference = "Stop"

$repoPath = Resolve-Path (Join-Path $PSScriptRoot "..")

if ([string]::IsNullOrWhiteSpace($ProjectDir)) {
  $ProjectDir = Join-Path $repoPath "apps-script\webgis-backend"
}

if (-not (Test-Path $ProjectDir)) {
  throw "ProjectDir tidak ditemukan: $ProjectDir"
}

if (-not (Get-Command clasp -ErrorAction SilentlyContinue)) {
  throw "clasp belum terpasang. Install dulu: npm install -g @google/clasp"
}

if ([string]::IsNullOrWhiteSpace($DeploymentId)) {
  if (-not [string]::IsNullOrWhiteSpace($env:APPS_SCRIPT_DEPLOYMENT_ID)) {
    $DeploymentId = $env:APPS_SCRIPT_DEPLOYMENT_ID
  }
}

if ([string]::IsNullOrWhiteSpace($DeploymentId)) {
  # Deployment ID aktif yang saat ini dipakai endpoint frontend repo ini.
  $DeploymentId = "AKfycbxUe4QyBvSiL9UJsL-nsJ5XrohDabwqhYYR9q5CTgLYiW1ZCfVy429iMlpU-lCDUSvvRg"
}

if ([string]::IsNullOrWhiteSpace($VersionDescription)) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $head = ""
  try {
    Set-Location $repoPath
    $head = (git rev-parse --short HEAD).Trim()
  } catch {
    $head = ""
  }

  if ([string]::IsNullOrWhiteSpace($head)) {
    $VersionDescription = "auto deploy $stamp"
  } else {
    $VersionDescription = "auto deploy $stamp (git $head)"
  }
}

if ([string]::IsNullOrWhiteSpace($DeploymentDescription)) {
  $DeploymentDescription = $VersionDescription
}

Write-Host "[DEPLOY] Repo: $repoPath"
Write-Host "[DEPLOY] Apps Script project: $ProjectDir"
Write-Host "[DEPLOY] Deployment ID target: $DeploymentId"

Set-Location $ProjectDir

Write-Host "[DEPLOY] Menjalankan deploy (autentikasi akan divalidasi saat push)..."

Write-Host "[DEPLOY] Push source ke Apps Script..."
clasp push | Out-Host

Write-Host "[DEPLOY] Buat versi baru..."
clasp version "$VersionDescription" | Out-Host

Write-Host "[DEPLOY] Update deployment..."
$deployOutput = ""
try {
  $deployOutput = clasp deploy --deploymentId $DeploymentId --description "$DeploymentDescription" 2>&1 | Out-String
  $deployOutput.Trim() | Write-Host
} catch {
  if (-not $CreateIfMissing) {
    throw
  }

  Write-Host "[DEPLOY] Deployment ID tidak ditemukan. Membuat deployment baru..."
  $deployOutput = clasp deploy --description "$DeploymentDescription" 2>&1 | Out-String
  $deployOutput.Trim() | Write-Host
}

$foundIds = @([regex]::Matches($deployOutput, "AKfy[a-zA-Z0-9_-]+") | ForEach-Object { $_.Value } | Select-Object -Unique)
if ($foundIds.Count -gt 0) {
  Write-Host "[DEPLOY] Deployment aktif: $($foundIds[0])"
  Write-Host "[DEPLOY] Web App URL: https://script.google.com/macros/s/$($foundIds[0])/exec"
}

Write-Host "[DEPLOY] Selesai."
