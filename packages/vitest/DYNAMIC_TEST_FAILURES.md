# Dynamic Test Failures Tracking

This file tracks failing dynamic tests (tests that use `executeDynamicTestAsync`).

**Last Updated:** 2025-12-03  
**Total Failing:** 73 tests across 13 scenarios  
**Total Passing:** 444 tests

## Status Legend
- ⬜ Not Started
- 🔄 In Progress  
- ✅ Fixed
- ❌ Won't Fix (documented reason)

---

## 1. Background Keyword Tests

### File: `Background_reports_errors.Spec.ts`

|  Status  |               Scenario               |  Root Cause  |  Notes  |
| -------- | ----------                           | ------------ | ------- |
| ⬜        | Throw exception in a background step |              |         |
| ⬜        | Throw exception in a afterbackground |              |         |

### File: `Background_support_only.Spec.ts`

|  Status  |          Scenario          |  Root Cause  |  Notes  |
| -------- | ----------                 | ------------ | ------- |
| ⬜        | Scenario marked as .only   |              |         |
| ⬜        | Scenario marked with a tag |              |         |

---

## 2. Filtering Tests

### File: `Filter_exclude_overrides_include.Spec.ts`

|  Status  |                             Scenario                             |  Root Cause  |  Notes  |
| -------- | ----------                                                       | ------------ | ------- |
| ⬜        | Using include and exclude option to specify Features to execute  |              |         |
| ⬜        | Using include and exclude option to specify Scenarios to execute |              |         |
| ⬜        | Using include option to specify ScenarioOutline to execute       |              |         |

### File: `Filter_exclude_restricts_spec_to_non-matching_tags.Spec.ts`

|  Status  |                          Scenario                          |  Root Cause  |  Notes  |
| -------- | ----------                                                 | ------------ | ------- |
| ⬜        | Using exclude option to specify Features to execute        |              |         |
| ⬜        | Using exclude option to specify Scenarios to execute       |              |         |
| ⬜        | Using exclude option to specify ScenarioOutline to execute |              |         |

### File: `Filter_include_restricts_spec_to_matching_tags.Spec.ts`

|  Status  |                          Scenario                          |  Root Cause  |  Notes  |
| -------- | ----------                                                 | ------------ | ------- |
| ⬜        | Using include option to specify Features to execute        |              |         |
| ⬜        | Using include option to specify Scenarios to execute       |              |         |
| ⬜        | Using include option to specify ScenarioOutline to execute |              |         |

### File: `Filters_with_no_matches_have_no_results.Spec.ts`

|  Status  |         Scenario          |  Root Cause  |  Notes  |
| -------- | ----------                | ------------ | ------- |
| ⬜        | ld-include has no matches |              |         |
| ⬜        | ld-exclude has no matches |              |         |

---

## 3. Reporter Tests

### File: `Find_root_path.Spec.ts`

|  Status  |                     Scenario                      |  Root Cause  |  Notes  |
| -------- | ----------                                        | ------------ | ------- |
| ⬜        | Multiple Features are executed with various paths |              |         |

### File: `Reporter_augments_model_with_execution_results.Spec.ts`

|  Status  |                            Scenario                             |  Root Cause  |  Notes  |
| -------- | ----------                                                      | ------------ | ------- |
| ⬜        | Describe it statements are updated with execution results       |              |         |
| ⬜        | Each passing step is captured as part of the model              |              |         |
| ⬜        | Steps that Fail have the meta-data added to model               |              |         |
| ⬜        | Steps that throw an exception have the meta-data added to model |              |         |

### File: `Suites_and_Steps_have_uniqueIds.Spec.ts`

|  Status  |                         Scenario                          |  Root Cause  |  Notes  |
| -------- | ----------                                                | ------------ | ------- |
| ⬜        | Features have Ids for suites and steps added to the model |              |         |
| ⬜        | Features with duplicate titles                            |              |         |
| ⬜        | Scenarios with duplicate titles within a Feature          |              |         |
| ⬜        | Steps with duplicate titles within a Scenario             |              |         |

---

## 4. Rule Violations Tests

### File: `Enforce_vitest_limitations.Spec.ts`

|  Status  |                           Scenario                            |  Root Cause  |  Notes  |
| -------- | ----------                                                    | ------------ | ------- |
| ⬜        | Use of async on top level describe alias' (ScenarioOutline)   |              |         |
| ⬜        | Use of async on child level describe alias' (ScenarioOutline) |              |         |
| ⬜        | Use of async on scenarioOutline describe alias'               |              |         |

### File: `Ensure_correctly_structured_Specs.Spec.ts`

|  Status  |                    Scenario                    |  Root Cause  |  Notes  |
| -------- | ----------                                     | ------------ | ------- |
| ⬜        | Feature mixes BDD languages (ScenarioOutline)  |              |         |
| ⬜        | Scenario mixes BDD languages (ScenarioOutline) |              |         |
| ⬜        | Invalid Feature children (ScenarioOutline)     |              |         |
| ⬜        | Invalid Background children (ScenarioOutline)  |              |         |

### File: `Validate_step_rules.Spec.ts`

|  Status  |                             Scenario                              |  Root Cause  |         Notes         |
| -------- | ----------                                                        | ------------ | -------               |
| ⬜        | Setting the LiveDocOptions to enabled for rules (ScenarioOutline) |              |                       |
| ⬜        | Ensure keywords have titles                                       |              |                       |
| ⬜        | Using before instead of given in scenario                         |              | Needs `before` export |

---

## 5. Vitest Features Tests

### File: `Describe_still_is_supported.Spec.ts`

|  Status  |                 Scenario                  |                 Root Cause                 |                                     Notes                                     |
| -------- | ----------                                | ------------                               | -------                                                                       |
| ⬜        | Various suite features work as expected   | VitestSuite reconstruction not implemented | `executionResults.suites` is empty. Added `it.skip`, `it.only`, `test` export |
| ⬜        | bdd features work at the root level suite | VitestSuite reconstruction not implemented | Same root cause                                                               |

---

## Known Issues Summary

1. **`it.skip` not exported** - The `it` function doesn't have `.skip`/`.only` methods
2. **`before` not exported** - Vitest's `beforeAll` needs to be aliased as `before`
3. **Suites array empty** - VitestSuite reconstruction not implemented in `executeDynamicTestAsync`
4. **Rule violation message format** - Error messages may have different formatting
5. **Exception/error capture** - Exception details may not be properly captured in dynamic execution

---

## Change Log

| Date       | Changes                                                 |
| ------     | ---------                                               |
| 2025-12-03 | Initial tracking file created. 73 failures, 444 passes. |

