<#
.SYNOPSIS
    Publishes LiveDoc packages to npm.

.DESCRIPTION
    Publishes one or more packages to npm with support for dry-run, beta tags, and dependency ordering.

.PARAMETER Package
    Package to publish: schema, server, vitest, viewer, or all.

.PARAMETER DryRun
    If set, runs npm publish --dry-run instead of actual publish.

.PARAMETER Tag
    npm dist-tag: 'latest' (default) or 'beta'.

.PARAMETER SkipBuild
    Skip the build step (use if already built).

.EXAMPLE
    .\publish-package.ps1 -Package vitest -DryRun
    Dry-run publish of vitest package.

.EXAMPLE
    .\publish-package.ps1 -Package all -Tag beta
    Publish all packages with beta tag.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('schema', 'server', 'vitest', 'viewer', 'all')]
    [string]$Package,

    [switch]$DryRun,

    [ValidateSet('latest', 'beta')]
    [string]$Tag = 'latest',

    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')

# Package info with dependency order
$packages = [ordered]@{
    'schema' = @{
        Name = '@swedevtools/livedoc-schema'
        Path = 'packages/schema'
        DependsOn = @()
    }
    'server' = @{
        Name = '@swedevtools/livedoc-server'
        Path = 'packages/server'
        DependsOn = @('schema')
    }
    'vitest' = @{
        Name = '@swedevtools/livedoc-vitest'
        Path = 'packages/vitest'
        DependsOn = @('schema')
    }
    'viewer' = @{
        Name = '@swedevtools/livedoc-viewer'
        Path = 'packages/viewer'
        DependsOn = @('schema', 'server')
    }
}

function Get-PackageVersion {
    param([string]$PackagePath)
    $pkgJson = Get-Content (Join-Path $repoRoot $PackagePath 'package.json') -Raw | ConvertFrom-Json
    return $pkgJson.version
}

function Publish-Package {
    param(
        [string]$Key,
        [hashtable]$Info
    )

    $pkgPath = Join-Path $repoRoot $Info.Path
    $version = Get-PackageVersion -PackagePath $Info.Path

    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Publishing: $($Info.Name)@$version" -ForegroundColor Cyan
    Write-Host "  Path: $($Info.Path)" -ForegroundColor DarkGray
    Write-Host "  Tag: $Tag" -ForegroundColor DarkGray
    if ($DryRun) {
        Write-Host "  Mode: DRY RUN" -ForegroundColor Yellow
    }
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

    Push-Location $pkgPath
    try {
        # Build if not skipped
        if (-not $SkipBuild) {
            Write-Host "`n→ Building..." -ForegroundColor White
            pnpm run build
            if ($LASTEXITCODE -ne 0) {
                throw "Build failed for $($Info.Name)"
            }
        }

        # Publish
        $publishArgs = @('publish')
        if ($DryRun) {
            $publishArgs += '--dry-run'
            # Skip prepublishOnly scripts for dry-run since we already built
            $publishArgs += '--ignore-scripts'
        }
        if ($Tag -eq 'beta') {
            $publishArgs += '--tag'
            $publishArgs += 'beta'
        }
        $publishArgs += '--access'
        $publishArgs += 'public'

        Write-Host "`n→ Running: npm $($publishArgs -join ' ')" -ForegroundColor White
        & npm @publishArgs

        if ($LASTEXITCODE -ne 0) {
            throw "Publish failed for $($Info.Name)"
        }

        Write-Host "`n✓ $($Info.Name)@$version published successfully!" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}

# Determine packages to publish
$toPublish = @()
if ($Package -eq 'all') {
    $toPublish = $packages.Keys
} else {
    $toPublish = @($Package)
}

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║           LiveDoc NPM Publish                             ║" -ForegroundColor Magenta
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""
Write-Host "Packages to publish: $($toPublish -join ', ')" -ForegroundColor White
Write-Host "Tag: $Tag" -ForegroundColor White
if ($DryRun) {
    Write-Host "Mode: DRY RUN (no actual publish)" -ForegroundColor Yellow
}

# Confirm before actual publish
if (-not $DryRun) {
    Write-Host ""
    $confirm = Read-Host "Continue with publish? (y/N)"
    if ($confirm -ne 'y' -and $confirm -ne 'Y') {
        Write-Host "Aborted." -ForegroundColor Red
        exit 1
    }
}

# Publish in dependency order
foreach ($key in $toPublish) {
    $info = $packages[$key]
    Publish-Package -Key $key -Info $info
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  All packages published successfully!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
