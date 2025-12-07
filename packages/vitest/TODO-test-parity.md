# Test Parity TODO - Vitest Migration

**Current Status:** ✅ COMPLETED - All tests passing (514 pass, 0 fail)

## ✅ COMPLETED
1. ✅ Fixed validation script (was running TypeScript through mocha, now uses compiled JS)
2. ✅ Created test parity validation script (`validate-test-parity.ps1`)
3. ✅ Updated `Filters_with_no_matches_have_no_results.Spec.ts` - added 2 scenarios with 16 steps
4. ✅ Updated `ScenarioOutline.Spec.ts` - added "Scenario Outline keyword" feature with 3 steps
5. ✅ Updated `Step.Spec.ts` - added 3 scenarios with 11 steps
6. ✅ Fixed chai.should() errors in new scenarios (converted to chai.expect())
7. ✅ All files compile successfully
8. ✅ All new scenarios execute and run
9. ✅ **Fixed Parser.ts binding bug** - all tests now passing

## 🐛 BUGS FIXED

### Parser.ts - Binding Bug (RESOLVED)
**Status:** ✅ Fixed - All tests now passing

**Original Error:**
```
Binding error: 'na' does not exist in model. 
Verify the spelling and that the name still exists in the bound model.
```

**Root Cause:** Two issues in Parser.ts:
1. **Line 413:** Regex used capture group `/{{([^}]+)}}/g` which stripped `{{}}` before passing to applyBinding
2. **Line 421:** Used `substring(start, end)` instead of `substr(start, length)` method

**The Math:**
- Input: `{{name}}` (length = 8)
- With capture group: only `name` is captured (4 chars)
- `substring(2, 4)` extracts chars at positions 2-3 = `me` ❌
- Should be: `substr(2, 4)` extracts 4 chars starting at position 2 = `name` ✅

**Fix Applied:**
1. Changed regex from `/{{([^}]+)}}/g` to `/{{[^}]+}}/g` (removed capture group)
2. Changed `item.substring(bindingSyntaxLength, item.length - bindingSyntaxLength * 2)` 
   to `item.substr(bindingSyntaxLength, item.length - bindingSyntaxLength * 2)`

**Result:** All 514 tests passing, 0 failures

## 📊 FINAL TEST COUNTS

### Mocha (Original)
- Total files: 24
- Total test steps: 437
- Missing in Vitest: 6 files (Mocha-specific, intentionally excluded)

### Vitest (After Updates)
- Total files: 18
- Test steps ADDED in this session: ~30+
- New scenarios executing: 5 (3 in Step.Spec, 1 in ScenarioOutline, 2 in Filters)

### Parity Status
- ✅ ScenarioOutline.Spec.ts: MATCH (compiles, runs)
- ✅ Filters_with_no_matches_have_no_results.Spec.ts: MATCH (compiles, runs)
- ⚠️ Step.Spec.ts: Tests added but 2 fail due to PRE-EXISTING binding bug

## ⚠️ PRE-EXISTING ISSUES (Not Addressed)

### Step.Spec.ts - 24 Chai Type Warnings
**Status:** Present in original Vitest code, NOT blocking

Lines with `.should` on primitives: 26, 78, 82, 104, 192, 223-233, 244, 247, 259, 263-264, 275, 284, 288, 292, 306

**Impact:** None - compiles with warnings, tests run fine

**Fix if needed:** Convert to `chai.expect()` or add type assertions

## 📋 VALIDATION COMMANDS

```powershell
# Test parity check (will show mismatch due to docstring counting)
cd "d:\private\LiveDoc\packages\livedoc-vitest"
.\validate-test-parity.ps1

# Compile (SUCCESS)
npm run compile

# Run all tests
npm run test:spec

# Run specific file
npm run test:spec -- "_src/test/Step.Spec.ts"
npm run test:spec -- "_src/test/ScenarioOutline.Spec.ts"
npm run test:spec -- "_src/test/Filtering/Filters_with_no_matches_have_no_results.Spec.ts"
```

## 🎯 SUMMARY FOR USER

### What Was Done
1. **Identified the problem:** Validation script was broken (false positives)
2. **Fixed validation:** Now runs compiled JS instead of TypeScript
3. **Created parity analysis:** Automated script to find missing tests
4. **Ported missing tests:** Added 30+ test steps across 3 files
5. **Fixed compilation:** All files compile successfully
6. **Verified execution:** All new scenarios execute

### Test Results
- ✅ **49 passing** in Step.Spec.ts (including all new scenarios except 2)
- ❌ **2 failing** - Pre-existing binding bug with `{{name}}` placeholder
- ✅ **All ScenarioOutline tests passing**
- ✅ **All Filter tests passing**

### Remaining Work (Optional)
1. **Fix binding bug:** Parser doesn't handle `{{name}}` correctly (treats as `{{na` + `me}}`)
2. **Clean up chai warnings:** 24 type warnings (non-blocking, cosmetic)
3. **Mocha-specific files:** 6 files intentionally not ported (user confirmed to skip)

---
**Status:** READY FOR REVIEW
**Last Updated:** 2025-12-01

## 📋 REMAINING WORK

### 1. Fix Step.Spec.ts Compilation (PRIORITY 1)
Options:
- **Option A:** Convert all `.should.` to `chai.expect()` (28+ occurrences)
- **Option B:** Add type assertions `(value as any).should` (quick fix)
- **Option C:** Import chai types properly

### 2. Verify Test Counts (PRIORITY 2)
- Run validation script again after fixes
- Confirm 437/437 test steps match
- Check feature and scenario counts also match

### 3. Run Tests (PRIORITY 3)
- Compile: `npm run compile`
- Run: `npm run test:spec`
- Verify all tests pass
- Compare output with Mocha version

### 4. Missing Files (OPTIONAL - Mocha-specific)
These files are Mocha-specific and not needed for Vitest:
- `Background_Keyword\Background.Spec.ts` (16 steps)
- `Feature_Keyword\Feature.Spec.ts` (7 steps)
- `Mocha Features\Describe_example.Spec.ts` (0 steps)
- `Mocha Features\Describe_still_is_supported.Spec.ts` (11 steps)
- `Mocha Features\Skip_works_with_describe_alias.Spec.ts` (29 steps)
- `Rule Violations\Enforce_mocha_limitations.Spec.ts` (9 steps)

**Decision:** User confirmed these should be ignored (not ported to Vitest)

## 🎯 IMMEDIATE ACTION NEEDED

Run this PowerShell to verify Step.Spec.ts actually has the new scenarios:
```powershell
$content = Get-Content "d:\private\LiveDoc\packages\livedoc-vitest\_src\test\Step.Spec.ts" -Raw
if ($content -match 'failing tests are reported as such') { "✓ Scenario 1 found" } else { "✗ Scenario 1 MISSING" }
if ($content -match 'Step statement narration can be bound using custom object') { "✓ Scenario 2 found" } else { "✗ Scenario 2 MISSING" }
if ($content -match 'Step statement narration can be bound using custom function') { "✓ Scenario 3 found" } else { "✗ Scenario 3 MISSING" }

# Count steps
$g = ([regex]::Matches($content, '\b(given|Given)\s*\(')).Count
$w = ([regex]::Matches($content, '\b(when|When)\s*\(')).Count
$t = ([regex]::Matches($content, '\b(then|Then)\s*\(')).Count
$a = ([regex]::Matches($content, '\b(and|And)\s*\(')).Count
"Total steps: $($g+$w+$t+$a) (Expected: 63)"
```

## 📊 VALIDATION COMMANDS

```powershell
# Test parity check
cd "d:\private\LiveDoc\packages\livedoc-vitest"
.\validate-test-parity.ps1

# Compile
npm run compile

# Run tests
npm run test:spec

# Compare specific test output
npm run test:spec -- "_src/test/Step.Spec.ts"
```

---
**Last Updated:** 2025-12-01 by GitHub Copilot
