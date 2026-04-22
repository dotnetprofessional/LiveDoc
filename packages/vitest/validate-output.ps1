# Comprehensive Mocha vs Vitest Output Validation Script
# This script runs all tests in both Mocha and Vitest and compares their outputs

param(
    [switch]$Detailed,
    [string]$TestPattern = ""
)

$ErrorActionPreference = "Continue"
$mochaPath = "D:\private\LiveDoc\packages\livedoc-mocha"
$vitestPath = "D:\private\LiveDoc\packages\livedoc-vitest"
$outputDir = "D:\private\LiveDoc\validation-output"

# Create output directory
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "LIVEDOC OUTPUT VALIDATION: Mocha vs Vitest" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Get all test files
$testFiles = Get-ChildItem -Path "$vitestPath\_src\test" -Filter "*.Spec.ts" -Recurse

$totalTests = $testFiles.Count
$currentTest = 0
$differences = @()

foreach ($testFile in $testFiles) {
    $currentTest++
    $relativePath = $testFile.FullName.Replace("$vitestPath\_src\test\", "")
    $testName = $testFile.BaseName
    
    Write-Progress -Activity "Validating Tests" -Status "$currentTest of $totalTests" -PercentComplete (($currentTest / $totalTests) * 100)
    
    if ($TestPattern -and $relativePath -notlike "*$TestPattern*") {
        continue
    }
    
    Write-Host "[$currentTest/$totalTests] Testing: $relativePath" -ForegroundColor Yellow
    
    # Run Mocha version
    $mochaOutput = ""
    try {
        Push-Location $mochaPath
        $mochaTestPath = "_src\test\$relativePath"
        $mochaOutput = & npm run test:spec -- $mochaTestPath 2>&1 | Out-String
        Pop-Location
    } catch {
        Write-Host "  ⚠ Mocha test failed: $_" -ForegroundColor Red
        Pop-Location
    }
    
    # Run Vitest version
    $vitestOutput = ""
    try {
        Push-Location $vitestPath
        $vitestTestPath = "_src\test\$relativePath"
        $vitestOutput = & npm run test:spec -- $vitestTestPath 2>&1 | Out-String
        Pop-Location
    } catch {
        Write-Host "  ⚠ Vitest test failed: $_" -ForegroundColor Red
        Pop-Location
    }
    
    # Clean outputs for comparison (remove timing, ANSI codes, etc.)
    function Clean-Output {
        param($text)
        $text = $text -replace '\x1b\[[0-9;]*m', ''  # Remove ANSI codes
        $text = $text -replace '\d+\.?\d*ms', 'XXms'  # Normalize timing
        $text = $text -replace '\d+\.?\d+ │', 'XX.XX │'  # Normalize numbers in tables
        $text = $text -replace 'npm run.*', ''  # Remove npm command lines
        $text = $text -replace '> livedoc.*', ''  # Remove package info
        $text = $text -replace 'vitest run.*', ''  # Remove vitest command
        $text = $text -replace 'mocha --require.*', ''  # Remove mocha command
        return $text.Trim()
    }
    
    $cleanMocha = Clean-Output $mochaOutput
    $cleanVitest = Clean-Output $vitestOutput
    
    # Extract just the test output (Feature: ... to end of test)
    function Extract-TestOutput {
        param($text)
        $lines = $text -split "`n"
        $output = @()
        $capturing = $false
        foreach ($line in $lines) {
            if ($line -match '^\s*Feature:') {
                $capturing = $true
            }
            if ($capturing) {
                $output += $line
            }
            if ($line -match 'Totals \(') {
                break
            }
        }
        return ($output -join "`n").Trim()
    }
    
    $mochaTest = Extract-TestOutput $cleanMocha
    $vitestTest = Extract-TestOutput $cleanVitest
    
    # Save outputs
    $mochaFile = Join-Path $outputDir "$testName.mocha.txt"
    $vitestFile = Join-Path $outputDir "$testName.vitest.txt"
    $mochaTest | Out-File -FilePath $mochaFile -Encoding UTF8
    $vitestTest | Out-File -FilePath $vitestFile -Encoding UTF8
    
    # Compare
    if ($mochaTest -eq $vitestTest) {
        Write-Host "  ✓ MATCH" -ForegroundColor Green
    } else {
        Write-Host "  ✗ DIFFERENCE DETECTED" -ForegroundColor Red
        $differences += @{
            Test = $relativePath
            MochaFile = $mochaFile
            VitestFile = $vitestFile
        }
        
        if ($Detailed) {
            Write-Host "    Mocha length: $($mochaTest.Length) chars" -ForegroundColor Gray
            Write-Host "    Vitest length: $($vitestTest.Length) chars" -ForegroundColor Gray
        }
    }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "VALIDATION SUMMARY" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Total tests: $totalTests" -ForegroundColor White
Write-Host "Matching: $($totalTests - $differences.Count)" -ForegroundColor Green
Write-Host "Differences: $($differences.Count)" -ForegroundColor $(if ($differences.Count -eq 0) { "Green" } else { "Red" })

if ($differences.Count -gt 0) {
    Write-Host ""
    Write-Host "Tests with differences:" -ForegroundColor Yellow
    foreach ($diff in $differences) {
        Write-Host "  - $($diff.Test)" -ForegroundColor Red
        Write-Host "    Mocha:  $($diff.MochaFile)" -ForegroundColor Gray
        Write-Host "    Vitest: $($diff.VitestFile)" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "Review files in: $outputDir" -ForegroundColor Cyan
}

exit $differences.Count
