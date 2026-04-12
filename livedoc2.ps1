#Requires -Version 5.1
<#
.SYNOPSIS
    LiveDoc interactive launcher (v2 — menu-framework based).

.DESCRIPTION
    Interactive menu for common LiveDoc project tasks: dev servers,
    builds, publishing, testing, and per-package operations.
    Built on menu-framework v1.0.0.

.PARAMETER List
    Print available commands and exit (for CI/scripting).

.PARAMETER Run
    Execute a command by hotkey without the interactive menu.

.PARAMETER Command
    CLI dispatch: build, clean, test, docs-build, docs-serve, etc.
#>
param(
    [switch]$List,
    [string]$Run = '',
    [string]$Command = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot

. "$PSScriptRoot\menu-framework.ps1"

# Uncomment to enable action logging:
# Enable-MenuLog -Path "$PSScriptRoot\.menu.log"

$script:AppQuit = $false

# ---------------------------------------------------------------------------
#  Helper functions
# ---------------------------------------------------------------------------

function Run-Build {
    Write-Host '==> Full build: clean + install + build + package' -ForegroundColor Cyan
    Invoke-InDirectory -Path $repoRoot -Action {
        pnpm run clean
        pnpm install
        pnpm -r build
        if (Test-Path "$repoRoot\scripts\sync-skill-versions.ps1") {
            & "$repoRoot\scripts\sync-skill-versions.ps1"
        }
        if (Test-Path "$repoRoot\scripts\pack-nuget.ps1") {
            & "$repoRoot\scripts\pack-nuget.ps1"
        }
    }
}

function Run-BuildPackages {
    Write-Host '==> Building packages (fast incremental)' -ForegroundColor Cyan
    Invoke-InDirectory -Path $repoRoot -Action { pnpm -r build }
}

function Sync-Releases {
    $releasesDir = Join-Path $repoRoot 'releases'
    if (-not (Test-Path $releasesDir)) {
        New-Item -ItemType Directory -Path $releasesDir | Out-Null
    }

    Write-Host 'Syncing artifacts to releases folder...' -ForegroundColor Cyan

    # VS Code extension → releases/livedoc-vscode/
    $vscodeDir = Join-Path $repoRoot 'packages/vscode'
    if (Test-Path $vscodeDir) {
        $vsixFiles = @(Get-ChildItem -Path $vscodeDir -Filter '*.vsix')
        if ($vsixFiles.Count -gt 0) {
            $dest = Join-Path $releasesDir 'livedoc-vscode'
            if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest -Force | Out-Null }
            $vsixFiles | Copy-Item -Destination $dest -ErrorAction SilentlyContinue
        }
    }

    # Vitest package → releases/@swedevtools/livedoc-vitest/
    $vitestDir = Join-Path $repoRoot 'packages/vitest'
    if (Test-Path $vitestDir) {
        $tgzFiles = @(Get-ChildItem -Path $vitestDir -Filter '*.tgz')
        if ($tgzFiles.Count -gt 0) {
            $dest = Join-Path $releasesDir '@swedevtools/livedoc-vitest'
            if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest -Force | Out-Null }
            $tgzFiles | Copy-Item -Destination $dest -ErrorAction SilentlyContinue
        }
    }

    # Viewer package → releases/@swedevtools/livedoc-viewer/
    $viewerDir = Join-Path $repoRoot 'packages/viewer'
    if (Test-Path $viewerDir) {
        $tgzFiles = @(Get-ChildItem -Path $viewerDir -Filter '*.tgz')
        if ($tgzFiles.Count -gt 0) {
            $dest = Join-Path $releasesDir '@swedevtools/livedoc-viewer'
            if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest -Force | Out-Null }
            $tgzFiles | Copy-Item -Destination $dest -ErrorAction SilentlyContinue
        }
    }

    # NuGet package is already placed by pack-nuget.ps1

    # Display all artifacts
    $artifacts = @(Get-ChildItem -Path $releasesDir -Recurse -File)
    if ($artifacts.Count -gt 0) {
        Write-Host 'Current artifacts in releases:' -ForegroundColor White
        foreach ($a in $artifacts) {
            $relative = $a.FullName.Substring($releasesDir.Length + 1)
            Write-Host "  - $relative" -ForegroundColor Gray
        }
    } else {
        Write-Host 'No artifacts found in releases/' -ForegroundColor Yellow
    }
}

function Pack-AllToReleases {
    Write-Host '==> Pack all SDKs to releases/' -ForegroundColor Cyan

    # VS Code extension
    $vscodeDir = Join-Path $repoRoot 'packages/vscode'
    if (Test-Path $vscodeDir) {
        Write-Host 'Packaging VS Code extension...' -ForegroundColor Cyan
        Invoke-InDirectory -Path $vscodeDir -Action { pnpm run package }
    }

    # Vitest package
    $vitestDir = Join-Path $repoRoot 'packages/vitest'
    if (Test-Path $vitestDir) {
        Write-Host 'Packaging Vitest...' -ForegroundColor Cyan
        Invoke-InDirectory -Path $vitestDir -Action { pnpm run pack:local }
    }

    # Viewer package
    $viewerDir = Join-Path $repoRoot 'packages/viewer'
    if (Test-Path $viewerDir) {
        Write-Host 'Packaging Viewer...' -ForegroundColor Cyan
        Invoke-InDirectory -Path $viewerDir -Action { pnpm run pack:local }
    }

    # NuGet package
    $packNuget = Join-Path $repoRoot 'scripts/pack-nuget.ps1'
    if (Test-Path $packNuget) {
        Write-Host 'Packing NuGet package...' -ForegroundColor Cyan
        & $packNuget
    }

    Sync-Releases
    Write-Host 'Pack complete!' -ForegroundColor Green
}

function Get-PackageInfo {
    param([string]$PackageDir)
    $pkgJson = Join-Path $PackageDir 'package.json'
    if (-not (Test-Path $pkgJson)) { return $null }
    $pkg = Get-Content $pkgJson -Raw | ConvertFrom-Json
    $scripts = @()
    if ($pkg.scripts) {
        $pkg.scripts.PSObject.Properties | ForEach-Object { $scripts += $_.Name }
    }
    [PSCustomObject]@{
        Name    = $pkg.name
        Dir     = $PackageDir
        Scripts = $scripts
    }
}

function Build-PackageSubmenu {
    param(
        [PSCustomObject]$PkgInfo,
        [char]$HotKey
    )
    $children = @()
    $hk = 1
    foreach ($script in $PkgInfo.Scripts) {
        $scriptName = $script
        $pkgDir = $PkgInfo.Dir
        $hotkey_char = if ($hk -le 9) { [char]([int][char]'0' + $hk) } else { [char]0 }
        $children += New-MenuItem -Label $scriptName -HotKey $hotkey_char `
            -Action {
                Invoke-InDirectory -Path $pkgDir -Action {
                    pnpm run $scriptName
                }
                if ($scriptName -match 'package|pack') { Sync-Releases }
            }.GetNewClosure() `
            -Description "pnpm run $scriptName"
        $hk++
    }
    New-MenuItem -Label $PkgInfo.Name -HotKey $HotKey -Children $children `
        -Description "Package scripts ($($PkgInfo.Scripts.Count) scripts)"
}

# ---------------------------------------------------------------------------
#  CLI dispatch
# ---------------------------------------------------------------------------

if ($Command) {
    switch ($Command) {
        'build'        { Run-Build; return }
        'build-packages' { Run-BuildPackages; return }
        'clean'        { Invoke-InDirectory -Path $repoRoot -Action { pnpm run clean }; return }
        'test'         { Invoke-InDirectory -Path $repoRoot -Action { pnpm -r test }; return }
        'docs-build'   { Invoke-InDirectory -Path (Join-Path $repoRoot 'docs') -Action { npx docusaurus build }; return }
        'docs-serve'   { Invoke-InDirectory -Path (Join-Path $repoRoot 'docs') -Action { npx docusaurus start --port 4000 }; return }
        'pack'         { Pack-AllToReleases; return }
        default        { Write-Error "Unknown command: $Command. Use -List to see available items."; return }
    }
}

# ---------------------------------------------------------------------------
#  Menu items
# ---------------------------------------------------------------------------

$items = [System.Collections.Generic.List[object]]::new()

# --- Quick actions ---
$items.Add((New-MenuItem -Label 'Dev All (Viewer + Server)' -HotKey 'a' `
    -Action {
        Invoke-InDirectory -Path (Join-Path $repoRoot 'packages/viewer') -Action {
            pnpm run dev:all
        }
    }.GetNewClosure() `
    -Description 'Start viewer and server in hot-reload mode'))

$items.Add((New-MenuSeparator -Label 'Workflows'))

# --- Documentation submenu ---
$docsDir = Join-Path $repoRoot 'docs'
$items.Add((New-MenuItem -Label 'Documentation Site' -HotKey 'o' -Children @(
    (New-MenuItem -Label 'Dev Server (hot reload)' -HotKey '1' `
        -Action { Invoke-InDirectory -Path $docsDir -Action { npx docusaurus start --port 4000 } }.GetNewClosure() `
        -Description 'Start Docusaurus dev server on port 4000')
    (New-MenuItem -Label 'Build (production)' -HotKey '2' `
        -Action { Invoke-InDirectory -Path $docsDir -Action { npx docusaurus build } }.GetNewClosure() `
        -Description 'Build docs for production deployment')
    (New-MenuItem -Label 'Build + Serve (validation)' -HotKey '3' `
        -Action {
            Invoke-InDirectory -Path $docsDir -Action { npx docusaurus build }
            if ($LASTEXITCODE -eq 0) {
                Invoke-InDirectory -Path $docsDir -Action { npx docusaurus serve --port 4000 }
            }
        }.GetNewClosure() `
        -Description 'Build then preview locally')
    (New-MenuItem -Label 'Clear Cache' -HotKey '4' `
        -Action { Invoke-InDirectory -Path $docsDir -Action { npx docusaurus clear } }.GetNewClosure() `
        -Description 'Clear Docusaurus cache')
) -Description 'Docusaurus documentation site'))

# --- Build submenu ---
$items.Add((New-MenuItem -Label 'Build & Package' -HotKey 'b' -Children @(
    (New-MenuItem -Label 'Build All (clean + install + build + package)' -HotKey '1' `
        -Action { Run-Build } `
        -Description 'Full local release build')
    (New-MenuItem -Label 'Build Packages (fast incremental)' -HotKey '2' `
        -Action { Run-BuildPackages } `
        -Description 'Build changed packages only')
    (New-MenuItem -Label 'Clean All' -HotKey '3' `
        -Action {
            Invoke-InDirectory -Path $repoRoot -Action { pnpm run clean }
            $relDir = Join-Path $repoRoot 'releases'
            if (Test-Path $relDir) { Remove-Item "$relDir\*" -Recurse -Force -ErrorAction SilentlyContinue }
            Write-Host 'Cleaned all packages and releases.' -ForegroundColor Green
        }.GetNewClosure() `
        -Description 'Remove all build artifacts')
) -Description 'Build and package workflows'))

# --- Publish submenu ---
$publishScriptsDir = Join-Path $repoRoot 'scripts'

$npmPublishItems = @(
    (New-MenuItem -Label 'All (dry-run)' -HotKey '1' `
        -Action { & "$publishScriptsDir\publish-package.ps1" -Package all -DryRun }.GetNewClosure() `
        -Description 'Dry-run publish all npm packages')
    (New-MenuItem -Label 'All (release)' -HotKey '2' `
        -Action { & "$publishScriptsDir\publish-package.ps1" -Package all }.GetNewClosure() `
        -Description 'Publish all npm packages')
    (New-MenuItem -Label 'All (beta)' -HotKey '3' `
        -Action { & "$publishScriptsDir\publish-package.ps1" -Package all -Tag beta }.GetNewClosure() `
        -Description 'Publish all as beta')
    (New-MenuSeparator)
)

foreach ($pkg in @('vitest', 'viewer')) {
    $pkgName = $pkg
    $npmPublishItems += @(
        (New-MenuItem -Label "$pkgName (dry-run)" `
            -Action { & "$publishScriptsDir\publish-package.ps1" -Package $pkgName -DryRun }.GetNewClosure() `
            -Description "Dry-run publish $pkgName")
        (New-MenuItem -Label "$pkgName (release)" `
            -Action { & "$publishScriptsDir\publish-package.ps1" -Package $pkgName }.GetNewClosure() `
            -Description "Publish $pkgName to npm")
    )
}

$nugetItems = @(
    (New-MenuItem -Label 'Pack NuGet' -HotKey '1' `
        -Action { & "$publishScriptsDir\pack-nuget.ps1" }.GetNewClosure() `
        -Description 'Pack xUnit NuGet package to releases/')
    (New-MenuItem -Label 'Publish NuGet (dry-run)' -HotKey '2' `
        -Action { & "$publishScriptsDir\publish-nuget.ps1" -DryRun }.GetNewClosure() `
        -Description 'Dry-run NuGet publish')
    (New-MenuItem -Label 'Publish NuGet' -HotKey '3' `
        -Action { & "$publishScriptsDir\publish-nuget.ps1" }.GetNewClosure() `
        -Description 'Publish to nuget.org')
)

$items.Add((New-MenuItem -Label 'Publish' -HotKey 'n' -Children @(
    (New-MenuItem -Label 'Pack All to Releases' -HotKey 'p' `
        -Action { Pack-AllToReleases } `
        -Description 'Pack all SDKs (vscode, vitest, viewer, nuget) to releases/')
    (New-MenuSeparator -Label 'npm')
    (New-MenuItem -Label 'npm Packages' -HotKey '1' -Children $npmPublishItems `
        -Description 'Publish npm packages')
    (New-MenuSeparator -Label 'NuGet')
    (New-MenuItem -Label 'NuGet (xUnit)' -HotKey '2' -Children $nugetItems `
        -Description 'Pack and publish xUnit NuGet')
) -Description 'Pack and publish workflows'))

# --- Update global viewer ---
$items.Add((New-MenuItem -Label 'Update Global Viewer' -HotKey 'u' `
    -Action {
        $relDir = Join-Path $repoRoot 'releases/@swedevtools/livedoc-viewer'
        $tgz = Get-ChildItem $relDir -Filter '*.tgz' -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($tgz) {
            Write-Host "Installing $($tgz.Name) globally..." -ForegroundColor Cyan
            npm install -g $tgz.FullName
        } else {
            Write-Host 'No .tgz found in releases. Run Build All first.' -ForegroundColor Yellow
        }
    }.GetNewClosure() `
    -Description 'Install latest viewer .tgz globally'))

$items.Add((New-MenuSeparator -Label 'Packages'))

# --- Dynamic package submenus ---
$packageHotkeys = @{
    'root'    = 'r'; '@swedevtools/livedoc-vitest' = 'v'
    '@swedevtools/livedoc-viewer' = 'w'; 'livedoc-vscode' = 'c'
}

# Bundled packages (not released independently, skip from menus)
$bundledPackages = @('@swedevtools/livedoc-server', '@swedevtools/livedoc-schema')

$packagesDir = Join-Path $repoRoot 'packages'
if (Test-Path $packagesDir) {
    # Root package
    $rootPkg = Get-PackageInfo -PackageDir $repoRoot
    if ($rootPkg -and $rootPkg.Scripts.Count -gt 0) {
        $items.Add((Build-PackageSubmenu -PkgInfo $rootPkg -HotKey 'r'))
    }

    # Child packages (skip bundled)
    Get-ChildItem $packagesDir -Directory | ForEach-Object {
        $pkgInfo = Get-PackageInfo -PackageDir $_.FullName
        if ($pkgInfo -and $pkgInfo.Scripts.Count -gt 0 -and $pkgInfo.Name -notin $bundledPackages) {
            $hk = if ($packageHotkeys[$pkgInfo.Name]) { [char]$packageHotkeys[$pkgInfo.Name] } else { [char]0 }
            $items.Add((Build-PackageSubmenu -PkgInfo $pkgInfo -HotKey $hk))
        }
    }
}

# --- dotnet/xunit submenu ---
$xunitDir = Join-Path $repoRoot 'dotnet\xunit'
$xunitSln = Get-ChildItem $xunitDir -Filter '*.sln' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($xunitSln) {
    $slnPath = $xunitSln.FullName
    $items.Add((New-MenuItem -Label 'dotnet/xunit' -HotKey 'd' -Children @(
        (New-MenuItem -Label 'Build' -HotKey '1' `
            -Action { Invoke-InDirectory -Path $xunitDir -Action { dotnet build $slnPath } }.GetNewClosure() `
            -Description 'dotnet build')
        (New-MenuItem -Label 'Test' -HotKey '2' `
            -Action { Invoke-InDirectory -Path $xunitDir -Action { dotnet test $slnPath --logger LiveDoc } }.GetNewClosure() `
            -Description 'dotnet test with LiveDoc logger')
        (New-MenuItem -Label 'Test (with Viewer)' -HotKey '3' `
            -Action {
                $env:LIVEDOC_SERVER_URL = 'http://localhost:19275'
                $env:LIVEDOC_PROJECT = 'LiveDoc.xUnit'
                $env:LIVEDOC_ENVIRONMENT = 'local'
                try {
                    Invoke-InDirectory -Path $xunitDir -Action { dotnet test $slnPath --logger LiveDoc }
                } finally {
                    Remove-Item Env:\LIVEDOC_SERVER_URL -ErrorAction SilentlyContinue
                    Remove-Item Env:\LIVEDOC_PROJECT -ErrorAction SilentlyContinue
                    Remove-Item Env:\LIVEDOC_ENVIRONMENT -ErrorAction SilentlyContinue
                }
            }.GetNewClosure() `
            -Description 'Test with live viewer connection')
        (New-MenuItem -Label 'Clean' -HotKey '4' `
            -Action { Invoke-InDirectory -Path $xunitDir -Action { dotnet clean $slnPath } }.GetNewClosure() `
            -Description 'dotnet clean')
        (New-MenuSeparator)
        (New-MenuItem -Label 'Pack NuGet' -HotKey '5' `
            -Action { & "$publishScriptsDir\pack-nuget.ps1" }.GetNewClosure() `
            -Description 'Pack xUnit NuGet to releases/')
        (New-MenuItem -Label 'Publish NuGet (dry-run)' -HotKey '6' `
            -Action { & "$publishScriptsDir\publish-nuget.ps1" -DryRun }.GetNewClosure() `
            -Description 'NuGet dry-run')
        (New-MenuItem -Label 'Publish NuGet' -HotKey '7' `
            -Action { & "$publishScriptsDir\publish-nuget.ps1" }.GetNewClosure() `
            -Description 'Publish to nuget.org')
    ) -Description 'xUnit test framework and NuGet publishing'))
}

# ---------------------------------------------------------------------------
#  Entry point
# ---------------------------------------------------------------------------

$allItems = $items.ToArray()

if ($List) {
    Invoke-MenuList -Items $allItems
    return
}

if ($Run) {
    $code = Invoke-MenuRun -Items $allItems -HotKey $Run
    exit $code
}

Run-Menu -Title 'LiveDoc' `
         -AppName 'LiveDoc Launcher (v2)' `
         -Subtitle 'menu-framework v1.0.0' `
         -Items $allItems `
         -QuitFlag 'AppQuit'
