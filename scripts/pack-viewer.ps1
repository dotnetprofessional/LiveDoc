<#
.SYNOPSIS
    Packages the LiveDoc Viewer for distribution.

.DESCRIPTION
    Creates an npm tarball (.tgz) for the viewer using a clean staging
    directory approach that avoids pnpm symlink issues:

    1. Copies dist/ and package.json to a temp staging dir
    2. Resolves workspace:* references to actual versions
    3. Runs npm install --production for clean hoisted node_modules
    4. Runs npm pack from the staging dir (no ../paths, no symlinks)

    All output goes to ./releases/@swedevtools/livedoc-viewer/

.PARAMETER SkipBuild
    Skip the build step (use when dist/ is already up to date).

.EXAMPLE
    .\pack-viewer.ps1
    Build and pack the viewer npm tarball.

.EXAMPLE
    .\pack-viewer.ps1 -SkipBuild
    Pack without rebuilding (dist/ must already exist).
#>

[CmdletBinding()]
param(
    [switch]$SkipBuild
)

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

# ── Step 0: Build (unless skipped) ───────────────────────────────────────

if (-not $SkipBuild) {
    Write-Host "`n→ Building viewer..." -ForegroundColor White
    Push-Location $viewerDir
    try {
        & pnpm run build
        if ($LASTEXITCODE -ne 0) { throw "Viewer build failed" }
        Write-Host "  ✓ Build complete" -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

$distDir = Join-Path $viewerDir 'dist'
if (-not (Test-Path $distDir)) {
    Write-Host "Error: dist/ not found. Run build first or remove -SkipBuild." -ForegroundColor Red
    exit 1
}

# ── Step 1: Create clean staging directory ───────────────────────────────

$stageDir = Join-Path ([System.IO.Path]::GetTempPath()) "livedoc-viewer-pack-$([System.IO.Path]::GetRandomFileName())"
Write-Host "`n→ Creating staging directory..." -ForegroundColor White
New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

try {
    # Copy dist/
    Copy-Item -Path $distDir -Destination (Join-Path $stageDir 'dist') -Recurse -Force
    Write-Host "  ✓ Copied dist/" -ForegroundColor Green

    # ── Step 2: Resolve workspace:* and write clean package.json ─────────

    Write-Host "`n→ Resolving workspace:* references..." -ForegroundColor White
    $pkgContent = Get-Content (Join-Path $viewerDir 'package.json') -Raw | ConvertFrom-Json

    # Find actual versions for workspace deps
    $workspaceDeps = @{}

    # Build a map of package name → version from all packages in the monorepo
    $packageVersions = @{}
    foreach ($pkgDir in (Get-ChildItem (Join-Path $repoRoot 'packages') -Directory)) {
        $pkgJsonPath = Join-Path $pkgDir.FullName 'package.json'
        if (Test-Path $pkgJsonPath) {
            $depPkg = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
            $packageVersions[$depPkg.name] = $depPkg.version
        }
    }

    foreach ($prop in $pkgContent.dependencies.PSObject.Properties) {
        if ($prop.Value -match '^workspace:') {
            $depName = $prop.Name
            if ($packageVersions.ContainsKey($depName)) {
                $workspaceDeps[$depName] = $packageVersions[$depName]
                Write-Host "  ✓ $depName → $($packageVersions[$depName])" -ForegroundColor Green
            } else {
                throw "Cannot find monorepo package for workspace dep '$depName'"
            }
        }
    }

    # Replace workspace:* with resolved versions in the raw JSON
    $rawJson = Get-Content (Join-Path $viewerDir 'package.json') -Raw
    foreach ($dep in $workspaceDeps.GetEnumerator()) {
        $rawJson = $rawJson -replace [regex]::Escape("`"$($dep.Key)`": `"workspace:*`""), "`"$($dep.Key)`": `"$($dep.Value)`""
        $rawJson = $rawJson -replace [regex]::Escape("`"$($dep.Key)`": `"workspace:^`""), "`"^$($dep.Value)`""
        $rawJson = $rawJson -replace [regex]::Escape("`"$($dep.Key)`": `"workspace:~`""), "`"~$($dep.Value)`""
    }

    # Remove bundleDependencies — we'll have real node_modules, no need to bundle
    # Actually keep it — npm pack uses this to include node_modules in the tarball
    Set-Content -Path (Join-Path $stageDir 'package.json') -Value $rawJson -Encoding utf8
    Write-Host "  ✓ Wrote resolved package.json" -ForegroundColor Green

    # ── Step 3: Install deps in staging ────────────────────────────────────
    # Workspace packages aren't on npm, so we pack them first as tarballs,
    # then install everything together.

    Write-Host "`n→ Packing workspace dependencies..." -ForegroundColor White
    $workspaceTarballs = @{}
    foreach ($dep in $workspaceDeps.Keys) {
        # Find the package directory
        foreach ($pkgDir in (Get-ChildItem (Join-Path $repoRoot 'packages') -Directory)) {
            $pkgJsonPath = Join-Path $pkgDir.FullName 'package.json'
            if (Test-Path $pkgJsonPath) {
                $depPkg = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
                if ($depPkg.name -eq $dep) {
                    Push-Location $pkgDir.FullName
                    try {
                        $tgz = & pnpm pack 2>&1 | Select-String '\.tgz$' | Select-Object -Last 1
                        $tgzPath = Join-Path $pkgDir.FullName ($tgz.ToString().Trim())
                        if (Test-Path $tgzPath) {
                            $workspaceTarballs[$dep] = $tgzPath
                            Write-Host "  ✓ Packed $dep" -ForegroundColor Green
                        } else {
                            throw "Failed to pack $dep"
                        }
                    } finally {
                        Pop-Location
                    }
                    break
                }
            }
        }
    }

    # Rewrite the staged package.json to point workspace deps at local tarballs
    $stagedPkgJson = Get-Content (Join-Path $stageDir 'package.json') -Raw
    foreach ($entry in $workspaceTarballs.GetEnumerator()) {
        $tgzPath = $entry.Value -replace '\\', '/'
        $stagedPkgJson = $stagedPkgJson -replace [regex]::Escape("`"$($entry.Key)`": `"$($workspaceDeps[$entry.Key])`""), "`"$($entry.Key)`": `"file:$tgzPath`""
    }
    Set-Content -Path (Join-Path $stageDir 'package.json') -Value $stagedPkgJson -Encoding utf8

    Write-Host "`n→ Installing production dependencies..." -ForegroundColor White
    Push-Location $stageDir
    try {
        & npm install --omit=dev --no-audit --fund false --legacy-peer-deps 2>&1 | ForEach-Object {
            $line = $_.ToString()
            if ($line -match 'warn|ERR') {
                Write-Host "  npm: $line" -ForegroundColor DarkYellow
            }
        }
        if ($LASTEXITCODE -ne 0) { throw "npm install failed in staging directory" }
        Write-Host "  ✓ Dependencies installed" -ForegroundColor Green
    } finally {
        Pop-Location
    }

    # ── Step 4: Restore real versions in package.json for distribution ────
    # The file:// references were only for npm install. Consumers need real versions.
    $finalPkgJson = $rawJson
    Set-Content -Path (Join-Path $stageDir 'package.json') -Value $finalPkgJson -Encoding utf8

    # ── Step 5: npm pack from staging dir ────────────────────────────────

    Write-Host "`n→ Creating tarball..." -ForegroundColor White
    Push-Location $stageDir
    try {
        $packOutput = & npm pack --json 2>&1 | Out-String
        if ($LASTEXITCODE -ne 0) { throw "npm pack failed: $packOutput" }
    } finally {
        Pop-Location
    }

    # Find the generated .tgz
    $tgzFile = Get-ChildItem -Path $stageDir -Filter '*.tgz' | Select-Object -First 1
    if (-not $tgzFile) {
        throw "npm pack did not produce a .tgz file"
    }
    Write-Host "  ✓ Created $($tgzFile.Name) ($([math]::Round($tgzFile.Length / 1KB)) KB)" -ForegroundColor Green

    # ── Step 6: Move to releases/ ────────────────────────────────────────

    $outputDir = Join-Path $repoRoot 'releases\@swedevtools\livedoc-viewer'
    if (-not (Test-Path $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    }

    Move-Item -Path $tgzFile.FullName -Destination $outputDir -Force
    Write-Host "`n✓ Artifact: $(Join-Path $outputDir $tgzFile.Name)" -ForegroundColor Green

} finally {
    # Clean up staging dir
    Remove-Item -Path $stageDir -Recurse -Force -ErrorAction SilentlyContinue
    # Clean up workspace tarballs
    foreach ($tgz in $workspaceTarballs.Values) {
        Remove-Item -Path $tgz -Force -ErrorAction SilentlyContinue
    }
}

# Summary
Write-Host ""
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Done: $packageName@$version" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Validate with:  .\scripts\validate-release.ps1 -SkipVitest" -ForegroundColor DarkGray
Write-Host ""
