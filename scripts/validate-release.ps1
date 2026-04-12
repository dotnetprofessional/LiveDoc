<#
.SYNOPSIS
    Validates release tarballs by installing and smoke-testing them.

.DESCRIPTION
    Installs each release tarball in an isolated temp directory and runs
    smoke tests to verify the package is functional:

    - Viewer:  npm install → livedoc-viewer --version
    - Vitest:  npm install → node -e "import(...)"

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

.EXAMPLE
    .\validate-release.ps1
    Validate latest viewer and vitest tarballs.

.EXAMPLE
    .\validate-release.ps1 -SkipVitest
    Validate only the viewer tarball.
#>

[CmdletBinding()]
param(
    [string]$ViewerTgz,
    [string]$VitestTgz,
    [switch]$SkipViewer,
    [switch]$SkipVitest
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

    $stageDir = Join-Path ([System.IO.Path]::GetTempPath()) "livedoc-validate-viewer-$([System.IO.Path]::GetRandomFileName())"
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
        $archivePkgDir = Join-Path ([System.IO.Path]::GetTempPath()) "livedoc-validate-archive-$([System.IO.Path]::GetRandomFileName())"
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

        # ── Test 1: npm install (no errors) ──
        Write-Check "Installing tarball..."
        $installLog = & npm install --prefix $stageDir $ViewerTgz 2>&1 | Out-String

        # Check for TAR_ENTRY_ERROR (../paths)
        if ($installLog -match 'TAR_ENTRY_ERROR') {
            Write-Fail "Tarball contains '../' relative paths (TAR_ENTRY_ERROR)"
            Record-Fail "viewer/tar-paths" "Tarball has '../' entries blocked by npm"
        } else {
            Write-Pass "No TAR_ENTRY_ERROR warnings"
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

        # ── Test 5: Quick server start test (start + shutdown) ──
        Write-Check "Testing server startup (3-second probe)..."
        $nodeScript = @"
import { createRequire } from 'module';
const r = createRequire(import.meta.url);
const viewerPkg = r('@swedevtools/livedoc-viewer/package.json');
console.log('pkg-loaded:' + viewerPkg.version);
process.exit(0);
"@
        $testFile = Join-Path $stageDir 'test-import.mjs'
        Set-Content -Path $testFile -Value $nodeScript -Encoding utf8
        $importOutput = $null
        $importError = $null
        try {
            $importOutput = & node $testFile 2>&1 | Out-String
            if ($LASTEXITCODE -ne 0) { $importError = $importOutput }
        } catch {
            $importError = $_.Exception.Message
        }

        if ($importError) {
            Write-Fail "Server import test failed"
            Record-Fail "viewer/import" "Cannot import viewer package"
        } elseif ($importOutput -match 'pkg-loaded:(.+)') {
            Write-Pass "Package loads successfully (v$($Matches[1].Trim()))"
            Record-Pass "viewer/import"
        } else {
            Write-Fail "Unexpected import output: $importOutput"
            Record-Fail "viewer/import" "Unexpected output"
        }

    } finally {
        Remove-Item -Path $stageDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# ── Vitest Validation ────────────────────────────────────────────────────

if (-not $SkipVitest) {
    Write-Section "Vitest: @swedevtools/livedoc-vitest"

    $stageDir = Join-Path ([System.IO.Path]::GetTempPath()) "livedoc-validate-vitest-$([System.IO.Path]::GetRandomFileName())"
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
        $installLog = & npm install --prefix $stageDir $VitestTgz 2>&1 | Out-String

        if ($installLog -match 'ERR!|error') {
            # Filter out non-critical warnings
            $errorLines = ($installLog -split "`n") | Where-Object { $_ -match 'ERR!|error' -and $_ -notmatch 'npm warn' }
            if ($errorLines.Count -gt 0) {
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

    } finally {
        Remove-Item -Path $stageDir -Recurse -Force -ErrorAction SilentlyContinue
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
