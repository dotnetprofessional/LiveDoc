<#
.SYNOPSIS
    Syncs SDK version numbers into bundled SKILL.md files before packaging.

.DESCRIPTION
    Reads the current version from package.json (vitest) and .csproj (xunit),
    then updates the SKILL.md files that ship inside each SDK package.

.PARAMETER RepoRoot
    Root of the LiveDoc repository. Defaults to parent of the scripts directory.
#>
param(
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'

function Update-SkillVersion {
    param(
        [string]$FilePath,
        [string]$OldVersion,
        [string]$NewVersion,
        [string]$PackageDisplayName
    )

    if (-not (Test-Path $FilePath)) {
        Write-Warning "SKILL.md not found: $FilePath"
        return
    }

    $content = Get-Content -Path $FilePath -Raw

    $content = $content -replace "sdk_version:\s*$([regex]::Escape($OldVersion))", "sdk_version: $NewVersion"
    $content = $content -replace "(\*\*$([regex]::Escape($PackageDisplayName))\s+v)$([regex]::Escape($OldVersion))(\*\*)", "`${1}$NewVersion`${2}"
    $content = $content -replace "(differs from\s+``)$([regex]::Escape($OldVersion))(``)", "`${1}$NewVersion`${2}"
    $content = $content -replace "(target\s+v)$([regex]::Escape($OldVersion))(\s+but)", "`${1}$NewVersion`${2}"

    Set-Content -Path $FilePath -Value $content -NoNewline
}

function Get-SkillVersion {
    param([string]$FilePath)
    if (-not (Test-Path $FilePath)) { return $null }
    if ((Get-Content -Path $FilePath -Raw) -match 'sdk_version:\s*([^\s\r\n]+)') {
        return $Matches[1]
    }
    return $null
}

# --- Vitest (bundled in npm tarball) ---
$vitestPkgJson = Join-Path $RepoRoot 'packages/vitest/package.json'
$vitestVersion = (Get-Content $vitestPkgJson -Raw | ConvertFrom-Json).version
$vitestSkill = Join-Path $RepoRoot 'packages/vitest/tools/skills/SKILL.md'

$vitestOldVersion = Get-SkillVersion -FilePath $vitestSkill
if ($vitestOldVersion -and $vitestOldVersion -ne $vitestVersion) {
    Write-Host "Vitest SKILL.md: $vitestOldVersion -> $vitestVersion" -ForegroundColor Cyan
    Update-SkillVersion -FilePath $vitestSkill -OldVersion $vitestOldVersion -NewVersion $vitestVersion -PackageDisplayName '@swedevtools/livedoc-vitest'
} else {
    Write-Host "Vitest SKILL.md: already at $vitestVersion" -ForegroundColor DarkGray
}

# --- xUnit (bundled in NuGet package) ---
$xunitCsproj = Join-Path $RepoRoot 'dotnet/xunit/livedoc-xunit.csproj'
[xml]$csprojXml = Get-Content $xunitCsproj
$xunitVersion = $csprojXml.Project.PropertyGroup.Version | Where-Object { $_ } | Select-Object -First 1
$xunitSkill = Join-Path $RepoRoot 'dotnet/xunit/tools/skills/SKILL.md'

$xunitOldVersion = Get-SkillVersion -FilePath $xunitSkill
if ($xunitOldVersion -and $xunitOldVersion -ne $xunitVersion) {
    Write-Host "xUnit SKILL.md: $xunitOldVersion -> $xunitVersion" -ForegroundColor Cyan
    Update-SkillVersion -FilePath $xunitSkill -OldVersion $xunitOldVersion -NewVersion $xunitVersion -PackageDisplayName 'SweDevTools.LiveDoc.xUnit'
} else {
    Write-Host "xUnit SKILL.md: already at $xunitVersion" -ForegroundColor DarkGray
}

Write-Host "Skill version sync complete." -ForegroundColor Green
