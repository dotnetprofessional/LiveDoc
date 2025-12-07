# Test ONE file to see what's actually happening
param(
    [string]$TestFile = "ScenarioOutline.Spec.ts"
)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$mochaPath = "D:\private\LiveDoc\packages\livedoc-mocha"
$vitestPath = "D:\private\LiveDoc\packages\livedoc-vitest"
$outputDir = "D:\private\LiveDoc\test-output"

# Create output directory
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host "  TESTING ONE FILE: $TestFile" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host ""

# Test Mocha
Write-Host "RUNNING MOCHA:" -ForegroundColor Yellow
Write-Host "  Path: $mochaPath" -ForegroundColor Gray
$mochaTestPath = "build\test\$($TestFile -replace '\.ts$', '.js')"
Write-Host "  Test: $mochaTestPath" -ForegroundColor Gray

Push-Location $mochaPath
# Call mocha directly to run just this one file
$mochaCmd = "npx mocha --colors --require build/app/index --ui livedoc-mocha --reporter build/app/livedoc-spec `"$mochaTestPath`" 2>&1"
Write-Host "  Command: $mochaCmd" -ForegroundColor Gray
Write-Host ""

$mochaOutput = Invoke-Expression $mochaCmd | Out-String
$mochaExitCode = $LASTEXITCODE
Pop-Location

$mochaRawFile = Join-Path $outputDir "mocha.raw.txt"
[System.IO.File]::WriteAllText($mochaRawFile, $mochaOutput, [System.Text.Encoding]::UTF8)

Write-Host "MOCHA RESULT:" -ForegroundColor Yellow
Write-Host "  Exit Code: $mochaExitCode" -ForegroundColor $(if ($mochaExitCode -eq 0) { "Green" } else { "Red" })
Write-Host "  Output Length: $($mochaOutput.Length) characters" -ForegroundColor Gray
Write-Host "  Saved to: $mochaRawFile" -ForegroundColor Gray
Write-Host ""
Write-Host "FIRST 500 CHARS OF MOCHA OUTPUT:" -ForegroundColor Yellow
Write-Host $mochaOutput.Substring(0, [Math]::Min(500, $mochaOutput.Length)) -ForegroundColor White
Write-Host ""
Write-Host "LAST 500 CHARS OF MOCHA OUTPUT:" -ForegroundColor Yellow
Write-Host $mochaOutput.Substring([Math]::Max(0, $mochaOutput.Length - 500)) -ForegroundColor White
Write-Host ""
Write-Host "=============================================================" -ForegroundColor Cyan

# Test Vitest
Write-Host "RUNNING VITEST:" -ForegroundColor Yellow
Write-Host "  Path: $vitestPath" -ForegroundColor Gray
$vitestTestPath = "_src\test\$TestFile"
Write-Host "  Test: $vitestTestPath" -ForegroundColor Gray

Push-Location $vitestPath
$vitestCmd = "npm run test:spec -- `"$vitestTestPath`" 2>&1"
Write-Host "  Command: $vitestCmd" -ForegroundColor Gray
Write-Host ""

$vitestOutput = Invoke-Expression $vitestCmd | Out-String
$vitestExitCode = $LASTEXITCODE
Pop-Location

$vitestRawFile = Join-Path $outputDir "vitest.raw.txt"
[System.IO.File]::WriteAllText($vitestRawFile, $vitestOutput, [System.Text.Encoding]::UTF8)

Write-Host "VITEST RESULT:" -ForegroundColor Yellow
Write-Host "  Exit Code: $vitestExitCode" -ForegroundColor $(if ($vitestExitCode -eq 0) { "Green" } else { "Red" })
Write-Host "  Output Length: $($vitestOutput.Length) characters" -ForegroundColor Gray
Write-Host "  Saved to: $vitestRawFile" -ForegroundColor Gray
Write-Host ""
Write-Host "FIRST 500 CHARS OF VITEST OUTPUT:" -ForegroundColor Yellow
Write-Host $vitestOutput.Substring(0, [Math]::Min(500, $vitestOutput.Length)) -ForegroundColor White
Write-Host ""
Write-Host "LAST 500 CHARS OF VITEST OUTPUT:" -ForegroundColor Yellow
Write-Host $vitestOutput.Substring([Math]::Max(0, $vitestOutput.Length - 500)) -ForegroundColor White
Write-Host ""
Write-Host "=============================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "FILES SAVED TO: $outputDir" -ForegroundColor Green
Write-Host "  - mocha.raw.txt" -ForegroundColor Gray
Write-Host "  - vitest.raw.txt" -ForegroundColor Gray
Write-Host ""
Write-Host "Review these files to see what's actually being captured!" -ForegroundColor Yellow
