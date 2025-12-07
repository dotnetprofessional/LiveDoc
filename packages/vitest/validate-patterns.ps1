# Focused Pattern Validation for Scenario Outlines
# Checks for specific patterns that were problematic

$vitestPath = "D:\private\LiveDoc\packages\livedoc-vitest"
$issues = @()

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Scenario Outline Pattern Validation" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Test 1: Beautiful Tea - placeholders should be intact
Write-Host "`n[1] Testing Beautiful Tea - Placeholder integrity..." -ForegroundColor Yellow
Push-Location $vitestPath
$output = npm run test:spec -- "_src/test/Sample/Tutorial/Tutorial.Spec.ts" 2>&1 | Out-String
Pop-Location

if ($output -match '<Customer''s Country>') {
    Write-Host "  ✓ Template placeholders intact" -ForegroundColor Green
} else {
    Write-Host "  ✗ Template placeholders missing or malformed" -ForegroundColor Red
    $issues += "Beautiful Tea: Placeholders not found in template"
}

if ($output -match 'Australia.*New Zealand.*Zimbabwe') {
    Write-Host "  ✓ Example values present" -ForegroundColor Green
} else {
    Write-Host "  ✗ Example values missing" -ForegroundColor Red
    $issues += "Beautiful Tea: Example values not displayed"
}

# Test 2: Mix BDD Language - word boundary issue
Write-Host "`n[2] Testing Mix BDD Language - Word boundaries..." -ForegroundColor Yellow
Push-Location $vitestPath
$output = npm run test:spec -- "_src/test/Rule Violations/Ensure_correctly_structured_Specs.Spec.ts" 2>&1 | Out-String
Pop-Location

if ($output -match 'w<keyword>h' -or $output -match 'w<suggestion>h') {
    Write-Host "  ✗ Word boundary issue detected (partial replacement)" -ForegroundColor Red
    $issues += "Mix BDD: 'with' being partially replaced"
} else {
    Write-Host "  ✓ No word boundary issues" -ForegroundColor Green
}

if ($output -match 'with the following description') {
    Write-Host "  ✓ 'with' is intact in template" -ForegroundColor Green
} else {
    Write-Host "  ✗ 'with' may be corrupted" -ForegroundColor Red  
    $issues += "Mix BDD: 'with' not found correctly in template"
}

# Test 3: Scenario Outline - Examples table
Write-Host "`n[3] Testing Scenario Outline - Examples table..." -ForegroundColor Yellow
Push-Location $vitestPath
$output = npm run test:spec -- "_src/test/ScenarioOutline.Spec.ts" 2>&1 | Out-String
Pop-Location

if ($output -match 'Examples:') {
    Write-Host "  ✓ Examples table header present" -ForegroundColor Green
} else {
    Write-Host "  ✗ Examples table header missing" -ForegroundColor Red
    $issues += "ScenarioOutline: Examples table header missing"
}

if ($output -match 'Example: 1') {
    Write-Host "  ✓ Individual examples enumerated" -ForegroundColor Green
} else {
    Write-Host "  ✗ Individual examples not shown" -ForegroundColor Red
    $issues += "ScenarioOutline: Individual examples not displayed"
}

# Test 4: Background with Scenario Outline
Write-Host "`n[4] Testing Background with Scenario Outline..." -ForegroundColor Yellow
Push-Location $vitestPath
$output = npm run test:spec -- "_src/test/Background_Keyword/Background_suports_Scenario_Outline.Spec.ts" 2>&1 | Out-String
Pop-Location

if ($output -match 'Background:') {
    Write-Host "  ✓ Background section present" -ForegroundColor Green
} else {
    Write-Host "  ✗ Background section missing" -ForegroundColor Red
    $issues += "Background+Outline: Background section missing"
}

if ($output -match 'Scenario Outline:') {
    Write-Host "  ✓ Scenario Outline section present" -ForegroundColor Green
} else {
    Write-Host "  ✗ Scenario Outline section missing" -ForegroundColor Red
    $issues += "Background+Outline: Scenario Outline section missing"
}

# Test 5: Multiple tables
Write-Host "`n[5] Testing Multiple Example Tables..." -ForegroundColor Yellow
Push-Location $vitestPath
$output = npm run test:spec -- "_src/test/ScenarioOutline.Spec.ts" 2>&1 | Out-String
Pop-Location

$exampleMatches = ([regex]::Matches($output, 'Example: \d+')).Count
if ($exampleMatches -ge 8) {
    Write-Host "  ✓ Multiple tables handled (found $exampleMatches examples)" -ForegroundColor Green
} else {
    Write-Host "  ✗ Not all examples shown (found $exampleMatches, expected 8+)" -ForegroundColor Red
    $issues += "Multiple Tables: Not all examples displayed"
}

# Summary
Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host "VALIDATION SUMMARY" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

if ($issues.Count -eq 0) {
    Write-Host "✓ All pattern validations PASSED" -ForegroundColor Green
    exit 0
} else {
    Write-Host "✗ Found $($issues.Count) issues:" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "  - $issue" -ForegroundColor Red
    }
    exit 1
}
