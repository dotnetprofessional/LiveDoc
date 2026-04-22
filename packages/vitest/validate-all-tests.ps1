# Comprehensive Mocha vs Vitest Output Validation
# Captures ANSI color codes and performs detailed comparison

param(
    [string]$TestFilter = "",
    [switch]$ShowDiffs,
    [switch]$ColorValidation,
    [switch]$IgnoreTiming
)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$mochaPath = "D:\private\LiveDoc\packages\livedoc-mocha"
$vitestPath = "D:\private\LiveDoc\packages\livedoc-vitest"
$outputDir = "D:\private\LiveDoc\validation-output"
$reportFile = Join-Path $outputDir "validation-report.html"

# Create output directory
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host "  COMPREHENSIVE OUTPUT VALIDATION: Mocha vs Vitest" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Output Directory: $outputDir" -ForegroundColor Gray
Write-Host "Timing Ignored:   $IgnoreTiming" -ForegroundColor Gray
Write-Host "Color Check:      $ColorValidation" -ForegroundColor Gray
Write-Host ""

# Get all test files from Vitest
$testFiles = Get-ChildItem -Path "$vitestPath\_src\test" -Filter "*.Spec.ts" -Recurse | 
    Where-Object { $_.Name -notlike "*node_modules*" }

if ($TestFilter) {
    $testFiles = $testFiles | Where-Object { $_.FullName -like "*$TestFilter*" }
}

$totalTests = $testFiles.Count
$currentTest = 0
$results = @()
$colorIssues = @()

# ANSI color code patterns
$ansiCyan = '\x1b\[36m|\x1b\[96m'
$ansiYellow = '\x1b\[33m|\x1b\[93m'
$ansiGreen = '\x1b\[32m|\x1b\[92m'
$ansiReset = '\x1b\[0m'

function Normalize-Output {
    param(
        [string]$text,
        [bool]$removeTiming = $true,
        [bool]$keepAnsi = $false
    )
    
    # Remove npm/command output noise
    $text = $text -replace '(?m)^>.*$', ''
    $text = $text -replace '(?m)^npm .*$', ''
    $text = $text -replace '(?m)^Command exited.*$', ''
    $text = $text -replace 'vitest run.*', ''
    $text = $text -replace 'mocha --require.*', ''
    
    if ($removeTiming) {
        # Normalize timing values
        $text = $text -replace '\d+\.?\d*\s*ms', 'XXms'
        $text = $text -replace '\d+\.?\d+\s*│', 'XX.XX │'
        $text = $text -replace 'Elapsed\s*│\s*\d+\.?\d+', 'Elapsed │ XX.XX'
    }
    
    if (-not $keepAnsi) {
        # Remove ANSI codes
        $text = $text -replace '\x1b\[[0-9;]*m', ''
    }
    
    # Normalize line endings
    $text = $text -replace '\r\n', "`n"
    $text = $text -replace '\r', "`n"
    
    # Remove empty lines at start/end
    $text = $text.Trim()
    
    return $text
}

function Extract-TestOutput {
    param([string]$text)
    
    $lines = $text -split "`n"
    $output = @()
    $capturing = $false
    $foundFeature = $false
    
    foreach ($line in $lines) {
        # Start capturing from first Feature:
        if ($line -match '^\s*Feature:' -and -not $foundFeature) {
            $capturing = $true
            $foundFeature = $true
        }
        
        if ($capturing) {
            $output += $line
        }
        
        # Stop at Totals line
        if ($line -match '│\s*Totals') {
            $output += $line
            $output += "└─" # Add closing line
            break
        }
    }
    
    return ($output -join "`n").Trim()
}

function Check-ColorCodes {
    param(
        [string]$text,
        [string]$testName
    )
    
    $issues = @()
    
    # Check for placeholder highlighting (should be cyan)
    if ($text -match '<[^>]+>') {
        $placeholders = [regex]::Matches($text, '<[^>]+>')
        foreach ($match in $placeholders) {
            $context = $text.Substring([Math]::Max(0, $match.Index - 10), [Math]::Min(50, $text.Length - [Math]::Max(0, $match.Index - 10)))
            if ($context -notmatch '\x1b\[36m|\x1b\[96m') {
                $issues += "Placeholder '$($match.Value)' may not be cyan"
            }
        }
    }
    
    # Check for step keywords (should be yellow)
    $keywords = [regex]::Matches($text, '\s+(Given|When|Then|And|But)\s+')
    foreach ($match in $keywords) {
        $context = $text.Substring([Math]::Max(0, $match.Index - 5), [Math]::Min(30, $text.Length - [Math]::Max(0, $match.Index - 5)))
        if ($context -notmatch '\x1b\[33m|\x1b\[93m') {
            # Note: This might be a false positive if already in a colored section
            # $issues += "Keyword '$($match.Value.Trim())' may not be yellow"
        }
    }
    
    return $issues
}

# Process each test
foreach ($testFile in $testFiles) {
    $currentTest++
    $relativePath = $testFile.FullName.Replace("$vitestPath\_src\test\", "").Replace("\", "/")
    $testName = $testFile.BaseName
    
    $percentComplete = [Math]::Round(($currentTest / $totalTests) * 100, 1)
    Write-Progress -Activity "Validating Tests" -Status "[$currentTest/$totalTests] $relativePath" -PercentComplete $percentComplete
    
    $result = @{
        TestName = $testName
        RelativePath = $relativePath
        Status = "Unknown"
        MochaSuccess = $false
        VitestSuccess = $false
        OutputMatch = $false
        Differences = @()
        ColorIssues = @()
        MochaFile = ""
        VitestFile = ""
        DiffFile = ""
    }
    
    # Run Mocha version
    Write-Host "[$currentTest/$totalTests] " -NoNewline -ForegroundColor Cyan
    Write-Host "$relativePath" -ForegroundColor White
    Write-Host "  Running Mocha... " -NoNewline -ForegroundColor Gray
    
    try {
        Push-Location $mochaPath
        # Convert TypeScript path to compiled JavaScript path
        $mochaTestPath = "build\test\$($relativePath -replace '\.ts$', '.js')"
        
        # Capture with ANSI codes preserved
        $mochaRawFile = Join-Path $outputDir "$testName.mocha.raw.txt"
        $mochaCmd = "npm run test-spec -- `"$mochaTestPath`" 2>&1"
        $mochaOutput = Invoke-Expression $mochaCmd | Out-String
        
        # Save raw output with ANSI codes
        [System.IO.File]::WriteAllText($mochaRawFile, $mochaOutput, [System.Text.Encoding]::UTF8)
        
        $result.MochaSuccess = $LASTEXITCODE -eq 0
        Pop-Location
        
        if ($result.MochaSuccess) {
            Write-Host "✓" -ForegroundColor Green
        } else {
            Write-Host "✗ (exit code: $LASTEXITCODE)" -ForegroundColor Red
        }
    } catch {
        Write-Host "✗ Error: $_" -ForegroundColor Red
        Pop-Location
        $result.Status = "Mocha Failed"
        $results += $result
        continue
    }
    
    # Run Vitest version
    Write-Host "  Running Vitest... " -NoNewline -ForegroundColor Gray
    
    try {
        Push-Location $vitestPath
        $vitestTestPath = "_src\test\$relativePath"
        
        # Capture with ANSI codes preserved
        $vitestRawFile = Join-Path $outputDir "$testName.vitest.raw.txt"
        $vitestCmd = "npm run test:spec -- `"$vitestTestPath`" 2>&1"
        $vitestOutput = Invoke-Expression $vitestCmd | Out-String
        
        # Save raw output with ANSI codes
        [System.IO.File]::WriteAllText($vitestRawFile, $vitestOutput, [System.Text.Encoding]::UTF8)
        
        $result.VitestSuccess = $LASTEXITCODE -eq 0
        Pop-Location
        
        if ($result.VitestSuccess) {
            Write-Host "✓" -ForegroundColor Green
        } else {
            Write-Host "✗ (exit code: $LASTEXITCODE)" -ForegroundColor Red
        }
    } catch {
        Write-Host "✗ Error: $_" -ForegroundColor Red
        Pop-Location
        $result.Status = "Vitest Failed"
        $results += $result
        continue
    }
    
    # Extract and normalize test outputs
    Write-Host "  Comparing outputs... " -NoNewline -ForegroundColor Gray
    
    $mochaTest = Extract-TestOutput $mochaOutput
    $vitestTest = Extract-TestOutput $vitestOutput
    
    $mochaClean = Normalize-Output $mochaTest -removeTiming:$IgnoreTiming -keepAnsi:$false
    $vitestClean = Normalize-Output $vitestTest -removeTiming:$IgnoreTiming -keepAnsi:$false
    
    # Save cleaned outputs for comparison
    $mochaFile = Join-Path $outputDir "$testName.mocha.txt"
    $vitestFile = Join-Path $outputDir "$testName.vitest.txt"
    [System.IO.File]::WriteAllText($mochaFile, $mochaClean, [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText($vitestFile, $vitestClean, [System.Text.Encoding]::UTF8)
    
    $result.MochaFile = $mochaFile
    $result.VitestFile = $vitestFile
    
    # Character-by-character comparison
    if ($mochaClean -eq $vitestClean) {
        Write-Host "✓ EXACT MATCH" -ForegroundColor Green
        $result.Status = "Match"
        $result.OutputMatch = $true
    } else {
        # Calculate differences
        $mochaLines = $mochaClean -split "`n"
        $vitestLines = $vitestClean -split "`n"
        
        $maxLines = [Math]::Max($mochaLines.Length, $vitestLines.Length)
        $diffCount = 0
        
        for ($i = 0; $i -lt $maxLines; $i++) {
            $mochaLine = if ($i -lt $mochaLines.Length) { $mochaLines[$i] } else { "" }
            $vitestLine = if ($i -lt $vitestLines.Length) { $vitestLines[$i] } else { "" }
            
            if ($mochaLine -ne $vitestLine) {
                $diffCount++
                if ($diffCount -le 5) {  # Store first 5 differences
                    $result.Differences += @{
                        Line = $i + 1
                        Mocha = $mochaLine.Substring(0, [Math]::Min(100, $mochaLine.Length))
                        Vitest = $vitestLine.Substring(0, [Math]::Min(100, $vitestLine.Length))
                    }
                }
            }
        }
        
        Write-Host "✗ $diffCount differences" -ForegroundColor Yellow
        $result.Status = "Different"
        
        # Create diff file
        $diffFile = Join-Path $outputDir "$testName.diff.txt"
        $diffContent = "DIFFERENCES FOUND: $diffCount lines differ`n`n"
        
        foreach ($diff in $result.Differences) {
            $diffContent += "Line $($diff.Line):`n"
            $diffContent += "  Mocha:  $($diff.Mocha)`n"
            $diffContent += "  Vitest: $($diff.Vitest)`n`n"
        }
        
        if ($diffCount -gt 5) {
            $diffContent += "... and $($diffCount - 5) more differences`n"
        }
        
        [System.IO.File]::WriteAllText($diffFile, $diffContent, [System.Text.Encoding]::UTF8)
        $result.DiffFile = $diffFile
    }
    
    # Color validation if requested
    if ($ColorValidation -and $result.VitestSuccess) {
        $vitestAnsi = Normalize-Output $vitestTest -removeTiming:$IgnoreTiming -keepAnsi:$true
        $colorProblems = Check-ColorCodes $vitestAnsi $testName
        if ($colorProblems.Count -gt 0) {
            $result.ColorIssues = $colorProblems
            $colorIssues += @{
                Test = $testName
                Issues = $colorProblems
            }
        }
    }
    
    $results += $result
}

Write-Progress -Activity "Validating Tests" -Completed

# Generate HTML Report
Write-Host "`nGenerating HTML report..." -ForegroundColor Cyan

$htmlContent = @"
<!DOCTYPE html>
<html>
<head>
    <title>LiveDoc Validation Report</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background: #f5f5f5; }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        .summary { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 15px; }
        .stat-box { padding: 15px; border-radius: 5px; text-align: center; }
        .stat-value { font-size: 2em; font-weight: bold; }
        .stat-label { font-size: 0.9em; color: #7f8c8d; margin-top: 5px; }
        .success { background: #d4edda; color: #155724; }
        .warning { background: #fff3cd; color: #856404; }
        .danger { background: #f8d7da; color: #721c24; }
        .info { background: #d1ecf1; color: #0c5460; }
        table { width: 100%; border-collapse: collapse; background: white; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        th { background: #34495e; color: white; padding: 12px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #ecf0f1; }
        tr:hover { background: #f8f9fa; }
        .status-match { color: #27ae60; font-weight: bold; }
        .status-diff { color: #e67e22; font-weight: bold; }
        .status-fail { color: #c0392b; font-weight: bold; }
        .diff-link { color: #3498db; text-decoration: none; }
        .diff-link:hover { text-decoration: underline; }
        .collapsible { background-color: #f1f1f1; cursor: pointer; padding: 10px; border: none; text-align: left; width: 100%; margin-top: 5px; }
        .collapsible:hover { background-color: #ddd; }
        .diff-content { display: none; padding: 10px; background: #fafafa; border-left: 3px solid #e67e22; margin: 5px 0; font-family: 'Courier New', monospace; font-size: 0.9em; }
    </style>
    <script>
        function toggleDiff(id) {
            var content = document.getElementById(id);
            if (content.style.display === "block") {
                content.style.display = "none";
            } else {
                content.style.display = "block";
            }
        }
    </script>
</head>
<body>
    <h1>📊 LiveDoc Validation Report</h1>
    <div class="summary">
        <h2>Summary</h2>
        <div class="summary-grid">
            <div class="stat-box info">
                <div class="stat-value">$totalTests</div>
                <div class="stat-label">Total Tests</div>
            </div>
            <div class="stat-box success">
                <div class="stat-value">$($results | Where-Object { $_.OutputMatch } | Measure-Object | Select-Object -ExpandProperty Count)</div>
                <div class="stat-label">Exact Matches</div>
            </div>
            <div class="stat-box warning">
                <div class="stat-value">$($results | Where-Object { $_.Status -eq "Different" } | Measure-Object | Select-Object -ExpandProperty Count)</div>
                <div class="stat-label">Differences</div>
            </div>
            <div class="stat-box danger">
                <div class="stat-value">$($results | Where-Object { -not $_.MochaSuccess -or -not $_.VitestSuccess } | Measure-Object | Select-Object -ExpandProperty Count)</div>
                <div class="stat-label">Failures</div>
            </div>
        </div>
    </div>
    
    <h2>Test Results</h2>
    <table>
        <thead>
            <tr>
                <th style="width: 5%">#</th>
                <th style="width: 35%">Test</th>
                <th style="width: 10%">Status</th>
                <th style="width: 10%">Mocha</th>
                <th style="width: 10%">Vitest</th>
                <th style="width: 30%">Details</th>
            </tr>
        </thead>
        <tbody>
"@

$index = 1
foreach ($result in $results) {
    $statusClass = switch ($result.Status) {
        "Match" { "status-match" }
        "Different" { "status-diff" }
        default { "status-fail" }
    }
    
    $mochaStatus = if ($result.MochaSuccess) { "✓" } else { "✗" }
    $vitestStatus = if ($result.VitestSuccess) { "✓" } else { "✗" }
    
    $htmlContent += @"
            <tr>
                <td>$index</td>
                <td><strong>$($result.TestName)</strong><br/><small style="color: #7f8c8d;">$($result.RelativePath)</small></td>
                <td class="$statusClass">$($result.Status)</td>
                <td>$mochaStatus</td>
                <td>$vitestStatus</td>
                <td>
"@
    
    if ($result.Differences.Count -gt 0) {
        $diffId = "diff_$index"
        $htmlContent += "<button class='collapsible' onclick='toggleDiff(`"$diffId`")'>Show $($result.Differences.Count) differences</button>"
        $htmlContent += "<div class='diff-content' id='$diffId'>"
        
        foreach ($diff in $result.Differences) {
            $htmlContent += "<strong>Line $($diff.Line):</strong><br/>"
            $htmlContent += "Mocha: $([System.Web.HttpUtility]::HtmlEncode($diff.Mocha))<br/>"
            $htmlContent += "Vitest: $([System.Web.HttpUtility]::HtmlEncode($diff.Vitest))<br/><br/>"
        }
        
        $htmlContent += "</div>"
    }
    
    if ($result.ColorIssues.Count -gt 0) {
        $htmlContent += "<div style='color: #e67e22; margin-top: 5px;'>⚠ $($result.ColorIssues.Count) color issues</div>"
    }
    
    $htmlContent += @"
                </td>
            </tr>
"@
    $index++
}

$htmlContent += @"
        </tbody>
    </table>
    
    <div style="margin-top: 30px; padding: 20px; background: white; border-radius: 5px;">
        <h3>Output Files</h3>
        <p>All test outputs have been saved to: <code>$outputDir</code></p>
        <p>For each test, the following files are available:</p>
        <ul>
            <li><strong>.mocha.raw.txt</strong> - Raw Mocha output with ANSI codes</li>
            <li><strong>.vitest.raw.txt</strong> - Raw Vitest output with ANSI codes</li>
            <li><strong>.mocha.txt</strong> - Cleaned Mocha output</li>
            <li><strong>.vitest.txt</strong> - Cleaned Vitest output</li>
            <li><strong>.diff.txt</strong> - Detailed differences (if any)</li>
        </ul>
    </div>
</body>
</html>
"@

[System.IO.File]::WriteAllText($reportFile, $htmlContent, [System.Text.Encoding]::UTF8)

# Print Summary
Write-Host ""
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host "  VALIDATION SUMMARY" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total Tests:      " -NoNewline; Write-Host $totalTests -ForegroundColor White
Write-Host "Exact Matches:    " -NoNewline; Write-Host ($results | Where-Object { $_.OutputMatch } | Measure-Object | Select-Object -ExpandProperty Count) -ForegroundColor Green
Write-Host "Differences:      " -NoNewline; Write-Host ($results | Where-Object { $_.Status -eq "Different" } | Measure-Object | Select-Object -ExpandProperty Count) -ForegroundColor Yellow
Write-Host "Test Failures:    " -NoNewline; Write-Host ($results | Where-Object { -not $_.MochaSuccess -or -not $_.VitestSuccess } | Measure-Object | Select-Object -ExpandProperty Count) -ForegroundColor Red

if ($ColorValidation) {
    Write-Host "Color Issues:     " -NoNewline; Write-Host $colorIssues.Count -ForegroundColor $(if ($colorIssues.Count -gt 0) { "Yellow" } else { "Green" })
}

Write-Host ""
Write-Host "Output Directory: $outputDir" -ForegroundColor Cyan
Write-Host "HTML Report:      $reportFile" -ForegroundColor Cyan
Write-Host ""

# Open report
Start-Process $reportFile

# Return exit code
$diffCount = ($results | Where-Object { $_.Status -eq "Different" } | Measure-Object | Select-Object -ExpandProperty Count)
$failCount = ($results | Where-Object { -not $_.MochaSuccess -or -not $_.VitestSuccess } | Measure-Object | Select-Object -ExpandProperty Count)

exit ($diffCount + $failCount)
