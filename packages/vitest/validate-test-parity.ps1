# Test Parity Validation Script
# Ensures all Mocha tests are present in Vitest with correct structure

param(
    [switch]$ShowDetails,
    [switch]$CopyMissing
)

$ErrorActionPreference = "Continue"

$mochaTestDir = "D:\private\LiveDoc\packages\livedoc-mocha\_src\test"
$vitestTestDir = "D:\private\LiveDoc\packages\livedoc-vitest\_src\test"

Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host "  TEST PARITY VALIDATION: Mocha vs Vitest" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host ""

# Helper function to extract test structure from a file
function Get-TestStructure {
    param([string]$filePath)
    
    $content = Get-Content $filePath -Raw
    
    $structure = @{
        Features = @()
        Scenarios = @()
        ScenarioOutlines = @()
        TotalTests = 0
    }
    
    # Extract features
    $featureMatches = [regex]::Matches($content, "feature\s*\(\s*[`"'`]([^`"'`]+)[`"'`]")
    foreach ($match in $featureMatches) {
        $structure.Features += $match.Groups[1].Value.Trim()
    }
    
    # Extract scenarios
    $scenarioMatches = [regex]::Matches($content, "scenario\s*\(\s*[`"'`]([^`"'`]+)[`"'`]")
    foreach ($match in $scenarioMatches) {
        $structure.Scenarios += $match.Groups[1].Value.Trim()
    }
    
    # Extract scenario outlines
    $outlineMatches = [regex]::Matches($content, "scenarioOutline\s*\(\s*[`"'`]([^`"'`]+)[`"'`]")
    foreach ($match in $outlineMatches) {
        $structure.ScenarioOutlines += $match.Groups[1].Value.Trim()
    }
    
    # Count Given/When/Then/And
    $givenCount = ([regex]::Matches($content, "\b(given|Given)\s*\(")).Count
    $whenCount = ([regex]::Matches($content, "\b(when|When)\s*\(")).Count
    $thenCount = ([regex]::Matches($content, "\b(then|Then)\s*\(")).Count
    $andCount = ([regex]::Matches($content, "\b(and|And)\s*\(")).Count
    
    $structure.TotalTests = $givenCount + $whenCount + $thenCount + $andCount
    
    return $structure
}

# Get all test files from Mocha
$mochaFiles = Get-ChildItem -Path $mochaTestDir -Filter "*.Spec.ts" -Recurse | Sort-Object FullName

$results = @()
$missingFiles = @()
$mismatchedTests = @()
$totalMochaTests = 0
$totalVitestTests = 0

foreach ($mochaFile in $mochaFiles) {
    $relativePath = $mochaFile.FullName.Replace($mochaTestDir, "").TrimStart("\")
    $vitestFile = Join-Path $vitestTestDir $relativePath
    
    $result = [PSCustomObject]@{
        File = $mochaFile.Name
        RelativePath = $relativePath
        MochaExists = $true
        VitestExists = Test-Path $vitestFile
        MochaStructure = $null
        VitestStructure = $null
        FeatureMatch = $false
        ScenarioMatch = $false
        TestCountMatch = $false
        Status = ""
    }
    
    # Get Mocha structure
    $result.MochaStructure = Get-TestStructure $mochaFile.FullName
    $totalMochaTests += $result.MochaStructure.TotalTests
    
    if (-not $result.VitestExists) {
        $result.Status = "MISSING"
        $missingFiles += $result
        $results += $result
        continue
    }
    
    # Get Vitest structure
    $result.VitestStructure = Get-TestStructure $vitestFile
    $totalVitestTests += $result.VitestStructure.TotalTests
    
    # Compare structures
    $result.FeatureMatch = $result.MochaStructure.Features.Count -eq $result.VitestStructure.Features.Count
    $result.ScenarioMatch = ($result.MochaStructure.Scenarios.Count + $result.MochaStructure.ScenarioOutlines.Count) -eq `
                            ($result.VitestStructure.Scenarios.Count + $result.VitestStructure.ScenarioOutlines.Count)
    $result.TestCountMatch = $result.MochaStructure.TotalTests -eq $result.VitestStructure.TotalTests
    
    if ($result.FeatureMatch -and $result.ScenarioMatch -and $result.TestCountMatch) {
        $result.Status = "MATCH"
    } else {
        $result.Status = "MISMATCH"
        $mismatchedTests += $result
    }
    
    $results += $result
}

# Display summary
Write-Host "SUMMARY:" -ForegroundColor Yellow
Write-Host "  Total Mocha test files: $($mochaFiles.Count)" -ForegroundColor White
Write-Host "  Total Vitest test files: $($results.Where({$_.VitestExists}).Count)" -ForegroundColor White
Write-Host "  Missing files: $($missingFiles.Count)" -ForegroundColor $(if ($missingFiles.Count -gt 0) { "Red" } else { "Green" })
Write-Host "  Mismatched files: $($mismatchedTests.Count)" -ForegroundColor $(if ($mismatchedTests.Count -gt 0) { "Red" } else { "Green" })
Write-Host "  Matching files: $($results.Where({$_.Status -eq 'MATCH'}).Count)" -ForegroundColor Green
Write-Host ""
Write-Host "  Total Mocha test steps: $totalMochaTests" -ForegroundColor White
Write-Host "  Total Vitest test steps: $totalVitestTests" -ForegroundColor White
Write-Host "  Difference: $($totalMochaTests - $totalVitestTests)" -ForegroundColor $(if ($totalMochaTests -eq $totalVitestTests) { "Green" } else { "Red" })
Write-Host ""

# Display missing files
if ($missingFiles.Count -gt 0) {
    Write-Host "MISSING FILES IN VITEST:" -ForegroundColor Red
    foreach ($missing in $missingFiles) {
        Write-Host "  - $($missing.RelativePath)" -ForegroundColor Red
        if ($ShowDetails) {
            Write-Host "    Features: $($missing.MochaStructure.Features.Count)" -ForegroundColor Gray
            Write-Host "    Scenarios: $($missing.MochaStructure.Scenarios.Count + $missing.MochaStructure.ScenarioOutlines.Count)" -ForegroundColor Gray
            Write-Host "    Test steps: $($missing.MochaStructure.TotalTests)" -ForegroundColor Gray
        }
    }
    Write-Host ""
}

# Display mismatched files
if ($mismatchedTests.Count -gt 0) {
    Write-Host "MISMATCHED FILES:" -ForegroundColor Yellow
    foreach ($mismatch in $mismatchedTests) {
        Write-Host "  $($mismatch.File)" -ForegroundColor Yellow
        
        if (-not $mismatch.FeatureMatch) {
            Write-Host "    Features: Mocha=$($mismatch.MochaStructure.Features.Count) vs Vitest=$($mismatch.VitestStructure.Features.Count)" -ForegroundColor Red
            if ($ShowDetails) {
                Write-Host "      Mocha features:" -ForegroundColor Gray
                foreach ($f in $mismatch.MochaStructure.Features) {
                    Write-Host "        - $f" -ForegroundColor Gray
                }
                Write-Host "      Vitest features:" -ForegroundColor Gray
                foreach ($f in $mismatch.VitestStructure.Features) {
                    Write-Host "        - $f" -ForegroundColor Gray
                }
            }
        }
        
        if (-not $mismatch.ScenarioMatch) {
            $mochaScenarios = $mismatch.MochaStructure.Scenarios.Count + $mismatch.MochaStructure.ScenarioOutlines.Count
            $vitestScenarios = $mismatch.VitestStructure.Scenarios.Count + $mismatch.VitestStructure.ScenarioOutlines.Count
            Write-Host "    Scenarios: Mocha=$mochaScenarios vs Vitest=$vitestScenarios" -ForegroundColor Red
        }
        
        if (-not $mismatch.TestCountMatch) {
            Write-Host "    Test steps: Mocha=$($mismatch.MochaStructure.TotalTests) vs Vitest=$($mismatch.VitestStructure.TotalTests)" -ForegroundColor Red
        }
        Write-Host ""
    }
}

# Display matched files
$matchedFiles = $results.Where({$_.Status -eq 'MATCH'})
if ($matchedFiles.Count -gt 0) {
    Write-Host "MATCHING FILES: $($matchedFiles.Count)" -ForegroundColor Green
    if ($ShowDetails) {
        foreach ($match in $matchedFiles) {
            Write-Host "  ✓ $($match.File)" -ForegroundColor Green
        }
    }
    Write-Host ""
}

# Generate detailed report
$reportFile = "D:\private\LiveDoc\test-parity-report.html"
$html = @"
<!DOCTYPE html>
<html>
<head>
    <title>Test Parity Report</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background: #f5f5f5; }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        .summary { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 15px; }
        .stat-box { padding: 15px; border-radius: 5px; text-align: center; }
        .stat-value { font-size: 2em; font-weight: bold; }
        .stat-label { font-size: 0.9em; color: #7f8c8d; margin-top: 5px; }
        .success { background: #d4edda; color: #155724; }
        .warning { background: #fff3cd; color: #856404; }
        .danger { background: #f8d7da; color: #721c24; }
        table { width: 100%; border-collapse: collapse; background: white; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        th { background: #34495e; color: white; padding: 12px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #ecf0f1; }
        tr:hover { background: #f8f9fa; }
        .status-match { color: #27ae60; font-weight: bold; }
        .status-mismatch { color: #e67e22; font-weight: bold; }
        .status-missing { color: #c0392b; font-weight: bold; }
    </style>
</head>
<body>
    <h1>📊 Test Parity Report: Mocha vs Vitest</h1>
    <div class="summary">
        <h2>Summary</h2>
        <div class="summary-grid">
            <div class="stat-box success">
                <div class="stat-value">$($matchedFiles.Count)</div>
                <div class="stat-label">Matching Files</div>
            </div>
            <div class="stat-box warning">
                <div class="stat-value">$($mismatchedTests.Count)</div>
                <div class="stat-label">Mismatched Files</div>
            </div>
            <div class="stat-box danger">
                <div class="stat-value">$($missingFiles.Count)</div>
                <div class="stat-label">Missing Files</div>
            </div>
        </div>
        <p style="margin-top: 20px;"><strong>Total Mocha Test Steps:</strong> $totalMochaTests</p>
        <p><strong>Total Vitest Test Steps:</strong> $totalVitestTests</p>
        <p><strong>Difference:</strong> <span style="color: $(if ($totalMochaTests -eq $totalVitestTests) { '#27ae60' } else { '#c0392b' });">$($totalMochaTests - $totalVitestTests)</span></p>
    </div>
    
    <h2>Detailed Results</h2>
    <table>
        <thead>
            <tr>
                <th style="width: 5%">#</th>
                <th style="width: 30%">File</th>
                <th style="width: 10%">Status</th>
                <th style="width: 15%">Features</th>
                <th style="width: 15%">Scenarios</th>
                <th style="width: 15%">Test Steps</th>
                <th style="width: 10%">Match</th>
            </tr>
        </thead>
        <tbody>
"@

$index = 1
foreach ($result in $results | Sort-Object Status, File) {
    $statusClass = switch ($result.Status) {
        "MATCH" { "status-match" }
        "MISMATCH" { "status-mismatch" }
        "MISSING" { "status-missing" }
    }
    
    $mochaFeatures = $result.MochaStructure.Features.Count
    $vitestFeatures = if ($result.VitestStructure) { $result.VitestStructure.Features.Count } else { "N/A" }
    
    $mochaScenarios = $result.MochaStructure.Scenarios.Count + $result.MochaStructure.ScenarioOutlines.Count
    $vitestScenarios = if ($result.VitestStructure) { $result.VitestStructure.Scenarios.Count + $result.VitestStructure.ScenarioOutlines.Count } else { "N/A" }
    
    $mochaTests = $result.MochaStructure.TotalTests
    $vitestTests = if ($result.VitestStructure) { $result.VitestStructure.TotalTests } else { "N/A" }
    
    $matchIcon = if ($result.Status -eq "MATCH") { "✓" } elseif ($result.Status -eq "MISSING") { "✗" } else { "~" }
    
    $html += @"
            <tr>
                <td>$index</td>
                <td><strong>$($result.File)</strong></td>
                <td class="$statusClass">$($result.Status)</td>
                <td>M: $mochaFeatures | V: $vitestFeatures</td>
                <td>M: $mochaScenarios | V: $vitestScenarios</td>
                <td>M: $mochaTests | V: $vitestTests</td>
                <td>$matchIcon</td>
            </tr>
"@
    $index++
}

$html += @"
        </tbody>
    </table>
</body>
</html>
"@

[System.IO.File]::WriteAllText($reportFile, $html, [System.Text.Encoding]::UTF8)
Write-Host "Report saved to: $reportFile" -ForegroundColor Cyan

# Exit with error code if there are issues
if ($missingFiles.Count -gt 0 -or $mismatchedTests.Count -gt 0) {
    Write-Host ""
    Write-Host "❌ TEST PARITY CHECK FAILED!" -ForegroundColor Red
    Write-Host "   Missing files: $($missingFiles.Count)" -ForegroundColor Red
    Write-Host "   Mismatched files: $($mismatchedTests.Count)" -ForegroundColor Red
    Write-Host ""
    exit 1
} else {
    Write-Host ""
    Write-Host "✓ TEST PARITY CHECK PASSED!" -ForegroundColor Green
    Write-Host "  All $($mochaFiles.Count) test files match between Mocha and Vitest" -ForegroundColor Green
    Write-Host ""
    exit 0
}
