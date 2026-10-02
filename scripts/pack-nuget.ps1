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

$canonicalSkillsDir = Join-Path $repoRoot '.github\skills\livedoc-xunit'
$bundledSkillsDir = Join-Path $xunitDir 'tools\skills'
$skillText = Get-Content (Join-Path $bundledSkillsDir 'SKILL.md') -Raw
if ($skillText -notmatch "(?m)^sdk_version:\s*$([regex]::Escape($version))\s*$") {
    throw "Bundled xUnit skill version does not match package version $version."
}
$canonicalFiles = @(Get-ChildItem $canonicalSkillsDir -File -Recurse)
$bundledFiles = @(Get-ChildItem $bundledSkillsDir -File -Recurse)
if ($canonicalFiles.Count -ne $bundledFiles.Count) {
    throw 'Canonical and bundled xUnit skill file counts differ.'
}
foreach ($file in $canonicalFiles) {
    $relativePath = $file.FullName.Substring($canonicalSkillsDir.Length).TrimStart('\', '/')
    $bundledPath = Join-Path $bundledSkillsDir $relativePath
    if (-not (Test-Path $bundledPath) -or
        (Get-FileHash $file.FullName -Algorithm SHA256).Hash -ne (Get-FileHash $bundledPath -Algorithm SHA256).Hash) {
        throw "Bundled xUnit skill is stale: $relativePath"
    }
}

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

# Pack (sub-project builds are handled by MSBuild targets in the csproj)
Write-Host "`n→ Running dotnet pack..." -ForegroundColor White
Push-Location $xunitDir
try {
    dotnet pack $csproj -c $Configuration -o $outputDir
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet pack failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

# List output
$nupkgs = @(Get-ChildItem -Path $outputDir -Filter "*.nupkg")
if ($nupkgs.Count -gt 0) {
    Write-Host "`n✓ Package(s) created:" -ForegroundColor Green
    foreach ($pkg in $nupkgs) {
        Write-Host "  - $($pkg.FullName)" -ForegroundColor Gray
    }
} else {
    Write-Host "`n✗ No .nupkg files found in output directory." -ForegroundColor Red
    exit 1
}
