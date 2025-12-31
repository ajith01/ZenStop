$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$manifestPath = Join-Path $root "manifest.json"
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version = $manifest.version

$distDir = Join-Path $root "dist"
$tempDir = Join-Path $distDir "_package"
$zipName = "ZenStop-$version.zip"
$zipPath = Join-Path $distDir $zipName

if (Test-Path $tempDir) {
  Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $distDir | Out-Null
New-Item -ItemType Directory -Path $tempDir | Out-Null

Copy-Item $manifestPath $tempDir
Copy-Item (Join-Path $root "assets") -Destination (Join-Path $tempDir "assets") -Recurse
Copy-Item (Join-Path $root "src") -Destination (Join-Path $tempDir "src") -Recurse

if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}
Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $zipPath
Remove-Item $tempDir -Recurse -Force

Write-Host "Package created at $zipPath"
