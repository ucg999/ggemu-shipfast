param(
  [string]$Bucket = "ucg999-game-assets",
  [string]$RemoteBaseUrl = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$fcAssetRoot = (Resolve-Path (Join-Path $projectRoot "public/fc-player/assets")).Path
$gbAssetRoot = (Resolve-Path (Join-Path $projectRoot "public/gb-player/assets")).Path

function Send-R2File {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$ObjectKey,
    [Parameter(Mandatory = $true)][string]$ContentType
  )

  if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
    throw "Missing asset: $Source"
  }

  & pnpm exec wrangler r2 object put "$Bucket/$ObjectKey" --file $Source --content-type $ContentType --remote
  if ($LASTEXITCODE -ne 0) {
    throw "Upload failed: $ObjectKey"
  }
}

Get-ChildItem -LiteralPath $fcAssetRoot -Filter "*.nes" -File | Sort-Object Name | ForEach-Object {
  Send-R2File -Source $_.FullName -ObjectKey "fc/roms/$($_.Name)" -ContentType "application/octet-stream"
}

$gbRomRoot = Join-Path $gbAssetRoot "roms"
Get-ChildItem -LiteralPath $gbRomRoot -File | Sort-Object Name | ForEach-Object {
  Send-R2File -Source $_.FullName -ObjectKey "gb/roms/$($_.Name)" -ContentType "application/octet-stream"
}

foreach ($videoName in @("gb-boot.mp4", "gbc-boot.mp4")) {
  Send-R2File -Source (Join-Path $gbAssetRoot $videoName) -ObjectKey "gb/video/$videoName" -ContentType "video/mp4"
}

Write-Host "Uploaded FC and GB game assets to R2 bucket '$Bucket'."
if ($RemoteBaseUrl) {
  Write-Host "Set assetBase in both player config files to: $($RemoteBaseUrl.TrimEnd('/'))"
}
