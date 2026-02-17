<#
.SYNOPSIS
    Publishes the LiveDoc xUnit NuGet package to nuget.org.

.DESCRIPTION
    Publishes the .nupkg to nuget.org with support for dry-run and confirmation prompts.

.PARAMETER DryRun
    If set, performs a dry-run (validates but does not push).

.PARAMETER ApiKey
    NuGet API key. If not provided, uses the NUGET_API_KEY environment variable.

.PARAMETER SkipPack
    Skip the pack step (use if already packed).

.PARAMETER Configuration
    Build configuration: Release (default) or Debug.

.EXAMPLE
    .\publish-nuget.ps1 -DryRun
    Dry-run publish of the xUnit NuGet package.

.EXAMPLE
    .\publish-nuget.ps1 -ApiKey "your-api-key"
    Publish the xUnit NuGet package to nuget.org.
#>

[CmdletBinding()]
param(
    [switch]$DryRun,

    [string]$ApiKey,

    [switch]$SkipPack,

    [ValidateSet('Release', 'Debug')]
    [string]$Configuration = 'Release'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$xunitDir = Join-Path $repoRoot 'dotnet\xunit'
$csproj = Join-Path $xunitDir 'livedoc-xunit.csproj'

if (-not (Test-Path $csproj)) {
    Write-Host "Error: csproj not found at $csproj" -ForegroundColor Red
    exit 1
}

# Read package ID and version from csproj
[xml]$proj = Get-Content $csproj
$packageId = $proj.Project.PropertyGroup.PackageId
$version = $proj.Project.PropertyGroup.Version

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║           LiveDoc NuGet Publish                          ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""
Write-Host "Package: $packageId@$version" -ForegroundColor White
if ($DryRun) {
    Write-Host "Mode: DRY RUN (no actual publish)" -ForegroundColor Yellow
}

# Pack first if not skipped
if (-not $SkipPack) {
    Write-Host "`n→ Packing..." -ForegroundColor White
    & (Join-Path $PSScriptRoot 'pack-nuget.ps1') -Configuration $Configuration
    if ($LASTEXITCODE -ne 0) {
        throw "Pack step failed"
    }
}

# Find the .nupkg
$outputDir = Join-Path $repoRoot "releases\$packageId"
$nupkg = Get-ChildItem -Path $outputDir -Filter "$packageId.$version.nupkg" | Select-Object -First 1

if (-not $nupkg) {
    # Try any matching nupkg
    $nupkg = Get-ChildItem -Path $outputDir -Filter "*.nupkg" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

if (-not $nupkg) {
    Write-Host "`n✗ No .nupkg file found in $outputDir" -ForegroundColor Red
    Write-Host "  Run pack-nuget.ps1 first or remove -SkipPack." -ForegroundColor Yellow
    exit 1
}

Write-Host "`n→ Package: $($nupkg.Name)" -ForegroundColor White

if ($DryRun) {
    Write-Host "`n→ Dry run: validating package..." -ForegroundColor White
    dotnet nuget push $nupkg.FullName --source https://api.nuget.org/v3/index.json --dry-run 2>&1
    Write-Host "`n✓ Dry run complete. Package is valid." -ForegroundColor Green
    return
}

# Resolve API key
if (-not $ApiKey) {
    $ApiKey = $env:NUGET_API_KEY
}

if (-not $ApiKey) {
    Write-Host "`n✗ No API key provided." -ForegroundColor Red
    Write-Host "  Use -ApiKey parameter or set NUGET_API_KEY environment variable." -ForegroundColor Yellow
    exit 1
}

# Confirm before actual publish
Write-Host ""
$confirm = Read-Host "Publish $($nupkg.Name) to nuget.org? (y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "Aborted." -ForegroundColor Red
    exit 1
}

Write-Host "`n→ Publishing to nuget.org..." -ForegroundColor White
dotnet nuget push $nupkg.FullName --source https://api.nuget.org/v3/index.json --api-key $ApiKey

if ($LASTEXITCODE -ne 0) {
    throw "NuGet push failed with exit code $LASTEXITCODE"
}

Write-Host "`n══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✓ $packageId@$version published to nuget.org!" -ForegroundColor Green
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Green
