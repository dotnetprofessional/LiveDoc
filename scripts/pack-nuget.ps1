<#
.SYNOPSIS
    Packs the LiveDoc xUnit NuGet package.

.DESCRIPTION
    Runs dotnet pack on the xUnit project and copies the .nupkg to the releases folder.

.PARAMETER Configuration
    Build configuration: Release (default) or Debug.

.EXAMPLE
    .\pack-nuget.ps1
    Pack the xUnit NuGet package in Release configuration.
#>

[CmdletBinding()]
param(
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
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Packing: $packageId@$version" -ForegroundColor Cyan
Write-Host "  Configuration: $Configuration" -ForegroundColor DarkGray
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Cyan

# Create output directory
$outputDir = Join-Path $repoRoot "releases\$packageId"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Run dotnet pack
Write-Host "`n→ Running dotnet pack..." -ForegroundColor White
Push-Location $xunitDir
try {
    dotnet pack $csproj -c $Configuration -o $outputDir --no-restore
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet pack failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

# List output
$nupkgs = Get-ChildItem -Path $outputDir -Filter "*.nupkg"
if ($nupkgs.Count -gt 0) {
    Write-Host "`n✓ Package(s) created:" -ForegroundColor Green
    foreach ($pkg in $nupkgs) {
        Write-Host "  - $($pkg.FullName)" -ForegroundColor Gray
    }
} else {
    Write-Host "`n✗ No .nupkg files found in output directory." -ForegroundColor Red
    exit 1
}
