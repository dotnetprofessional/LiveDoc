<#
.SYNOPSIS
    Packages the LiveDoc Viewer for distribution.

.DESCRIPTION
    Creates distribution artifacts for the viewer:
    - npm tarball (.tgz) via pnpm pack
    - Standalone executable (.exe) for Windows [FUTURE]

    All output goes to ./releases/@swedevtools/livedoc-viewer/

.EXAMPLE
    .\pack-viewer.ps1
    Pack the viewer npm tarball.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$viewerDir = Join-Path $repoRoot 'packages\viewer'

if (-not (Test-Path $viewerDir)) {
    Write-Host "Error: Viewer package not found at $viewerDir" -ForegroundColor Red
    exit 1
}

# Read package info
$pkgJson = Get-Content (Join-Path $viewerDir 'package.json') -Raw | ConvertFrom-Json
$packageName = $pkgJson.name
$version = $pkgJson.version

Write-Host ""
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Packing: $packageName@$version" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Cyan

# Create output directory
$outputDir = Join-Path $repoRoot 'releases\@swedevtools\livedoc-viewer'
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# 1. npm tarball
Write-Host "`n→ Creating npm tarball..." -ForegroundColor White
Push-Location $viewerDir
try {
    pnpm pack
    if ($LASTEXITCODE -ne 0) {
        throw "pnpm pack failed"
    }

    # Move .tgz to output dir
    $tgzFiles = Get-ChildItem -Path $viewerDir -Filter "*.tgz"
    foreach ($tgz in $tgzFiles) {
        Move-Item -Path $tgz.FullName -Destination $outputDir -Force
        Write-Host "  ✓ $($tgz.Name)" -ForegroundColor Green
    }
} finally {
    Pop-Location
}

# 2. Standalone executable [FUTURE]
# TODO: Bundle viewer server + client into standalone .exe for Windows
# Options to evaluate:
#   - Node.js SEA (Single Executable Application) - built-in, requires Node 20+
#   - pkg (vercel/pkg) - mature but ESM support is limited
#   - esbuild bundle + sea-config.json - lightweight approach
#   - nexe - alternative to pkg
# The exe should:
#   - Embed the built React client assets
#   - Run the Express/Fastify server on a configurable port
#   - Support winget distribution (MSIX packaging) as a future step
Write-Host "`n→ Standalone exe: not yet implemented (future phase)" -ForegroundColor DarkGray

# List output
Write-Host ""
$artifacts = Get-ChildItem -Path $outputDir -File
if ($artifacts.Count -gt 0) {
    Write-Host "✓ Artifacts in $outputDir`:" -ForegroundColor Green
    foreach ($a in $artifacts) {
        Write-Host "  - $($a.Name)" -ForegroundColor Gray
    }
} else {
    Write-Host "✗ No artifacts found." -ForegroundColor Red
}
