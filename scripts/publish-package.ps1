<#
.SYNOPSIS
    Publishes LiveDoc packages to npm.

.DESCRIPTION
    Publishes one or more packages to npm with support for dry-run, beta tags, and dependency ordering.

.PARAMETER Package
    Package to publish: vitest, viewer, or all.

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
    [ValidateSet('vitest', 'viewer', 'all')]
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
    'vitest' = @{
        Name = '@swedevtools/livedoc-vitest'
        Path = 'packages/vitest'
        DependsOn = @()
    }
    'viewer' = @{
        Name = '@swedevtools/livedoc-viewer'
        Path = 'packages/viewer'
        DependsOn = @()
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
        # Sync skill versions before build
        $syncScript = Join-Path $repoRoot 'scripts\sync-skill-versions.ps1'
        if (Test-Path $syncScript) {
            Write-Host "`n→ Syncing skill versions..." -ForegroundColor White
            & $syncScript -RepoRoot $repoRoot
        }

        # Build if not skipped
        if (-not $SkipBuild) {
            Write-Host "`n→ Building..." -ForegroundColor White
            pnpm run build
            if ($LASTEXITCODE -ne 0) {
                throw "Build failed for $($Info.Name)"
            }
        }

        # Publish (use pnpm to resolve workspace: protocols; --ignore-scripts
        # skips prepublishOnly since we already built explicitly above;
        # --no-git-checks allows publish from any branch)
        $publishArgs = @('publish', '--ignore-scripts', '--no-git-checks')
        if ($DryRun) {
            $publishArgs += '--dry-run'
        }
        if ($Tag -eq 'beta') {
            $publishArgs += '--tag'
            $publishArgs += 'beta'
        }
        $publishArgs += '--access'
        $publishArgs += 'public'

        Write-Host "`n→ Running: pnpm $($publishArgs -join ' ')" -ForegroundColor White
        & pnpm @publishArgs 2>&1 | ForEach-Object {
            $line = $_.ToString()
            # Filter cosmetic npm warnings about pnpm-only flags
            if ($line -notmatch 'npm warn Unknown (cli|env) config') {
                Write-Host $line
            }
        }

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
