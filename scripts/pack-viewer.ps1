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

function Ensure-RuntimeDepsPresent {
    param(
        [string]$ViewerDir,
        [object]$PkgJson
    )

    $depsToBundle = @('commander', 'hono', '@hono/node-server', 'ws', 'zod', 'open')
    $missing = @()

    foreach ($dep in $depsToBundle) {
        $relative = "node_modules\" + $dep.Replace('/', '\')
        $depPath = Join-Path $ViewerDir $relative
        $manifestPath = Join-Path $depPath 'package.json'
        if (-not (Test-Path $manifestPath)) {
            $missing += $dep
        }
    }

    if ($missing.Count -eq 0) {
        return
    }

    Write-Host "`n→ Materializing runtime deps for bundling..." -ForegroundColor White
    $stageDir = Join-Path ([System.IO.Path]::GetTempPath()) 'livedoc-viewer-pack-runtime-deps'
    if (Test-Path $stageDir) {
        Remove-Item -Path $stageDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

    $installArgs = @('install', '--prefix', $stageDir, '--no-package-lock', '--no-audit', '--fund', 'false')
    foreach ($dep in $missing) {
        $depVersion = $PkgJson.dependencies.PSObject.Properties[$dep].Value
        if (-not $depVersion) {
            throw "Dependency '$dep' is missing from $($PkgJson.name) dependencies."
        }
        $installArgs += "$dep@$depVersion"
    }

    & npm @installArgs
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed when materializing runtime dependencies."
    }

    foreach ($dep in $missing) {
        $relative = "node_modules\" + $dep.Replace('/', '\')
        $src = Join-Path $stageDir $relative
        $dest = Join-Path $ViewerDir $relative

        if (-not (Test-Path $src)) {
            throw "Expected dependency folder not found: $src"
        }

        $destParent = Split-Path -Path $dest -Parent
        if (-not (Test-Path $destParent)) {
            New-Item -ItemType Directory -Path $destParent -Force | Out-Null
        }

        if (Test-Path $dest) {
            Remove-Item -Path $dest -Recurse -Force
        }

        Copy-Item -Path $src -Destination $dest -Recurse -Force
        Write-Host "  ✓ hydrated $dep" -ForegroundColor Green
    }

    Remove-Item -Path $stageDir -Recurse -Force -ErrorAction SilentlyContinue
}

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
    Ensure-RuntimeDepsPresent -ViewerDir $viewerDir -PkgJson $pkgJson
    pnpm pack --config.node-linker=hoisted
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
