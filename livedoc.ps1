[CmdletBinding()]
param(
    # If set, runs the specified command (e.g. 'build') and exits.
    [Parameter(Position = 0)]
    [string]$Command,

    # If set, prints available packages/scripts and exits (no interactive UI).
    [switch]$List
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path $PSScriptRoot
$script:LiveDocQuit = $false

function Pause-AnyKey([string]$message = 'Press any key to continue...') {
    Write-Host ''
    Write-Host $message -ForegroundColor DarkGray
    [void][System.Console]::ReadKey($true)
}

function Invoke-InDirectory {
    param(
        [Parameter(Mandatory)]
        [string]$WorkingDirectory,

        [Parameter(Mandatory)]
        [string]$Executable,

        [Parameter()]
        [string[]]$Arguments = @()
    )

    if (-not (Test-Path $WorkingDirectory)) {
        throw "Working directory not found: $WorkingDirectory"
    }

    Push-Location $WorkingDirectory
    try {
        Write-Host "" 
        Write-Host "==> $Executable $($Arguments -join ' ')" -ForegroundColor Cyan
        & $Executable @Arguments
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0) {
            Write-Host "" 
            Write-Host "Exit code: $exitCode" -ForegroundColor Red
        } else {
            Write-Host "" 
            Write-Host "Exit code: $exitCode" -ForegroundColor Green
        }
        $script:LiveDocLastExitCode = $exitCode
        return
    } finally {
        Pop-Location
    }
}

function Run-Build {
    Write-Host "Starting local release build..." -ForegroundColor Cyan
    
    # 1. Clean all packages
    Write-Host "Cleaning workspace..." -ForegroundColor Cyan
    Invoke-InDirectory -WorkingDirectory $repoRoot -Executable 'pnpm' -Arguments @('run', 'clean')

    # 2. Install dependencies
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    Invoke-InDirectory -WorkingDirectory $repoRoot -Executable 'pnpm' -Arguments @('install')
    
    # 3. Build all packages
    Write-Host "Building all packages..." -ForegroundColor Cyan
    Invoke-InDirectory -WorkingDirectory $repoRoot -Executable 'pnpm' -Arguments @('run', 'build')
    
    # 4. Package VS Code extension
    $vscodeDir = Join-Path $repoRoot 'packages/vscode'
    if (Test-Path $vscodeDir) {
        Write-Host "Packaging VS Code extension..." -ForegroundColor Cyan
        Invoke-InDirectory -WorkingDirectory $vscodeDir -Executable 'pnpm' -Arguments @('run', 'package')
    }

    # 5. Package Vitest package
    $vitestDir = Join-Path $repoRoot 'packages/vitest'
    if (Test-Path $vitestDir) {
        Write-Host "Packaging Vitest package..." -ForegroundColor Cyan
        Invoke-InDirectory -WorkingDirectory $vitestDir -Executable 'pnpm' -Arguments @('run', 'pack:local')
    }
    
    Sync-Releases
    Write-Host "Build complete!" -ForegroundColor Green
}

function Run-BuildPackages {
    Write-Host "Building packages (incremental)..." -ForegroundColor Cyan
    Write-Host "This builds packages individually to keep library code up to date." -ForegroundColor DarkGray

    $schemaDir = Join-Path $repoRoot 'packages/schema'
    $serverDir = Join-Path $repoRoot 'packages/server'
    $vitestDir = Join-Path $repoRoot 'packages/vitest'
    $viewerDir = Join-Path $repoRoot 'packages/viewer'
    $vscodeDir = Join-Path $repoRoot 'packages/vscode'

    if (Test-Path $schemaDir) { Invoke-InDirectory -WorkingDirectory $schemaDir -Executable 'pnpm' -Arguments @('run', 'build') }
    if (Test-Path $serverDir) { Invoke-InDirectory -WorkingDirectory $serverDir -Executable 'pnpm' -Arguments @('run', 'build') }
    if (Test-Path $vitestDir) { Invoke-InDirectory -WorkingDirectory $vitestDir -Executable 'pnpm' -Arguments @('run', 'build') }
    if (Test-Path $viewerDir) { Invoke-InDirectory -WorkingDirectory $viewerDir -Executable 'pnpm' -Arguments @('run', 'build') }
    if (Test-Path $vscodeDir) { Invoke-InDirectory -WorkingDirectory $vscodeDir -Executable 'pnpm' -Arguments @('run', 'compile') }

    Write-Host "Package builds complete." -ForegroundColor Green
}

function Sync-Releases {
    $releasesDir = Join-Path $repoRoot 'releases'
    if (-not (Test-Path $releasesDir)) {
        New-Item -ItemType Directory -Path $releasesDir | Out-Null
    }

    Write-Host "Syncing artifacts to releases folder..." -ForegroundColor Cyan

    # VS Code extension
    $vscodeDir = Join-Path $repoRoot 'packages/vscode'
    if (Test-Path $vscodeDir) {
        Get-ChildItem -Path $vscodeDir -Filter "*.vsix" | Copy-Item -Destination $releasesDir -ErrorAction SilentlyContinue
    }

    # Vitest package
    $vitestDir = Join-Path $repoRoot 'packages/vitest'
    if (Test-Path $vitestDir) {
        Get-ChildItem -Path $vitestDir -Filter "*.tgz" | Copy-Item -Destination $releasesDir -ErrorAction SilentlyContinue
    }

    $artifacts = @(Get-ChildItem -Path $releasesDir)
    if ($artifacts.Count -gt 0) {
        Write-Host "Current artifacts in releases:" -ForegroundColor White
        foreach ($a in $artifacts) {
            Write-Host "  - $($a.Name)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  (No artifacts found)" -ForegroundColor DarkGray
    }
}

function Get-PackageInfo {
    param(
        [Parameter(Mandatory)]
        [string]$PackageJsonPath
    )

    $pkgDir = Split-Path -Parent $PackageJsonPath
    $json = Get-Content -Path $PackageJsonPath -Raw | ConvertFrom-Json

    $scripts = @()
    if ($null -ne $json.scripts) {
        $scripts = $json.scripts.PSObject.Properties |
            ForEach-Object {
                [PSCustomObject]@{
                    Name  = $_.Name
                    Value = [string]$_.Value
                }
            }
    }

    return [PSCustomObject]@{
        Name       = [string]$json.name
        Directory  = $pkgDir
        Scripts    = $scripts
    }
}

function Select-ScriptsForMenu {
    param(
        [Parameter(Mandatory)]
        [object[]]$Scripts
    )

    # Include dev, build, package, test, validate, typecheck
    $wanted = $Scripts | Where-Object {
        $_.Name -match '^(dev|test|validate|build|compile|package|pack)' -or $_.Name -eq 'typecheck'
    }

    # Keep stable ordering: dev*, build, package, test*, validate*, typecheck
    $wanted = $wanted | Sort-Object {
        if ($_.Name -match '^dev') { 0 }
        elseif ($_.Name -eq 'build') { 1 }
        elseif ($_.Name -match '^package|^pack') { 2 }
        elseif ($_.Name -match '^compile') { 3 }
        elseif ($_.Name -match '^test') { 4 }
        elseif ($_.Name -match '^validate') { 5 }
        elseif ($_.Name -eq 'typecheck') { 6 }
        else { 9 }
    }, Name

    return ,$wanted
}

function New-MenuItem {
    param(
        [Parameter(Mandatory)]
        [string]$Label,

        [Parameter()]
        [char]$HotKey = [char]0,

        [Parameter()]
        [scriptblock]$Action,

        [Parameter()]
        [object[]]$Children = @()
    )

    [PSCustomObject]@{
        Label    = $Label
        HotKey   = $HotKey
        Action   = $Action
        Children = $Children
    }
}

function Render-Menu {
    param(
        [Parameter(Mandatory)]
        [string]$Title,

        [Parameter(Mandatory)]
        [object[]]$Items,

        [Parameter(Mandatory)]
        [int]$SelectedIndex
    )

    Clear-Host
    Write-Host "LiveDoc Launcher" -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor White
    Write-Host "" 

    for ($i = 0; $i -lt $Items.Count; $i++) {
        $item = $Items[$i]
        $prefix = if ($i -eq $SelectedIndex) { '>' } else { ' ' }

        $hk = ''
        if ($item.HotKey -ne [char]0) {
            $hk = "[$($item.HotKey)] "
        }

        if ($i -eq $SelectedIndex) {
            Write-Host "$prefix $hk$($item.Label)" -ForegroundColor Black -BackgroundColor Gray
        } else {
            Write-Host "$prefix $hk$($item.Label)" -ForegroundColor Gray
        }
    }

    Write-Host "" 
    Write-Host "↑/↓ navigate, Enter select, Esc back, Q quit, hotkey to jump" -ForegroundColor DarkGray
}

function Find-ByHotKey {
    param(
        [Parameter(Mandatory)]
        [object[]]$Items,

        [Parameter(Mandatory)]
        [char]$HotKey
    )

    for ($i = 0; $i -lt $Items.Count; $i++) {
        if ($Items[$i].HotKey -ne [char]0 -and ([char]::ToUpperInvariant($Items[$i].HotKey) -eq [char]::ToUpperInvariant($HotKey))) {
            return $i
        }
    }

    return -1
}

function Run-Menu {
    param(
        [Parameter(Mandatory)]
        [object]$RootMenu
    )

    $stack = New-Object System.Collections.Generic.List[object]
    $stack.Add([PSCustomObject]@{
        Title = $RootMenu.Title
        Items = $RootMenu.Items
        SelectedIndex = 0
    })

    while ($stack.Count -gt 0) {
        if ($script:LiveDocQuit) {
            return
        }

        $currentFrameIndex = $stack.Count - 1
        $current = $stack[$currentFrameIndex]
        $items = @($current.Items)

        if ($items.Count -eq 0) {
            # Nothing to show; just go back.
            [void]$stack.RemoveAt($stack.Count - 1)
            continue
        }

        if ($current.SelectedIndex -lt 0) { $current.SelectedIndex = 0 }
        if ($current.SelectedIndex -ge $items.Count) { $current.SelectedIndex = $items.Count - 1 }

        Render-Menu -Title $current.Title -Items $items -SelectedIndex $current.SelectedIndex

        $keyInfo = [System.Console]::ReadKey($true)

        switch ($keyInfo.Key) {
            'UpArrow' {
                $current.SelectedIndex = ($current.SelectedIndex - 1)
                if ($current.SelectedIndex -lt 0) { $current.SelectedIndex = $items.Count - 1 }
            }
            'DownArrow' {
                $current.SelectedIndex = ($current.SelectedIndex + 1)
                if ($current.SelectedIndex -ge $items.Count) { $current.SelectedIndex = 0 }
            }
            'Escape' {
                [void]$stack.RemoveAt($stack.Count - 1)
            }
            'Enter' {
                $selected = $items[$current.SelectedIndex]
                if ($selected.Children -and @($selected.Children).Count -gt 0) {
                    $stack.Add([PSCustomObject]@{
                        Title = $selected.Label
                        Items = $selected.Children
                        SelectedIndex = 0
                    })
                } elseif ($null -ne $selected.Action) {
                    Clear-Host
                    & $selected.Action
                    if ($script:LiveDocQuit) {
                        return
                    }
                    Pause-AnyKey
                }
            }
            default {
                $ch = $keyInfo.KeyChar
                if ($ch -eq 'q' -or $ch -eq 'Q') {
                    return
                }

                if ($ch -ne [char]0) {
                    $idx = Find-ByHotKey -Items $items -HotKey $ch
                    if ($idx -ge 0) {
                        $current.SelectedIndex = $idx

                        # If the hotkey points to a leaf action, execute immediately.
                        $hit = $items[$idx]
                        if (-not ($hit.Children -and @($hit.Children).Count -gt 0) -and $null -ne $hit.Action) {
                            Clear-Host
                            & $hit.Action
                            if ($script:LiveDocQuit) {
                                return
                            }
                            Pause-AnyKey
                        }
                    }
                }
            }
        }

        # Note: $current is a reference to the current frame object, so updating
        # $current.SelectedIndex already persists. Do not overwrite the top of
        # the stack here, otherwise entering a submenu gets clobbered.
    }
}

function Build-PnpmScriptMenuItems {
    param(
        [Parameter(Mandatory)]
        [string]$PackageDir,

        [Parameter(Mandatory)]
        [string]$PackageDisplay,

        [Parameter(Mandatory)]
        [object[]]$Scripts
    )

    $menuScripts = Select-ScriptsForMenu -Scripts $Scripts

    $items = New-Object System.Collections.Generic.List[object]

    # Special-case: vitest package gets a “run single spec file” helper because it’s common.
    if ($PackageDisplay -eq '@livedoc/vitest') {
        $items.Add((New-MenuItem -Label 'test:spec (prompt for file path)' -HotKey 'f' -Action ({
            $path = Read-Host "Enter spec path (relative to packages/vitest), e.g. _src/test/ScenarioOutline.Spec.ts"
            if (-not $path) { return }
            Invoke-InDirectory -WorkingDirectory (Join-Path $repoRoot 'packages/vitest') -Executable 'pnpm' -Arguments @('run', 'test:spec', '--', $path)
        }.GetNewClosure())))
    }

    $hotKeyNumber = 1
    foreach ($s in $menuScripts) {
        $name = [string]$s.Name
        $value = [string]$s.Value

        # Use predictable numeric hotkeys (1-9) to avoid collisions.
        $hk = [char]0
        if ($hotKeyNumber -le 9) {
            $hk = [char]([string]$hotKeyNumber)
            $hotKeyNumber++
        }

        $label = "$name  —  $value"
        $packageDirLocal = $PackageDir
        $scriptNameLocal = $name
        $items.Add((New-MenuItem -Label $label -HotKey $hk -Action ({
            Invoke-InDirectory -WorkingDirectory $packageDirLocal -Executable 'pnpm' -Arguments @('run', $scriptNameLocal)
            
            # If this was a package script, sync the artifacts to the root releases folder
            if ($scriptNameLocal -match 'package|pack') {
                Sync-Releases
            }
        }.GetNewClosure())))
    }

    return ,$items.ToArray()
}

# ---- Discover packages ----
$packages = New-Object System.Collections.Generic.List[object]

$rootPkgJson = Join-Path $repoRoot 'package.json'
if (Test-Path $rootPkgJson) {
    $rootInfo = Get-PackageInfo -PackageJsonPath $rootPkgJson
    $packages.Add([PSCustomObject]@{ Kind = 'pnpm'; Name = 'Root'; Directory = $repoRoot; Scripts = $rootInfo.Scripts })
}

$packagesDir = Join-Path $repoRoot 'packages'
if (Test-Path $packagesDir) {
    $pkgJsons = Get-ChildItem -Path $packagesDir -Recurse -Filter 'package.json' -File |
        Where-Object { $_.FullName -notmatch '\\node_modules\\' }

    foreach ($pj in $pkgJsons) {
        $info = Get-PackageInfo -PackageJsonPath $pj.FullName
        $packages.Add([PSCustomObject]@{ Kind = 'pnpm'; Name = $info.Name; Directory = $info.Directory; Scripts = $info.Scripts })
    }
}

# Dotnet integration (optional)
$dotnetSln = Join-Path $repoRoot 'dotnet/xunit/livedoc-xunit.sln'
if (Test-Path $dotnetSln) {
    $packages.Add([PSCustomObject]@{ Kind = 'dotnet'; Name = 'dotnet/xunit'; Directory = (Split-Path -Parent $dotnetSln); Sln = $dotnetSln })
}

# Prefer stable ordering for the main menu
$packages = $packages | Sort-Object {
    switch -Regex ($_.Name) {
        '^Root$' { 0 }
        '^@swedevtools/livedoc-vitest$' { 1 }
        '^@swedevtools/livedoc-server$' { 2 }
        '^@swedevtools/livedoc-viewer$' { 3 }
        '^@swedevtools/livedoc-schema$' { 4 }
        '^livedoc-vscode$' { 5 }
        '^dotnet/xunit$' { 6 }
        default { 50 }
    }
}, Name

if ($List) {
    foreach ($p in $packages) {
        Write-Host "- $($p.Name)" -ForegroundColor Cyan
        if ($p.Kind -eq 'pnpm') {
            $menuScripts = Select-ScriptsForMenu -Scripts $p.Scripts
            foreach ($s in $menuScripts) {
                Write-Host "    - $($s.Name): $($s.Value)" -ForegroundColor Gray
            }
        } elseif ($p.Kind -eq 'dotnet') {
            Write-Host "    - dotnet test" -ForegroundColor Gray
        }
    }
    return
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Clear-Host
    Write-Host "pnpm was not found on PATH." -ForegroundColor Red
    Write-Host "Install pnpm or open a shell where pnpm is available." -ForegroundColor Yellow
    Pause-AnyKey
    exit 1
}

if ($Command -eq 'help' -or $Command -eq '-h' -or $Command -eq '--help') {
    Write-Host "LiveDoc Launcher" -ForegroundColor Cyan
    Write-Host "Usage: livedoc [command]" -ForegroundColor White
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor White
    Write-Host "  build    Run a full local release build (install, build, package)" -ForegroundColor Gray
    Write-Host "  build-packages    Build packages individually (fast incremental)" -ForegroundColor Gray
    Write-Host "  clean    Clean all packages" -ForegroundColor Gray
    Write-Host "  test     Run all tests" -ForegroundColor Gray
    Write-Host "  -List    List all available package scripts (including build/package)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "If no command is provided, the interactive menu will be shown." -ForegroundColor Gray
    Write-Host "Package submenus now include build, compile, and package scripts." -ForegroundColor Gray
    return
}

if ($Command -eq 'build') {
    Run-Build
    return
}

if ($Command -eq 'build-packages' -or $Command -eq 'build:packages') {
    Run-BuildPackages
    return
}

if ($Command -eq 'clean') {
    Invoke-InDirectory -WorkingDirectory $repoRoot -Executable 'pnpm' -Arguments @('run', 'clean')
    $releasesDir = Join-Path $repoRoot 'releases'
    if (Test-Path $releasesDir) {
        Write-Host "Cleaning releases folder..." -ForegroundColor Cyan
        Remove-Item -Path "$releasesDir\*" -Recurse -Force
    }
    return
}

if ($Command -eq 'test') {
    Invoke-InDirectory -WorkingDirectory $repoRoot -Executable 'pnpm' -Arguments @('run', 'test')
    return
}

# ---- Build menus ----
$packageMenuItems = New-Object System.Collections.Generic.List[object]

# Add Dev All option
$packageMenuItems.Add((New-MenuItem -Label 'Dev All (Viewer + Server)' -HotKey 'a' -Action ({
    Invoke-InDirectory -WorkingDirectory (Join-Path $repoRoot 'packages/viewer') -Executable 'pnpm' -Arguments @('run', 'dev:all')
}.GetNewClosure())))

# Add Build All option
$packageMenuItems.Add((New-MenuItem -Label 'Build All (pnpm build + package)' -HotKey 'b' -Action ({
    Run-Build
}.GetNewClosure())))

# Add Build Packages option (fast incremental)
$packageMenuItems.Add((New-MenuItem -Label 'Build Packages (schema/server/vitest/viewer/vscode)' -HotKey 'p' -Action ({
    Run-BuildPackages
}.GetNewClosure())))

$packageMenuItems.Add((New-MenuItem -Label 'Clean All (pnpm clean)' -HotKey 'x' -Action ({
    Invoke-InDirectory -WorkingDirectory $repoRoot -Executable 'pnpm' -Arguments @('run', 'clean')
    $releasesDir = Join-Path $repoRoot 'releases'
    if (Test-Path $releasesDir) {
        Write-Host "Cleaning releases folder..." -ForegroundColor Cyan
        Remove-Item -Path "$releasesDir\*" -Recurse -Force
    }
}.GetNewClosure())))

# Add Publish submenu with nested submenus for each package
$schemaPublishChildren = @(
    (New-MenuItem -Label 'Dry-run' -HotKey '1' -Action ({ & (Join-Path $repoRoot 'scripts/publish-package.ps1') -Package schema -DryRun }.GetNewClosure())),
    (New-MenuItem -Label 'Release (latest)' -HotKey '2' -Action ({ & (Join-Path $repoRoot 'scripts/publish-package.ps1') -Package schema }.GetNewClosure())),
    (New-MenuItem -Label 'Beta' -HotKey '3' -Action ({ & (Join-Path $repoRoot 'scripts/publish-package.ps1') -Package schema -Tag beta }.GetNewClosure()))
)
$serverPublishChildren = @(
    (New-MenuItem -Label 'Dry-run' -HotKey '1' -Action ({ & (Join-Path $repoRoot 'scripts/publish-package.ps1') -Package server -DryRun }.GetNewClosure())),
    (New-MenuItem -Label 'Release (latest)' -HotKey '2' -Action ({ & (Join-Path $repoRoot 'scripts/publish-package.ps1') -Package server }.GetNewClosure())),
    (New-MenuItem -Label 'Beta' -HotKey '3' -Action ({ & (Join-Path $repoRoot 'scripts/publish-package.ps1') -Package server -Tag beta }.GetNewClosure()))
)
$vitestPublishChildren = @(
    (New-MenuItem -Label 'Dry-run' -HotKey '1' -Action ({ & (Join-Path $repoRoot 'scripts/publish-package.ps1') -Package vitest -DryRun }.GetNewClosure())),
    (New-MenuItem -Label 'Release (latest)' -HotKey '2' -Action ({ & (Join-Path $repoRoot 'scripts/publish-package.ps1') -Package vitest }.GetNewClosure())),
    (New-MenuItem -Label 'Beta' -HotKey '3' -Action ({ & (Join-Path $repoRoot 'scripts/publish-package.ps1') -Package vitest -Tag beta }.GetNewClosure()))
)
$viewerPublishChildren = @(
    (New-MenuItem -Label 'Dry-run' -HotKey '1' -Action ({ & (Join-Path $repoRoot 'scripts/publish-package.ps1') -Package viewer -DryRun }.GetNewClosure())),
    (New-MenuItem -Label 'Release (latest)' -HotKey '2' -Action ({ & (Join-Path $repoRoot 'scripts/publish-package.ps1') -Package viewer }.GetNewClosure())),
    (New-MenuItem -Label 'Beta' -HotKey '3' -Action ({ & (Join-Path $repoRoot 'scripts/publish-package.ps1') -Package viewer -Tag beta }.GetNewClosure()))
)

$publishChildren = @(
    (New-MenuItem -Label 'All (dry-run)' -HotKey '1' -Action ({
        & (Join-Path $repoRoot 'scripts/publish-package.ps1') -Package all -DryRun
    }.GetNewClosure())),
    (New-MenuItem -Label 'All (release)' -HotKey '2' -Action ({
        & (Join-Path $repoRoot 'scripts/publish-package.ps1') -Package all
    }.GetNewClosure())),
    (New-MenuItem -Label 'All (beta)' -HotKey '3' -Action ({
        & (Join-Path $repoRoot 'scripts/publish-package.ps1') -Package all -Tag beta
    }.GetNewClosure())),
    (New-MenuItem -Label '─────────────────────' -HotKey ([char]0) -Action $null),
    (New-MenuItem -Label 'schema...' -HotKey '4' -Children $schemaPublishChildren),
    (New-MenuItem -Label 'server...' -HotKey '5' -Children $serverPublishChildren),
    (New-MenuItem -Label 'vitest...' -HotKey '6' -Children $vitestPublishChildren),
    (New-MenuItem -Label 'viewer...' -HotKey '7' -Children $viewerPublishChildren)
)
$packageMenuItems.Add((New-MenuItem -Label 'Publish to npm...' -HotKey 'n' -Children $publishChildren))

foreach ($p in $packages) {
    $hotKey = [char]0
    switch ($p.Name) {
        'Root' { $hotKey = 'r' }
        '@swedevtools/livedoc-vitest' { $hotKey = 'v' }
        '@swedevtools/livedoc-server' { $hotKey = 's' }
        '@swedevtools/livedoc-viewer' { $hotKey = 'w' }
        '@swedevtools/livedoc-schema' { $hotKey = 'm' }
        'livedoc-vscode' { $hotKey = 'c' }
        'dotnet/xunit' { $hotKey = 'd' }
    }

    if ($p.Kind -eq 'pnpm') {
        $children = Build-PnpmScriptMenuItems -PackageDir $p.Directory -PackageDisplay $p.Name -Scripts $p.Scripts

        # If a package has no tests/validation scripts, still show it but with empty submenu.
        $packageMenuItems.Add((New-MenuItem -Label $p.Name -HotKey $hotKey -Children $children))
    } elseif ($p.Kind -eq 'dotnet') {
        $dotnetSlnLocal = $dotnetSln
        $dotnetDirLocal = (Join-Path $repoRoot 'dotnet/xunit')
        $children = @(
            (New-MenuItem -Label 'dotnet test (solution)' -HotKey 't' -Action ({
                Invoke-InDirectory -WorkingDirectory $dotnetDirLocal -Executable 'dotnet' -Arguments @('test', $dotnetSlnLocal)
            }.GetNewClosure()))
        )

        $packageMenuItems.Add((New-MenuItem -Label $p.Name -HotKey $hotKey -Children $children))
    }
}

# Visible quit option
$packageMenuItems.Add((New-MenuItem -Label 'Quit' -HotKey 'q' -Action ({
    $script:LiveDocQuit = $true
}.GetNewClosure())))

$rootMenu = [PSCustomObject]@{
    Title = "Select a package"
    Items = $packageMenuItems.ToArray()
}

Run-Menu -RootMenu $rootMenu
