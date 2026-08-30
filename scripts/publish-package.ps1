<#
.SYNOPSIS
    Publishes independently distributed LiveDoc packages to npm.

.DESCRIPTION
    Publishes Vitest, Viewer, or all independently published npm packages with
    support for dry-run and beta tags.

    @swedevtools/livedoc-schema and @swedevtools/livedoc-server are private
    workspace packages. pack-viewer.ps1 embeds them into Viewer; they are never
    published independently.

.PARAMETER Package
    Package to publish: vitest, viewer, or all. "all" includes every
    independently published npm package.

.PARAMETER DryRun
    If set, runs npm publish --dry-run instead of actual publish.

.PARAMETER Tag
    npm dist-tag: 'latest' (default) or 'beta'. Prerelease versions cannot use 'latest'.

.PARAMETER SkipBuild
    Skip the build step (use if already built).

.PARAMETER Registry
    npm registry URL. Defaults to the public npmjs registry.

.EXAMPLE
    .\publish-package.ps1 -Package vitest -DryRun
    Dry-run publish of vitest package.

.EXAMPLE
    .\publish-package.ps1 -Package all -DryRun -SkipBuild
    Dry-run every independently published npm package without rebuilding.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('vitest', 'viewer', 'all')]
    [string]$Package,

    [switch]$DryRun,

    [ValidateSet('latest', 'beta')]
    [string]$Tag = 'latest',

    [switch]$SkipBuild,

    [string]$Registry = 'https://registry.npmjs.org/'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')

# Only independently published npm packages belong in this map. Schema and
# Server are private workspace packages embedded by pack-viewer.ps1.
$packages = [ordered]@{
    'vitest' = @{
        Name = '@swedevtools/livedoc-vitest'
        Path = 'packages/vitest'
    }
    'viewer' = @{
        Name = '@swedevtools/livedoc-viewer'
        Path = 'packages/viewer'
        ExtraPublishArgs = @('--config.node-linker=hoisted')
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
    if ($Tag -eq 'latest' -and $version.Contains('-')) {
        throw "Refusing to publish prerelease $($Info.Name)@$version with the 'latest' dist-tag."
    }

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
        if ($Info.ExtraPublishArgs) {
            $publishArgs += $Info.ExtraPublishArgs
        }
        if ($DryRun) {
            $publishArgs += '--dry-run'
        }
        if ($Tag -eq 'beta') {
            $publishArgs += '--tag'
            $publishArgs += 'beta'
        }
        $publishArgs += '--access'
        $publishArgs += 'public'
        $publishArgs += '--registry'
        $publishArgs += $Registry

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
Write-Host "Registry: $Registry" -ForegroundColor White
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

# Publish the selected independently distributed packages.
foreach ($key in $toPublish) {
    $info = $packages[$key]
    Publish-Package -Key $key -Info $info
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  All packages published successfully!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
