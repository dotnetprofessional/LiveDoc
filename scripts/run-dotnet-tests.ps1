<#
.SYNOPSIS
    Runs .NET LiveDoc tests with optional Viewer integration.

.DESCRIPTION
    This script runs the dotnet/xunit tests. When -WithViewer is specified,
    it sets the LIVEDOC_SERVER_URL environment variable to enable reporter
    integration with the LiveDoc Viewer.

.PARAMETER WithViewer
    When specified, enables LiveDoc Viewer integration by setting the
    LIVEDOC_SERVER_URL environment variable.

.PARAMETER ServerUrl
    The URL of the LiveDoc server. Defaults to http://localhost:19275.

.PARAMETER Filter
    Optional test filter (e.g., "FullyQualifiedName~Calculator").

.EXAMPLE
    ./run-dotnet-tests.ps1
    Runs all .NET tests without Viewer integration.

.EXAMPLE
    ./run-dotnet-tests.ps1 -WithViewer
    Runs all .NET tests with Viewer integration.

.EXAMPLE
    ./run-dotnet-tests.ps1 -WithViewer -Filter "FullyQualifiedName~Spec"
    Runs specification tests only with Viewer integration.
#>

[CmdletBinding()]
param(
    [switch]$WithViewer,
    
    [string]$ServerUrl = 'http://localhost:19275',
    
    [string]$Filter
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$dotnetDir = Join-Path $repoRoot 'dotnet/xunit'
$slnPath = Join-Path $dotnetDir 'livedoc-xunit.sln'

if (-not (Test-Path $slnPath)) {
    Write-Error "Solution not found: $slnPath"
    exit 1
}

# Build arguments
$args = @('test', $slnPath, '--no-build')

if ($Filter) {
    $args += '--filter'
    $args += $Filter
}

Write-Host "Running .NET LiveDoc tests..." -ForegroundColor Cyan

if ($WithViewer) {
    Write-Host "Viewer integration: ENABLED" -ForegroundColor Green
    Write-Host "Server URL: $ServerUrl" -ForegroundColor Gray
    Write-Host ""
    
    $env:LIVEDOC_SERVER_URL = $ServerUrl
    $env:LIVEDOC_PROJECT = 'LiveDoc.xUnit'
    $env:LIVEDOC_ENVIRONMENT = 'local'
} else {
    Write-Host "Viewer integration: DISABLED" -ForegroundColor Yellow
    Write-Host "(Use -WithViewer to enable)" -ForegroundColor Gray
    Write-Host ""
}

try {
    Push-Location $dotnetDir
    
    # Build first
    Write-Host "Building solution..." -ForegroundColor Cyan
    dotnet build $slnPath --quiet
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed"
        exit $LASTEXITCODE
    }
    
    # Run tests
    Write-Host ""
    Write-Host "==> dotnet $($args -join ' ')" -ForegroundColor Cyan
    & dotnet @args
    
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "All tests passed!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Tests failed with exit code: $exitCode" -ForegroundColor Red
    }
    
    exit $exitCode
    
} finally {
    Pop-Location
    
    if ($WithViewer) {
        Remove-Item Env:\LIVEDOC_SERVER_URL -ErrorAction SilentlyContinue
        Remove-Item Env:\LIVEDOC_PROJECT -ErrorAction SilentlyContinue
        Remove-Item Env:\LIVEDOC_ENVIRONMENT -ErrorAction SilentlyContinue
    }
}
