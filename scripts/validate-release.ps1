<#
.SYNOPSIS
    Validates local release packages by installing and smoke-testing them.

.DESCRIPTION
    Installs each release tarball in an isolated project-local staging directory and runs
    smoke tests to verify the package is functional:

    - Viewer:  npm install → livedoc-viewer --version
    - Vitest:  npm install → node -e "import(...)"
    - xUnit (opt-in): archive/version checks → offline package consumption on .NET 8 and 10

    Use this BEFORE distributing releases and AFTER re-packing to confirm
    the fix actually works.

.PARAMETER ViewerTgz
    Path to the viewer .tgz. Defaults to latest in releases/@swedevtools/livedoc-viewer/.

.PARAMETER VitestTgz
    Path to the vitest .tgz. Defaults to latest in releases/@swedevtools/livedoc-vitest/.

.PARAMETER SkipViewer
    Skip viewer validation.

.PARAMETER SkipVitest
    Skip vitest validation.

.PARAMETER ViewerNativeBrowser
    Require current-build byte equality and real browser checks for persisted
    Standard/Test reports, static export, native details, and responsive views.

.PARAMETER XunitNupkg
    Explicit xUnit .nupkg path. Omit to leave existing npm-only validation unchanged.

.PARAMETER XunitConfiguration
    Configuration whose freshly built assemblies are compared with the xUnit archive.

.EXAMPLE
    .\validate-release.ps1
    Validate latest viewer and vitest tarballs.

.EXAMPLE
    .\validate-release.ps1 -SkipVitest
    Validate only the viewer tarball.

.EXAMPLE
    .\validate-release.ps1 -XunitNupkg releases\SweDevTools.LiveDoc.xUnit\SweDevTools.LiveDoc.xUnit.0.4.0.nupkg -SkipViewer -SkipVitest
    Validate only the local xUnit package.
#>

[CmdletBinding()]
param(
    [string]$ViewerTgz,
    [string]$VitestTgz,
    [switch]$SkipViewer,
    [switch]$SkipVitest,
    [switch]$ViewerNativeBrowser,
    [string]$XunitNupkg,
    [ValidateSet('Release', 'Debug')]
    [string]$XunitConfiguration = 'Release'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')

# ── Helpers ──────────────────────────────────────────────────────────────

function Find-LatestTgz {
    param([string]$Dir, [string]$Glob)
    $files = Get-ChildItem -Path $Dir -Filter $Glob -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending
    if ($files.Count -eq 0) { return $null }
    return $files[0].FullName
}

function Write-Pass { param([string]$Msg) Write-Host "  ✅ PASS: $Msg" -ForegroundColor Green }
function Write-Fail { param([string]$Msg) Write-Host "  ❌ FAIL: $Msg" -ForegroundColor Red }
function Write-Check { param([string]$Msg) Write-Host "  🔍 $Msg" -ForegroundColor Cyan }
function Write-Section { param([string]$Msg)
    Write-Host ""
    Write-Host "─────────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "  $Msg" -ForegroundColor White
    Write-Host "─────────────────────────────────────────────────────" -ForegroundColor DarkGray
}

$totalPass = 0
$totalFail = 0
$failures = @()

function Record-Pass { param([string]$Name) $script:totalPass++ }
function Record-Fail { param([string]$Name, [string]$Detail)
    $script:totalFail++
    $script:failures += "$Name`: $Detail"
}

# ── Resolve tarballs ─────────────────────────────────────────────────────

$viewerDir = Join-Path $repoRoot 'releases\@swedevtools\livedoc-viewer'
$vitestDir = Join-Path $repoRoot 'releases\@swedevtools\livedoc-vitest'

if (-not $SkipViewer -and -not $ViewerTgz) {
    $ViewerTgz = Find-LatestTgz -Dir $viewerDir -Glob 'swedevtools-livedoc-viewer-*.tgz'
}
if (-not $SkipVitest -and -not $VitestTgz) {
    $VitestTgz = Find-LatestTgz -Dir $vitestDir -Glob 'swedevtools-livedoc-vitest-*.tgz'
}

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Yellow
Write-Host "║        LiveDoc Release Validation                     ║" -ForegroundColor Yellow
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Yellow

if (-not $SkipViewer) {
    if ($ViewerTgz) {
        Write-Host "  Viewer:  $(Split-Path $ViewerTgz -Leaf)" -ForegroundColor Gray
    } else {
        Write-Host "  Viewer:  NOT FOUND — skipping" -ForegroundColor DarkYellow
        $SkipViewer = $true
    }
}
if (-not $SkipVitest) {
    if ($VitestTgz) {
        Write-Host "  Vitest:  $(Split-Path $VitestTgz -Leaf)" -ForegroundColor Gray
    } else {
        Write-Host "  Vitest:  NOT FOUND — skipping" -ForegroundColor DarkYellow
        $SkipVitest = $true
    }
}

# ── Viewer Validation ────────────────────────────────────────────────────

if (-not $SkipViewer) {
    Write-Section "Viewer: @swedevtools/livedoc-viewer"

    $stageDir = Join-Path $repoRoot "releases\local-validation\viewer-$([guid]::NewGuid().ToString('N'))"
    New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

    try {
        # ── Test 0: Tarball content verification (pre-install) ──
        # Checks the archive directly — catches issues before npm touches anything
        Write-Check "Verifying tarball contents (pre-install)..."
        $tarEntries = tar -tzf $ViewerTgz 2>&1 | Out-String

        # 0a: No '../' paths
        if ($tarEntries -match '\.\.\/') {
            Write-Fail "Tarball archive contains '../' relative paths"
            Record-Fail "viewer/tar-archive-paths" "Archive has '../' entries"
        } else {
            Write-Pass "No '../' paths in archive"
            Record-Pass "viewer/tar-archive-paths"
        }

        # 0b: zod stubs present in archive
        $zodStubsInArchive = @('typeAliases.js', 'partialUtil.js')
        $missingInArchive = @()
        foreach ($stub in $zodStubsInArchive) {
            if ($tarEntries -notmatch "zod/v3/helpers/$stub") {
                $missingInArchive += $stub
            }
        }
        if ($missingInArchive.Count -gt 0) {
            Write-Fail "Archive missing zod stubs: $($missingInArchive -join ', ')"
            Record-Fail "viewer/tar-archive-zod" "Missing in archive: $($missingInArchive -join ', ')"
        } else {
            Write-Pass "zod v3 helper stubs present in archive"
            Record-Pass "viewer/tar-archive-zod"
        }

        # 0c: package.json in archive has no workspace:*
        $archivePkgDir = Join-Path $stageDir 'archive'
        New-Item -ItemType Directory -Path $archivePkgDir -Force | Out-Null
        tar -xzf $ViewerTgz -C $archivePkgDir 'package/package.json' 2>&1 | Out-Null
        $archivePkgContent = Get-Content (Join-Path $archivePkgDir 'package\package.json') -Raw -ErrorAction SilentlyContinue
        Remove-Item $archivePkgDir -Recurse -Force -ErrorAction SilentlyContinue
        if ($archivePkgContent -match 'workspace:\*|workspace:\^|workspace:~') {
            Write-Fail "Archive package.json has unresolved workspace:* references"
            Record-Fail "viewer/tar-archive-workspace" "workspace:* in archived package.json"
        } else {
            Write-Pass "Archive package.json has resolved dependency versions"
            Record-Pass "viewer/tar-archive-workspace"
        }

        $archivePackage = $archivePkgContent | ConvertFrom-Json
        $expectedViewerVersion = (Get-Content (Join-Path $repoRoot 'packages\viewer\package.json') -Raw | ConvertFrom-Json).version
        if ($archivePackage.version -ne $expectedViewerVersion) {
            throw "Viewer archive version '$($archivePackage.version)' does not match current source '$expectedViewerVersion'."
        }
        $semVerPattern = '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$'
        if ($archivePackage.version -notmatch $semVerPattern) {
            Write-Fail "Archive version '$($archivePackage.version)' is not valid npm SemVer"
            Record-Fail "viewer/npm-semver" "Invalid version: $($archivePackage.version)"
        } else {
            Write-Pass "Archive version '$($archivePackage.version)' is valid npm SemVer"
            Record-Pass "viewer/npm-semver"
        }

        # 0d: Vite-bundled browser libraries must not be embedded again as source packages
        $browserOnlyPackages = @(
            'lucide-react',
            'react',
            'react-dom',
            'react-json-view-lite',
            'framer-motion',
            'motion-dom',
            '@radix-ui',
            'react-markdown',
            'remark-gfm',
            'tailwind-merge',
            'tailwindcss-animate',
            'zustand'
        )
        $bundledBrowserPackages = @()
        foreach ($browserPackage in $browserOnlyPackages) {
            if ($tarEntries -match [regex]::Escape("package/node_modules/$browserPackage/")) {
                $bundledBrowserPackages += $browserPackage
            }
        }
        if ($bundledBrowserPackages.Count -gt 0) {
            Write-Fail "Archive duplicates Vite-bundled browser packages: $($bundledBrowserPackages -join ', ')"
            Record-Fail "viewer/tar-browser-dependencies" ($bundledBrowserPackages -join ', ')
        } else {
            Write-Pass "No Vite-bundled browser source packages in archive"
            Record-Pass "viewer/tar-browser-dependencies"
        }

        if ($ViewerNativeBrowser) {
            Write-Check "Comparing packaged client, server, and webview against the current build..."
            $distArchive = Join-Path $stageDir 'dist-archive'
            New-Item -ItemType Directory -Path $distArchive -Force | Out-Null
            tar -xzf $ViewerTgz -C $distArchive 'package/dist'
            if ($LASTEXITCODE -ne 0) { throw "Could not extract Viewer dist for verification." }
            $currentDist = Join-Path $repoRoot 'packages\viewer\dist'
            $packagedDist = Join-Path $distArchive 'package\dist'
            $currentFiles = @(Get-ChildItem $currentDist -File -Recurse)
            $packagedFiles = @(Get-ChildItem $packagedDist -File -Recurse)
            if ($currentFiles.Count -ne $packagedFiles.Count) { throw "Packaged dist inventory differs from the current build." }
            foreach ($file in $currentFiles) {
                $relative = [System.IO.Path]::GetRelativePath($currentDist, $file.FullName)
                $packedFile = Join-Path $packagedDist $relative
                if (-not (Test-Path $packedFile) -or
                    (Get-FileHash $file.FullName).Hash -ne (Get-FileHash $packedFile).Hash) {
                    throw "Packaged build is stale: $relative"
                }
            }
            foreach ($surface in @('client', 'webview')) {
                $bundles = @(Get-ChildItem (Join-Path $packagedDist $surface) -Filter '*.js' -Recurse)
                $bundleText = ($bundles | ForEach-Object { Get-Content $_.FullName -Raw }) -join "`n"
                if ($bundleText -notmatch 'Standard test containers' -or
                    $bundleText -notmatch 'ctrlKey' -or $bundleText -notmatch 'deltaY') {
                    throw "$surface is missing native-test presentation or Ctrl-wheel zoom."
                }
            }
            Write-Pass "Packaged dist matches all $($currentFiles.Count) current build files, with native tests and Ctrl-wheel in both browser surfaces"
            Record-Pass "viewer/current-build-native-zoom"
        }

        # ── Test 1: offline npm install from an empty cache ──
        # The Viewer embeds its private Server/Schema runtime closure and must not
        # rely on registry downloads after the tarball is acquired.
        Write-Check "Installing tarball offline from an empty npm cache..."
        $offlineCache = Join-Path $stageDir '.npm-cache'
        New-Item -ItemType Directory -Path $offlineCache -Force | Out-Null
        $installLog = & npm install `
            --offline `
            --cache $offlineCache `
            --prefix $stageDir `
            --ignore-scripts `
            --no-audit `
            --fund=false `
            $ViewerTgz 2>&1 | Out-String
        $installExitCode = $LASTEXITCODE

        if ($installExitCode -ne 0) {
            Write-Fail "npm install failed with exit code $installExitCode"
            Record-Fail "viewer/install" "npm install exited $installExitCode"
        } elseif ($installLog -match 'TAR_ENTRY_ERROR') {
            Write-Fail "Tarball contains '../' relative paths (TAR_ENTRY_ERROR)"
            Record-Fail "viewer/tar-paths" "Tarball has '../' entries blocked by npm"
        } else {
            Write-Pass "Offline npm install completed without tar errors"
            Record-Pass "viewer/tar-paths"
        }

        # Check for EUNSUPPORTEDPROTOCOL (workspace:*)
        if ($installLog -match 'EUNSUPPORTEDPROTOCOL|workspace:') {
            Write-Fail "Package has unresolved workspace:* protocol references"
            Record-Fail "viewer/workspace-protocol" "workspace:* not resolved to real versions"
        } else {
            Write-Pass "No workspace:* protocol errors"
            Record-Pass "viewer/workspace-protocol"
        }

        # ── Test 2: --version (basic import works) ──
        Write-Check "Running livedoc-viewer --version..."
        $binPath = Join-Path $stageDir 'node_modules\.bin\livedoc-viewer.cmd'
        if (-not (Test-Path $binPath)) {
            $binPath = Join-Path $stageDir 'node_modules\.bin\livedoc-viewer'
        }

        if (Test-Path $binPath) {
            $versionOutput = $null
            $versionError = $null
            try {
                $versionOutput = & $binPath --version 2>&1 | Out-String
                if ($LASTEXITCODE -ne 0) {
                    $versionError = $versionOutput
                }
            } catch {
                $versionError = $_.Exception.Message
            }

            if ($versionError) {
                # Check for specific known errors
                if ($versionError -match 'ERR_MODULE_NOT_FOUND') {
                    Write-Fail "ERR_MODULE_NOT_FOUND — missing bundled dependency files"
                    # Extract the module path
                    if ($versionError -match "Cannot find module[^\n]*'([^']+)'") {
                        Write-Host "         Missing: $($Matches[1])" -ForegroundColor DarkRed
                    }
                    Record-Fail "viewer/version-cmd" "ERR_MODULE_NOT_FOUND"
                } else {
                    Write-Fail "livedoc-viewer --version failed: $($versionError.Trim().Substring(0, [Math]::Min(200, $versionError.Trim().Length)))"
                    Record-Fail "viewer/version-cmd" "Non-zero exit"
                }
            } else {
                $ver = $versionOutput.Trim()
                Write-Pass "livedoc-viewer --version → $ver"
                Record-Pass "viewer/version-cmd"
            }
        } else {
            Write-Fail "Binary 'livedoc-viewer' not found after install"
            Record-Fail "viewer/version-cmd" "No bin entry"
        }

        # ── Test 3: Verify zod v3 helpers exist ──
        Write-Check "Checking zod v3 helper files..."
        $zodBase = Join-Path $stageDir 'node_modules\@swedevtools\livedoc-viewer\node_modules\zod\v3\helpers'
        $missingZod = @()
        foreach ($stub in @('typeAliases.js', 'partialUtil.js')) {
            $stubPath = Join-Path $zodBase $stub
            if (-not (Test-Path $stubPath)) {
                $missingZod += $stub
            }
        }
        if ($missingZod.Count -gt 0) {
            Write-Fail "Missing zod stubs: $($missingZod -join ', ')"
            Record-Fail "viewer/zod-stubs" "Missing: $($missingZod -join ', ')"
        } else {
            Write-Pass "All zod v3 helper files present"
            Record-Pass "viewer/zod-stubs"
        }

        # ── Test 4: Check package.json has no workspace:* ──
        Write-Check "Checking installed package.json for workspace:* refs..."
        $installedPkgJson = Join-Path $stageDir 'node_modules\@swedevtools\livedoc-viewer\package.json'
        if (Test-Path $installedPkgJson) {
            $content = Get-Content $installedPkgJson -Raw
            if ($content -match 'workspace:\*|workspace:\^|workspace:~') {
                Write-Fail "Installed package.json still contains workspace:* references"
                Record-Fail "viewer/pkg-workspace" "workspace:* in published package.json"
            } else {
                Write-Pass "No workspace:* in installed package.json"
                Record-Pass "viewer/pkg-workspace"
            }
        } else {
            Write-Fail "Could not find installed package.json"
            Record-Fail "viewer/pkg-workspace" "package.json not found"
        }

        # ── Test 5: Start the installed CLI and verify its health endpoint ──
        Write-Check "Starting installed Viewer CLI and checking health..."
        $listener = [System.Net.Sockets.TcpListener]::new(
            [System.Net.IPAddress]::Loopback,
            0)
        $listener.Start()
        $viewerPort = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
        $listener.Stop()

        $installedCli = Join-Path $stageDir 'node_modules\@swedevtools\livedoc-viewer\dist\cli.js'
        $stdoutPath = Join-Path $stageDir 'viewer.stdout.log'
        $stderrPath = Join-Path $stageDir 'viewer.stderr.log'
        $viewerProcess = $null
        $healthy = $false
        try {
            $nativeVerifier = Join-Path $repoRoot 'scripts\verify-viewer-standard.mjs'
            & node $nativeVerifier --fixtures $stageDir
            if ($LASTEXITCODE -ne 0) { throw "Could not create native-test release fixtures." }
            # Keep CLI discovery/runtime scratch under this owned project-local stage.
            $previousTemp = $env:TEMP
            $previousTmp = $env:TMP
            $runtimeDir = Join-Path $stageDir '.runtime'
            New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
            $env:TEMP = $runtimeDir
            $env:TMP = $runtimeDir
            try {
                $viewerProcess = Start-Process `
                    -FilePath 'node' `
                    -ArgumentList @(
                        $installedCli,
                        '--host', '127.0.0.1',
                        '--port', $viewerPort.ToString(),
                        '--no-open'
                    ) `
                    -RedirectStandardOutput $stdoutPath `
                    -RedirectStandardError $stderrPath `
                    -WorkingDirectory $stageDir `
                    -PassThru `
                    -NoNewWindow
            } finally {
                $env:TEMP = $previousTemp
                $env:TMP = $previousTmp
            }

            $deadline = (Get-Date).AddSeconds(10)
            do {
                if ($viewerProcess.HasExited) {
                    break
                }

                try {
                    $health = Invoke-RestMethod `
                        -Uri "http://127.0.0.1:$viewerPort/api/health" `
                        -TimeoutSec 1
                    $healthy = $health.status -eq 'ok'
                } catch {
                    Start-Sleep -Milliseconds 200
                }
            } while (-not $healthy -and (Get-Date) -lt $deadline)
            if ($healthy) {
                $savedNative = Invoke-RestMethod "http://127.0.0.1:$viewerPort/api/v1/runs/release-validation?view=physical"
                if (($savedNative.documents.kind -join ',') -ne 'Standard,Specification' -or
                    $savedNative.summary.total -ne 2 -or $savedNative.summary.passed -ne 2 -or
                    $savedNative.documents[0].tests[0].kind -ne 'Test') {
                    throw "Installed server changed or omitted the saved Standard/Test report."
                }
                Write-Pass "Installed server reloaded Standard/Test and Specification: 2 documents, total/passed 2"
                Record-Pass "viewer/saved-native-rest"
                if ($ViewerNativeBrowser) {
                    foreach ($fixture in @('', '-detailed')) {
                        & node $installedCli export `
                            --input (Join-Path $stageDir "viewer$fixture-input.json") `
                            --output (Join-Path $stageDir "viewer$fixture-output.html") `
                            --title 'Native Test Compatibility'
                        if ($LASTEXITCODE -ne 0) { throw "Native static export failed: $fixture" }
                    }
                    $evidenceDir = Join-Path $repoRoot '.livedoc\standard-tests-verification'
                    & node $nativeVerifier --browser `
                        "http://127.0.0.1:$viewerPort" `
                        (Join-Path $stageDir 'viewer-output.html') `
                        (Join-Path $stageDir 'viewer-detailed-output.html') `
                        $evidenceDir $expectedViewerVersion
                    if ($LASTEXITCODE -ne 0) { throw "Packaged native-test browser verification failed." }
                    Write-Pass "Installed CLI and static HTML render both documents and native Fact/Theory details at desktop/mobile widths"
                    Record-Pass "viewer/native-browser"
                }
            }
        } finally {
            if ($viewerProcess -and -not $viewerProcess.HasExited) {
                $viewerProcess.Kill()
                $viewerProcess.WaitForExit()
            }
            if ($viewerProcess) {
                $viewerProcess.Dispose()
            }
        }

        if ($healthy) {
            Write-Pass "Installed Viewer CLI served a healthy endpoint"
            Record-Pass "viewer/server-health"
        } else {
            $serverError = if (Test-Path $stderrPath) {
                (Get-Content $stderrPath -Raw -ErrorAction SilentlyContinue).Trim()
            } else {
                ""
            }
            Write-Fail "Installed Viewer CLI did not become healthy"
            Record-Fail "viewer/server-health" $serverError
        }

        # ── Test 6: Static export from the installed CLI ──
        Write-Check "Running static HTML export..."
        $exportInput = Join-Path $stageDir 'viewer-input.json'
        $exportOutput = Join-Path $stageDir 'viewer-output.html'
        $exportLog = & node $installedCli export `
            --input $exportInput `
            --output $exportOutput `
            --title 'Release Validation' 2>&1 | Out-String
        if ($LASTEXITCODE -eq 0 -and
            (Test-Path $exportOutput) -and
            (Get-Item $exportOutput).Length -gt 0) {
            Write-Pass "Installed Viewer CLI produced static HTML"
            Record-Pass "viewer/static-export"
        } else {
            Write-Fail "Static export failed"
            Record-Fail "viewer/static-export" $exportLog.Trim()
        }

    } finally {
        Remove-Item -Path $stageDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# ── Vitest Validation ────────────────────────────────────────────────────

if (-not $SkipVitest) {
    Write-Section "Vitest: @swedevtools/livedoc-vitest"

    $stageDir = Join-Path $repoRoot "releases\local-validation\vitest-$([guid]::NewGuid().ToString('N'))"
    New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

    try {
        # Create a minimal package.json for the test project
        $testPkgJson = @{
            name = "livedoc-validate-vitest"
            version = "1.0.0"
            private = $true
            type = "module"
        } | ConvertTo-Json
        Set-Content -Path (Join-Path $stageDir 'package.json') -Value $testPkgJson -Encoding utf8

        # ── Test 1: npm install ──
        Write-Check "Installing tarball..."
        $installLog = & npm install --prefix $stageDir --no-audit --fund=false $VitestTgz 2>&1 | Out-String
        $installExitCode = $LASTEXITCODE

        if ($installExitCode -ne 0 -or $installLog -match 'ERR!|error') {
            # Filter out non-critical warnings
            $errorLines = ($installLog -split "`n") | Where-Object { $_ -match 'ERR!|error' -and $_ -notmatch 'npm warn' }
            if ($installExitCode -ne 0 -or $errorLines.Count -gt 0) {
                Write-Fail "npm install had errors"
                Record-Fail "vitest/install" "Install errors"
            } else {
                Write-Pass "npm install succeeded"
                Record-Pass "vitest/install"
            }
        } else {
            Write-Pass "npm install succeeded"
            Record-Pass "vitest/install"
        }

        # ── Test 2: Basic import ──
        Write-Check "Testing package import..."
        $nodeScript = @"
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Find the installed package.json
const prefixDir = process.argv[2];
const pkgPath = join(prefixDir, 'node_modules', '@swedevtools', 'livedoc-vitest', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
console.log('pkg-loaded:' + pkg.version);
"@
        $testFile = Join-Path $stageDir 'test-import.mjs'
        Set-Content -Path $testFile -Value $nodeScript -Encoding utf8
        $importOutput = $null
        try {
            $importOutput = & node $testFile $stageDir 2>&1 | Out-String
            if ($LASTEXITCODE -ne 0) { throw $importOutput }
        } catch {
            $importOutput = $null
        }

        if ($importOutput -and $importOutput -match 'pkg-loaded:(.+)') {
            Write-Pass "Package loads successfully (v$($Matches[1].Trim()))"
            Record-Pass "vitest/import"
        } else {
            Write-Fail "Cannot import @swedevtools/livedoc-vitest"
            Record-Fail "vitest/import" "Import failed"
        }

        # ── Test 3: Core exports available ──
        Write-Check "Checking core exports..."
        $nodeScript2 = @"
const livedoc = await import('@swedevtools/livedoc-vitest');
const exports = Object.keys(livedoc);
const required = ['feature', 'scenario', 'given', 'when', 'Then'];
const missing = required.filter(e => !exports.includes(e));
if (missing.length > 0) {
    console.log('missing:' + missing.join(','));
    process.exit(1);
} else {
    console.log('exports-ok:' + required.join(','));
    process.exit(0);
}
"@
        $testFile2 = Join-Path $stageDir 'test-exports.mjs'
        Set-Content -Path $testFile2 -Value $nodeScript2 -Encoding utf8
        $exportOutput = $null
        try {
            $exportOutput = & node $testFile2 2>&1 | Out-String
        } catch {}

        if ($exportOutput -match 'exports-ok:(.+)') {
            Write-Pass "Core BDD exports present: $($Matches[1].Trim())"
            Record-Pass "vitest/exports"
        } elseif ($exportOutput -match 'missing:(.+)') {
            Write-Fail "Missing exports: $($Matches[1].Trim())"
            Record-Fail "vitest/exports" "Missing: $($Matches[1].Trim())"
        } else {
            Write-Fail "Could not verify exports"
            Record-Fail "vitest/exports" "Verification failed"
        }

        # ── Test 4: Execute the packaged DSL under the installed Vitest peer ──
        Write-Check "Executing a packaged LiveDoc specification..."
        $smokeSpec = @"
import { expect } from 'vitest';
import { specification, rule } from '@swedevtools/livedoc-vitest';

specification('Packaged SDK smoke test', () => {
    rule("adding '2' and '3' returns '5'", (ctx) => {
        const [left, right, expected] = ctx.rule.values;
        expect(left + right).toBe(expected);
    });
});
"@
        $smokeFile = Join-Path $stageDir 'PackageSmoke.spec.ts'
        Set-Content -Path $smokeFile -Value $smokeSpec -Encoding utf8
        $vitestBin = Join-Path $stageDir 'node_modules\.bin\vitest.cmd'
        if (-not (Test-Path $vitestBin)) {
            $vitestBin = Join-Path $stageDir 'node_modules\.bin\vitest'
        }
        $smokeOutput = $null
        try {
            Push-Location $stageDir
            $smokeOutput = & $vitestBin run $smokeFile --reporter=default 2>&1 | Out-String
            $smokeExitCode = $LASTEXITCODE
        } finally {
            Pop-Location
        }

        if ($smokeExitCode -eq 0 -and $smokeOutput -match '1 passed') {
            Write-Pass "Packaged LiveDoc DSL executes successfully"
            Record-Pass "vitest/dsl-smoke"
        } else {
            Write-Fail "Packaged LiveDoc DSL execution failed"
            Record-Fail "vitest/dsl-smoke" ($smokeOutput.Trim())
        }

    } finally {
        Remove-Item -Path $stageDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# ── xUnit Validation (explicitly requested packages only) ─────────────────

if ($XunitNupkg) {
    Write-Section 'xUnit: SweDevTools.LiveDoc.xUnit'
    $stageDir = Join-Path $repoRoot "releases\local-validation\xunit-$([guid]::NewGuid().ToString('N'))"
    New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

    try {
        $XunitNupkg = (Resolve-Path $XunitNupkg).Path
        $xunitDir = Join-Path $repoRoot 'dotnet\xunit'
        [xml]$project = Get-Content (Join-Path $xunitDir 'livedoc-xunit.csproj') -Raw
        $version = [string]$project.Project.PropertyGroup.Version
        $packageVersion = [version]$version
        $expectedAssemblyVersion = [version]::new(
            $packageVersion.Major, $packageVersion.Minor,
            $packageVersion.Build, [Math]::Max(0, $packageVersion.Revision)
        ).ToString()
        $packageId = [string]$project.Project.PropertyGroup.PackageId
        $frameworks = ([string]$project.Project.PropertyGroup.TargetFrameworks).Split(';')
        $archiveDir = Join-Path $stageDir 'archive'
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $archive = [System.IO.Compression.ZipFile]::OpenRead($XunitNupkg)
        try {
            foreach ($entry in $archive.Entries) {
                if ($entry.FullName -match '(^|[\\/])\.\.([\\/]|$)|^[\\/]|^[A-Za-z]:') {
                    throw "Unsafe NuGet archive path: $($entry.FullName)"
                }
            }
        } finally {
            $archive.Dispose()
        }
        [System.IO.Compression.ZipFile]::ExtractToDirectory($XunitNupkg, $archiveDir)
        [xml]$nuspec = Get-Content (Join-Path $archiveDir "$packageId.nuspec") -Raw
        if ($nuspec.package.metadata.id -ne $packageId -or $nuspec.package.metadata.version -ne $version) {
            throw "NuGet metadata does not match $packageId $version."
        }
        $newtonsoftReference = @($project.Project.ItemGroup.PackageReference |
            Where-Object { $_.Include -eq 'Newtonsoft.Json' })
        if ($newtonsoftReference.Count -ne 1) {
            throw 'Expected the production Newtonsoft.Json dependency.'
        }
        $newtonsoftVersion = [string]$newtonsoftReference[0].Version
        foreach ($tfm in $frameworks) {
            $group = @($nuspec.package.metadata.dependencies.group |
                Where-Object { $_.targetFramework -eq $tfm })
            $dependency = @($group.dependency | Where-Object { $_.id -eq 'Newtonsoft.Json' })
            if ($group.Count -ne 1 -or $dependency.Count -ne 1 -or
                $dependency[0].version -ne $newtonsoftVersion -or
                $dependency[0].exclude -match '(^|,)(Compile|Runtime|All)(,|$)') {
                throw "NuGet metadata lacks the usable Newtonsoft.Json $newtonsoftVersion dependency for $tfm."
            }
        }
        Write-Pass "Safe archive paths and NuGet metadata $packageId $version; Newtonsoft.Json $newtonsoftVersion for both targets"
        Record-Pass 'xunit/archive-metadata'

        $assets = [ordered]@{
            'build\SweDevTools.LiveDoc.xUnit.targets' = 'build\SweDevTools.LiveDoc.xUnit.targets'
            'build\livedoc-coverage.runsettings' = 'build\livedoc-coverage.runsettings'
            'README.md' = 'README.md'
            'CHANGELOG.md' = 'CHANGELOG.md'
            'tools\livedoc-setup.ps1' = 'tools\livedoc-setup.ps1'
            'tools\livedoc-setup.sh' = 'tools\livedoc-setup.sh'
        }
        foreach ($tfm in $frameworks) {
            $assets["lib\$tfm\livedoc-xunit.dll"] = "bin\$XunitConfiguration\$tfm\livedoc-xunit.dll"
            $assets["build\$tfm\SweDevTools.LiveDoc.xUnit.TestLogger.dll"] = "logger\bin\$XunitConfiguration\$tfm\SweDevTools.LiveDoc.xUnit.TestLogger.dll"
            $assets["build\$tfm\SweDevTools.LiveDoc.xUnit.Coverage.Collector.dll"] = "collector\bin\$XunitConfiguration\$tfm\SweDevTools.LiveDoc.xUnit.Coverage.Collector.dll"
            foreach ($suffix in @('dll', 'deps.json', 'runtimeconfig.json')) {
                $name = "SweDevTools.LiveDoc.xUnit.JourneyGenerator.$suffix"
                $assets["tools\journey-generator\$tfm\$name"] = "tools\journey-generator\bin\$XunitConfiguration\$tfm\$name"
            }
        }
        foreach ($asset in $assets.GetEnumerator()) {
            $packedPath = Join-Path $archiveDir $asset.Key
            $builtPath = Join-Path $xunitDir $asset.Value
            if (-not (Test-Path $packedPath) -or
                (Get-FileHash $packedPath -Algorithm SHA256).Hash -ne (Get-FileHash $builtPath -Algorithm SHA256).Hash) {
                throw "Packaged asset does not match the current build: $($asset.Key)"
            }
            if ($packedPath.EndsWith('.dll')) {
                $assemblyVersion = [System.Reflection.AssemblyName]::GetAssemblyName($packedPath).Version.ToString()
                $productVersion = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($packedPath).ProductVersion
                if ($assemblyVersion -ne $expectedAssemblyVersion -or
                    ($productVersion -split '\+')[0] -ne $version) {
                    throw "Assembly metadata mismatch in $($asset.Key): $assemblyVersion / $productVersion"
                }
                Write-Pass "$($asset.Key): assembly $assemblyVersion, informational $productVersion"
                Record-Pass "xunit/assembly/$($asset.Key)"
            }
        }
        Write-Pass "$($assets.Count) packaged assets match current $XunitConfiguration outputs"
        Record-Pass 'xunit/current-build-assets'

        $canonicalDir = Join-Path $repoRoot '.github\skills\livedoc-xunit'
        $canonicalFiles = @(Get-ChildItem $canonicalDir -Recurse -File)
        $packedSkillDir = Join-Path $archiveDir 'tools\skills'
        if (@(Get-ChildItem $packedSkillDir -Recurse -File).Count -ne $canonicalFiles.Count) {
            throw 'Packaged skill file count does not match the canonical skill.'
        }
        foreach ($file in $canonicalFiles) {
            $relative = $file.FullName.Substring($canonicalDir.Length).TrimStart('\', '/')
            $packedSkill = Join-Path $packedSkillDir $relative
            $bundledSkill = Join-Path (Join-Path $xunitDir 'tools\skills') $relative
            if (-not (Test-Path $packedSkill) -or
                (Get-FileHash $file.FullName -Algorithm SHA256).Hash -ne (Get-FileHash $packedSkill -Algorithm SHA256).Hash -or
                (Get-FileHash $file.FullName -Algorithm SHA256).Hash -ne (Get-FileHash $bundledSkill -Algorithm SHA256).Hash) {
                throw "Packaged skill mismatch: $relative"
            }
        }
        if ((Get-Content (Join-Path $packedSkillDir 'SKILL.md') -Raw) -notmatch "(?m)^sdk_version:\s*$([regex]::Escape($version))\s*$") {
            throw "Packaged skill SDK version does not match $version."
        }
        Write-Pass "$($canonicalFiles.Count) canonical, bundled, and packaged skill files match; SDK $version"
        Record-Pass 'xunit/skills'

        Write-Check 'Consuming the package offline in an isolated console project (no test reporting)...'
        $projectPath = Join-Path $stageDir 'PackageSmoke.csproj'
        $escapedFeed = [System.Security.SecurityElement]::Escape((Split-Path $XunitNupkg -Parent))
        $globalCacheOutput = & dotnet nuget locals global-packages --list 2>&1 | Out-String
        if ($LASTEXITCODE -ne 0 -or $globalCacheOutput -notmatch 'global-packages:\s*(.+)') {
            throw "Cannot locate the existing NuGet dependency cache: $globalCacheOutput"
        }
        $escapedCache = [System.Security.SecurityElement]::Escape($Matches[1].Trim())
        Set-Content (Join-Path $stageDir 'NuGet.Config') -Encoding utf8 -Value @"
<configuration>
  <packageSources>
    <clear />
    <add key="local-release" value="$escapedFeed" />
    <add key="existing-dependency-cache" value="$escapedCache" />
  </packageSources>
</configuration>
"@
        Set-Content $projectPath -Encoding utf8 -Value @"
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFrameworks>$($frameworks -join ';')</TargetFrameworks>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <NuGetAudit>false</NuGetAudit>
    <EnableDefaultCompileItems>false</EnableDefaultCompileItems>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include="Program.cs" />
    <PackageReference Include="$packageId" Version="[$version]" />
  </ItemGroup>
</Project>
"@
        Set-Content (Join-Path $stageDir 'Program.cs') -Encoding utf8 -Value @'
using System.Reflection;
using System.Reflection.Emit;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Newtonsoft.Json.Linq;
using SweDevTools.LiveDoc.xUnit.Reporter;

var assembly = typeof(LiveDocTestRunReporter).Assembly;
if (assembly.GetName().Version?.ToString() != args[0])
    throw new InvalidOperationException("Consumed framework assembly version is stale.");
var paths = new[]
{
    ("Acme.Orders.Checkout", "Acme.Orders", "Acme/Orders/Checkout.cs"),
    ("Acme.Orders.Checkout", "Unrelated.Library", "Acme/Orders/Checkout.cs"),
    ("Acme.Orders.Payments.Checkout", "Orders", "Acme/Orders/Payments/Checkout.cs"),
    ("Acme.Orders.Outer+Inner", "Acme.Orders", "Acme/Orders/Outer+Inner.cs"),
    ("Checkout", "Acme.Orders", "Checkout.cs")
};
foreach (var (className, assemblyName, expected) in paths)
{
    var actual = LiveDocTestRunReporter.DerivePathFromNames(className, assemblyName);
    if (actual != expected)
        throw new InvalidOperationException($"{className} in {assemblyName}: {actual} != {expected}");
    if (LiveDocTestRunReporter.DerivePathFromNames(className) != expected)
        throw new InvalidOperationException($"Framework fallback path differs for {className}.");
    Console.WriteLine($"path-ok: {className} in {assemblyName} -> {expected}");
}
foreach (var name in new[] { "Acme.Orders", "Unrelated.Library" })
{
    var dynamicAssembly = AssemblyBuilder.DefineDynamicAssembly(new AssemblyName(name), AssemblyBuilderAccess.RunAndCollect);
    var type = dynamicAssembly.DefineDynamicModule(name).DefineType("Acme.Orders.Checkout", TypeAttributes.Public).CreateType()!;
    if (LiveDocTestRunReporter.DerivePath(type) != "Acme/Orders/Checkout.cs")
        throw new InvalidOperationException("Declared namespace depends on assembly identity.");
}
if (!assembly.GetReferencedAssemblies().Any(reference => reference.Name == "Newtonsoft.Json"))
    throw new InvalidOperationException("The installed framework does not reference Newtonsoft.Json.");
var converterType = assembly.GetType("SweDevTools.LiveDoc.xUnit.Core.NewtonsoftJsonTokenConverterFactory", throwOnError: true)!;
var converter = (JsonConverter)Activator.CreateInstance(converterType, nonPublic: true)!;
var options = new JsonSerializerOptions { WriteIndented = true, Converters = { converter } };
var receipt = new JObject
{
    ["action"] = "Finish",
    ["receipt"] = new JObject { ["id"] = "fixture-id", ["type"] = "Example" }
};
CheckJson(receipt, """{"action":"Finish","receipt":{"id":"fixture-id","type":"Example"}}""");
CheckJson(new[] { receipt }, """[{"action":"Finish","receipt":{"id":"fixture-id","type":"Example"}}]""");
CheckJson(new JValue("café 東京 🌿"), "\"café 東京 🌿\"");
CheckJson(new Dictionary<string, object?> { ["tokens"] = new List<JToken?> { new JValue(13), new JValue(true), null } },
    """{"tokens":[13,true,null]}""");
CheckJson(new ClrTokenPayload { Token = receipt },
    """{"wire_value":{"action":"Finish","receipt":{"id":"fixture-id","type":"Example"}},"Optional":null}""");
try
{
    JsonSerializer.Serialize(new JRaw("not JSON"), options);
    throw new InvalidOperationException("The packaged converter accepted a nonstandard raw token.");
}
catch (JsonException error) when (error.Message.Contains("AttachJson") && error.Message.Contains("Raw")) { }
Console.WriteLine($"json-token-smoke-ok: transitive {typeof(JToken).Assembly.GetName().Name}; root, array, scalar, mixed graph, CLR attributes, explicit rejection");
Console.WriteLine($"package-smoke-ok: {assembly.GetName().Version}; {System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription}");

void CheckJson(object value, string expected)
{
    var actual = JsonSerializer.Serialize(value, options);
    if (!JsonNode.DeepEquals(JsonNode.Parse(expected), JsonNode.Parse(actual)))
        throw new InvalidOperationException($"Packaged JSON converter: {actual} != {expected}");
}

sealed class ClrTokenPayload
{
    [JsonPropertyName("wire_value")]
    [Newtonsoft.Json.JsonProperty("different_newtonsoft_name")]
    public required JObject Token { get; init; }
    public string? Optional { get; init; }
    [JsonIgnore]
    public string Ignored => "must not be serialized";
}
'@
        $packagesDir = Join-Path $stageDir 'packages'
        $restoreOutput = & dotnet restore $projectPath --configfile (Join-Path $stageDir 'NuGet.Config') --packages $packagesDir --verbosity quiet 2>&1 | Out-String
        if ($LASTEXITCODE -ne 0) { throw "Offline package restore failed: $restoreOutput" }
        $installedDir = Join-Path $packagesDir "$($packageId.ToLowerInvariant())\$version"
        foreach ($file in @(Get-ChildItem $archiveDir -Recurse -File)) {
            $relative = $file.FullName.Substring($archiveDir.Length).TrimStart('\', '/')
            if ($relative -match '^(_rels\\|package\\|\[Content_Types\]\.xml$)') { continue }
            $installedPath = Join-Path $installedDir $relative
            if (-not (Test-Path $installedPath) -or
                (Get-FileHash $file.FullName -Algorithm SHA256).Hash -ne (Get-FileHash $installedPath -Algorithm SHA256).Hash) {
                throw "Installed package differs from the supplied archive: $relative"
            }
        }
        Write-Pass 'Offline isolated installation is byte-identical to the supplied package'
        Record-Pass 'xunit/offline-install'
        foreach ($tfm in $frameworks) {
            $buildOutput = & dotnet build $projectPath --no-restore -c Release -f $tfm --verbosity quiet 2>&1 | Out-String
            if ($LASTEXITCODE -ne 0) { throw "Package consumer build failed for ${tfm}: $buildOutput" }
            $smokeOutput = & dotnet (Join-Path $stageDir "bin\Release\$tfm\PackageSmoke.dll") $expectedAssemblyVersion 2>&1 | Out-String
            if ($LASTEXITCODE -ne 0 -or $smokeOutput -notmatch 'package-smoke-ok:' -or
                $smokeOutput -notmatch 'json-token-smoke-ok:') {
                throw "Package namespace/JSON token smoke failed for ${tfm}: $smokeOutput"
            }
            Write-Pass "$tfm package consumer: $($smokeOutput.Trim())"
            Record-Pass "xunit/consumer/$tfm"
            $journeysDir = Join-Path $stageDir "journeys-$tfm"
            New-Item $journeysDir -ItemType Directory -Force | Out-Null
            $generatorOutput = & dotnet (Join-Path $installedDir "tools\journey-generator\$tfm\SweDevTools.LiveDoc.xUnit.JourneyGenerator.dll") validate $journeysDir (Join-Path $stageDir "generated-$tfm") 2>&1 | Out-String
            if ($LASTEXITCODE -ne 0 -or $generatorOutput -notmatch 'No \.http files found') {
                throw "Installed journey generator failed for ${tfm}: $generatorOutput"
            }
            Write-Pass "$tfm installed journey generator executes"
            Record-Pass "xunit/journey-generator/$tfm"
        }
    } catch {
        Write-Fail $_.Exception.Message
        Record-Fail 'xunit/package' $_.Exception.Message
    } finally {
        Remove-Item $stageDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# ── Summary ──────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor $(if ($totalFail -eq 0) { 'Green' } else { 'Red' })
Write-Host "  Results: $totalPass passed, $totalFail failed" -ForegroundColor $(if ($totalFail -eq 0) { 'Green' } else { 'Red' })
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor $(if ($totalFail -eq 0) { 'Green' } else { 'Red' })

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "  Failures:" -ForegroundColor Red
    foreach ($f in $failures) {
        Write-Host "    • $f" -ForegroundColor Red
    }
}

Write-Host ""
exit $totalFail
