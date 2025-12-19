import { describe as vitestDescribe, it as vitestIt, beforeAll, afterAll } from "vitest";
import { getCurrentSuite } from "vitest/suite";
import { LiveDocGrammarParser } from "./parser/Parser";
import * as model from "./model/index";
import { LiveDocOptions } from "./LiveDocOptions";
import { RuleViolations } from "./model/RuleViolations";
import { LiveDocRuleOption } from "./LiveDocRuleOption";
import { LiveDocRuleViolation } from "./model/LiveDocRuleViolation";
import chalk from "chalk";
import { featureRegistry, suiteRegistry } from "./LiveDocRegistry";
import SilentReporter from "./reporter/SilentReporter";

const parser = new LiveDocGrammarParser();

/**
 * Extract filename from Error stack trace, handling different formats
 * @param skipFrames Number of stack frames to skip (caller's caller = 2)
 */
function getFilenameFromStack(skipFrames: number = 2): string {
    const stack = new Error().stack || "";
    const stackLines = stack.split("\n");
    let filename = "unknown";
    
    // Try to find the caller's file (skip the specified frames)
    for (let i = skipFrames; i < Math.min(stackLines.length, skipFrames + 5); i++) {
        const line = stackLines[i];
        // Pattern 1: (filename:line:col)
        let match = line.match(/\((.+?):\d+:\d+\)/);
        if (match && !match[1].includes("livedoc.ts") && !match[1].includes("node_modules")) {
            filename = match[1];
            break;
        }
        // Pattern 2: at filename:line:col (no parentheses)
        match = line.match(/at\s+(.+?):\d+:\d+$/);
        if (match && !match[1].includes("livedoc.ts") && !match[1].includes("node_modules")) {
            filename = match[1];
            break;
        }
        // Pattern 3: file:///path/to/file.ts:line:col
        match = line.match(/file:\/\/\/(.+?):\d+:\d+/);
        if (match && !match[1].includes("livedoc.ts") && !match[1].includes("node_modules")) {
            filename = match[1];
            break;
        }
    }
    return filename;
}

/**
 * Materializes placeholders in a template string using the provided values.
 * Placeholders are in the format <key>.
 */
function materializePlaceholders(template: string, values: Record<string, unknown>): string {
    return template.replace(/<([^>]+)>/g, (m, key) => {
        const k = String(key || "").trim();
        if (!k) return m;
        // Try exact match first, then sanitized match
        if (k in values) {
            const v = values[k];
            return v === undefined || v === null ? "" : String(v);
        }
        // Sanitize key (remove spaces/apostrophes) to match ScenarioExample.bind behavior
        const sanitizedKey = k.replace(/[ `'']/g, "");
        if (sanitizedKey in values) {
            const v = values[sanitizedKey];
            return v === undefined || v === null ? "" : String(v);
        }
        return m;
    });
}

// Global state for current execution context
let currentFeature: model.Feature | null = null;
let currentScenario: model.Scenario | null = null;
let currentBackground: model.Background | null = null;
let currentStep: model.StepDefinition | null = null;
let scenarioCount = 0;
let scenarioId = 0;

// Specification pattern state
let currentSpecification: model.Specification | null = null;
let ruleCount = 0;

// Registry for specifications (parallels featureRegistry)
const specificationRegistry: model.Specification[] = [];

// Per-feature maps to fix isolation between features in same file
// These were previously global singletons which caused cross-feature contamination
const afterBackgroundFnMap: Map<model.Feature, Function> = new Map();
const backgroundStepsMap: Map<model.Feature, Array<{ func: Function; stepDefinition: model.StepDefinition }>> = new Map();
const backgroundItExecutedMap: Map<model.Feature, boolean> = new Map();

// These remain global since they're reset per-scenario
let backgroundStepsComplete = false;

// Track whether we're inside a pending (skipped) context
let isPendingContext = false;

// Track whether we're inside a filtered-out context (excluded via tags)
// This is separate from isPendingContext because filtered scenarios should have
// status 'unknown' (not executed) rather than 'pending' (explicitly skipped)
let isFilteredContext = false;

// Flag to indicate if we're in dynamic execution mode
let isDynamicExecution = false;

// Store any exception that should be re-thrown to the caller
let capturedThrownException: { type: string; message: string; data?: any } | null = null;

// Track if we've already written the results file (to prevent double-writes)
let resultsFileWritten = false;

// ES Module __dirname equivalent (needed for livedocPath calculation)
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename_esm = fileURLToPath(import.meta.url);
const __dirname_esm = dirname(__filename_esm);

// Check if we're in dynamic execution mode (set by executeDynamicTestAsync)
const dynamicResultsFile = process.env.LIVEDOC_DYNAMIC_RESULTS_FILE;

if (dynamicResultsFile) {
    isDynamicExecution = true;
    
    // Register a global afterAll to write results when all tests complete
    afterAll(() => {
        // Skip if we've already written results (prevents second write from overwriting exception)
        if (resultsFileWritten) {
            return;
        }
        
        try {
            const fs = require('fs');
            const results: any = {
                features: featureRegistry.map(f => f.toJSON()),
                suites: suiteRegistry.map(s => s.toJSON())
            };
            
            // Include any captured exception
            if (capturedThrownException) {
                results.thrownException = capturedThrownException;
            }
            
            const jsonContent = JSON.stringify(results, null, 2);
            
            // Write with explicit sync to ensure data is flushed to disk
            const fd = fs.openSync(dynamicResultsFile, 'w');
            fs.writeSync(fd, jsonContent);
            fs.fsyncSync(fd);  // Force flush to disk
            fs.closeSync(fd);
            
            // Mark that we've written the file to prevent overwrites
            resultsFileWritten = true;
            
        } catch (e: any) {
            console.error('Failed to write dynamic test results:', e);
        }
    });
}

// Global options
export const livedoc = {
    options: new LiveDocOptions(),
};

// Initialize with recommended rules
livedoc.options.rules.singleGivenWhenThen = LiveDocRuleOption.enabled;
livedoc.options.rules.backgroundMustOnlyIncludeGiven = LiveDocRuleOption.enabled;
livedoc.options.rules.enforceTitle = LiveDocRuleOption.enabled;
livedoc.options.rules.enforceUsingGivenOverBefore = LiveDocRuleOption.warning;
livedoc.options.rules.mustIncludeGiven = LiveDocRuleOption.warning;
livedoc.options.rules.mustIncludeWhen = LiveDocRuleOption.warning;
livedoc.options.rules.mustIncludeThen = LiveDocRuleOption.warning;

// Tracking displayed violations to avoid duplicates
const displayedViolations: Record<string, boolean> = {};



/**
 * Check if any of the tags are in the exclude filter list
 */
function markedAsExcluded(tags: string[]): boolean {
    if (tags.length === 0 || !livedoc.options.filters.exclude) {
        return false;
    }

    for (const tag of tags) {
        if (livedoc.options.filters.exclude.includes(tag)) {
            return true;
        }
    }

    return false;
}

/**
 * Check if any of the tags are in the include filter list
 */
function markedAsIncluded(tags: string[]): boolean {
    if (tags.length === 0 || !livedoc.options.filters.include || livedoc.options.filters.include.length === 0) {
        return false;
    }

    for (const tag of tags) {
        if (livedoc.options.filters.include.includes(tag)) {
            return true;
        }
    }

    return false;
}

/**
 * Check if tags should mark test as pending (excluded)
 * Returns true only if excluded AND NOT included (unless showFilterConflicts is true)
 */
function shouldMarkAsPending(tags: string[]): boolean {
    return markedAsExcluded(tags) && (!markedAsIncluded(tags) || !!livedoc.options.filters.showFilterConflicts);
}

/**
 * Check if tags should mark test as only to run (included)
 * Returns true only if included AND NOT excluded (unless showFilterConflicts is true)
 */
function shouldInclude(tags: string[]): boolean {
    if (tags.length === 0) {
        return false;
    }

    return markedAsIncluded(tags) && (!markedAsExcluded(tags) || !!livedoc.options.filters.showFilterConflicts);
}

function displayRuleViolation(violation: LiveDocRuleViolation, filename: string) {
    if (displayedViolations[violation.errorId]) {
        return;
    }

    const ruleName = RuleViolations[violation.rule];
    const option = (livedoc.options.rules as any)[ruleName];
    const outputMessage = `${violation.message} [title: ${violation.title}, file: ${filename}]`;

    if (option === LiveDocRuleOption.warning) {
        displayedViolations[violation.errorId] = true;
        console.error(chalk.bgYellow.red(`WARNING[${violation.errorId}]: ${outputMessage}`));
    } else if (option === LiveDocRuleOption.enabled) {
        // Capture the exception for serialization before throwing
        if (isDynamicExecution) {
            capturedThrownException = {
                type: 'LiveDocRuleViolation',
                message: violation.message,
                data: violation.toJSON()
            };
        }
        throw violation;
    }
}

function displayWarnings(filename: string) {
    if (currentScenario) {
        currentScenario.ruleViolations.forEach(v => displayRuleViolation(v, filename));
    }
    if (currentFeature) {
        currentFeature.ruleViolations.forEach(v => displayRuleViolation(v, filename));
    }
    if (currentStep) {
        currentStep.ruleViolations.forEach(v => displayRuleViolation(v, filename));
    }
}

/**
 * Internal feature implementation
 */
function featureImpl(title: string, fn: (ctx: any) => void | Promise<void>, opts: { pending?: boolean; isOnly?: boolean } = {}) {
    const filename = getFilenameFromStack(3); // Extra stack frame due to wrapper

    // Check if callback is async BEFORE calling vitest's describe
    // This ensures the exception is thrown before vitest gets control
    if (fn.constructor.name === 'AsyncFunction') {
        throw new model.ParserException(`The async keyword is not supported for Feature`, title, filename);
    }

    // Create feature immediately during registration phase
    const thisFeature = parser.createFeature(title, filename);
    currentFeature = thisFeature;
    scenarioCount = 0;
    // Initialize per-feature state in maps
    backgroundStepsMap.set(thisFeature, []);
    backgroundItExecutedMap.set(thisFeature, false);
    // Note: afterBackgroundFnMap is per-feature, no need to reset here

    // Generate feature ID (matching Mocha behavior)
    (thisFeature as any).generateId(thisFeature);

    // Register feature (note: not used by reporter, which reconstructs from Vitest task tree)
    // Also validate uniqueness
    (thisFeature as any).validateIdUniqueness(thisFeature.id, featureRegistry);
    featureRegistry.push(thisFeature);

    // Check if feature should be skipped based on tags or explicit skip
    const shouldSkip = opts.pending || shouldMarkAsPending(thisFeature.tags);
    const shouldOnlyRun = opts.isOnly || shouldInclude(thisFeature.tags);

    const describeFunc = shouldSkip ? vitestDescribe.skip : shouldOnlyRun ? vitestDescribe.only : vitestDescribe;

    describeFunc(thisFeature.displayTitle, () => {
        // Restore currentFeature for this describe's callback
        // This ensures scenarios are added to the correct feature
        currentFeature = thisFeature;
        
        // Track pending context for steps
        const previousPendingContext = isPendingContext;
        const previousFilteredContext = isFilteredContext;
        
        // When we skip, we need to track WHY we're skipping:
        // - If skipping due to exclude filter (shouldMarkAsPending=true), steps should be 'pending'
        // - If skipping due to parent being in a filter conflict state, steps should stay 'unknown'
        // - If explicit .skip(), steps should be 'pending'
        if (shouldSkip) {
            isPendingContext = true;
            // Inherit filter context from parent (already captured before describeFunc)
        }
        
        const ctx = {
            get feature() {
                return thisFeature?.getFeatureContext();
            },
        };

        fn(ctx);
        
        // Restore contexts
        isPendingContext = previousPendingContext;
        isFilteredContext = previousFilteredContext;
    });
}

/**
 * Feature keyword - creates a new Gherkin feature
 */
export const feature = Object.assign(
    function feature(title: string, fn: (ctx: any) => void) {
        featureImpl(title, fn);
    },
    {
        skip: function skip(title: string, fn: (ctx: any) => void) {
            featureImpl(title, fn, { pending: true });
        },
        only: function only(title: string, fn: (ctx: any) => void) {
            featureImpl(title, fn, { isOnly: true });
        }
    }
);

/**
 * Internal scenario implementation
 */
function scenarioImpl(title: string, fn: (ctx: any) => void | Promise<void>, opts: { pending?: boolean; isOnly?: boolean } = {}) {
    if (!currentFeature) {
        throw new model.ParserException("Scenario must be within a feature.", title, "");
    }

    const filename = getFilenameFromStack(3);
    
    // Check if callback is async BEFORE calling vitest's describe
    if (fn.constructor.name === 'AsyncFunction') {
        throw new model.ParserException(`The async keyword is not supported for Scenario`, title, filename);
    }

    const scenarioModel = parser.addScenario(currentFeature, title);
    scenarioCount++;
    const thisScenarioId = scenarioCount;

    // Check if scenario should be skipped based on tags or explicit skip
    const shouldSkip = opts.pending || isPendingContext || shouldMarkAsPending(scenarioModel.tags);
    const shouldOnlyRun = opts.isOnly || shouldInclude(scenarioModel.tags);
    
    // Capture parent's filter context BEFORE describe callback is queued
    // This is needed because parent will restore its context after this returns
    const isInheritedFilter = isFilteredContext;

    const describeFunc = shouldSkip ? vitestDescribe.skip : shouldOnlyRun ? vitestDescribe.only : vitestDescribe;

    describeFunc(scenarioModel.displayTitle, () => {
        // Set current scenario during registration so steps can be added
        const previousScenario = currentScenario;
        currentScenario = scenarioModel;
        
        // Track pending context for steps
        const previousPendingContext = isPendingContext;
        const previousFilteredContext = isFilteredContext;
        
        // Set isPendingContext for skipped scenarios
        // Only propagate isFilteredContext if inherited from parent (not if this scenario is excluded)
        // When a scenario is excluded by filter, steps should be 'pending', not 'unknown'
        if (shouldSkip) {
            isPendingContext = true;
            // Only inherit filter context from parent - don't set it just because we're excluded
            if (isInheritedFilter) {
                isFilteredContext = true;
            }
        }

        beforeAll(async () => {
            scenarioId = thisScenarioId;
            backgroundStepsComplete = false;
        });

        afterAll(async () => {
            // Lookup afterBackground for THIS scenario's feature (captured at registration)
            const featureForScenario = scenarioModel.parent as model.Feature;
            const afterBackgroundFn = featureForScenario ? afterBackgroundFnMap.get(featureForScenario) : null;
            if (afterBackgroundFn) {
                const hookStep = parser.createStep("hook", "afterBackground", undefined);
                // Use scenarioModel (captured at registration) not currentScenario (global that may have changed)
                scenarioModel.addStep(hookStep);
                currentStep = hookStep;
                const startTime = Date.now();
                try {
                    await afterBackgroundFn();
                    hookStep.setStatus(model.SpecStatus.pass, Date.now() - startTime);
                } catch (error: any) {
                    const duration = Date.now() - startTime;
                    hookStep.setStatus(model.SpecStatus.fail, duration);
                    const exception = new model.Exception();
                    exception.message = error.message || String(error);
                    exception.stackTrace = error.stack || '';
                    hookStep.exception = exception;
                    throw error;
                }
            }
        });

        const ctx = {
            get feature() {
                return currentFeature?.getFeatureContext();
            },
            get scenario() {
                return scenarioModel.getScenarioContext();
            },
        };

        fn(ctx);

        // Restore contexts
        isPendingContext = previousPendingContext;
        isFilteredContext = previousFilteredContext;
        
        // Restore previous scenario after registration
        currentScenario = previousScenario;
    });
}

/**
 * Scenario keyword - creates a new test scenario
 */
export const scenario = Object.assign(
    function scenario(title: string, fn: (ctx: any) => void | Promise<void>) {
        scenarioImpl(title, fn);
    },
    {
        skip: function skip(title: string, fn: (ctx: any) => void | Promise<void>) {
            scenarioImpl(title, fn, { pending: true });
        },
        only: function only(title: string, fn: (ctx: any) => void | Promise<void>) {
            scenarioImpl(title, fn, { isOnly: true });
        }
    }
);

/**
 * Internal background implementation
 */
function backgroundImpl(title: string, fn: (ctx: any) => void | Promise<void>, opts: { pending?: boolean; isOnly?: boolean } = {}) {
    if (!currentFeature) {
        throw new model.ParserException("Background must be within a feature.", title, "");
    }

    const filename = getFilenameFromStack(3);
    
    // Check if callback is async BEFORE calling vitest's describe
    if (fn.constructor.name === 'AsyncFunction') {
        throw new model.ParserException(`The async keyword is not supported for Background`, title, filename);
    }

    const backgroundModel = parser.addBackground(currentFeature, title);

    // Check if background should be skipped based on explicit skip
    const describeFunc = opts.pending ? vitestDescribe.skip : opts.isOnly ? vitestDescribe.only : vitestDescribe;

    describeFunc(backgroundModel.displayTitle, () => {
        // Set current background during registration
        const previousBackground = currentBackground;
        currentBackground = backgroundModel;
        
        // Capture the feature at registration time for proper isolation
        const featureForBackground = currentFeature;
        
        // Initialize/reset per-feature background state
        if (featureForBackground) {
            backgroundStepsMap.set(featureForBackground, []);
            backgroundItExecutedMap.set(featureForBackground, false);
        }

        const ctx = {
            get feature() {
                return currentFeature?.getFeatureContext();
            },
            get background() {
                return currentFeature?.getBackgroundContext();
            },
            afterBackground(fn: Function) {
                // Store in map keyed by feature for proper isolation between features
                if (featureForBackground) {
                    afterBackgroundFnMap.set(featureForBackground, fn);
                }
            },
        };

        fn(ctx);

        // Restore previous background
        currentBackground = previousBackground;
    });
}

/**
 * Background keyword - defines steps to run before each scenario
 */
export const background = Object.assign(
    function background(title: string, fn: (ctx: any) => void) {
        backgroundImpl(title, fn);
    },
    {
        skip: function skip(title: string, fn: (ctx: any) => void) {
            backgroundImpl(title, fn, { pending: true });
        },
        only: function only(title: string, fn: (ctx: any) => void) {
            backgroundImpl(title, fn, { isOnly: true });
        }
    }
);

/**
 * afterBackground - called after background steps complete for each scenario
 * Can be used both as a standalone function or via background context
 */
export function afterBackground(fn: Function): void {
    // Store in map keyed by current feature for proper isolation
    if (currentFeature) {
        afterBackgroundFnMap.set(currentFeature, fn);
    }
}

/**
 * Internal scenario outline implementation
 */
function scenarioOutlineImpl(title: string, fn: (ctx: any) => void | Promise<void>, opts: { pending?: boolean; isOnly?: boolean } = {}) {
    if (!currentFeature) {
        throw new model.ParserException("Scenario Outline must be within a feature.", title, "");
    }

    const filename = getFilenameFromStack(3);
    
    // Check if callback is async BEFORE calling vitest's describe
    if (fn.constructor.name === 'AsyncFunction') {
        throw new model.ParserException(`The async keyword is not supported for Scenario Outline`, title, filename);
    }

    const scenarioOutlineModel = parser.addScenarioOutline(currentFeature, title);

    // Check if scenario outline should be skipped based on tags or explicit skip
    const shouldSkip = opts.pending || isPendingContext || shouldMarkAsPending(scenarioOutlineModel.tags);
    const shouldOnlyRun = opts.isOnly || shouldInclude(scenarioOutlineModel.tags);
    
    // Capture parent's filter context BEFORE describe callback is queued
    // This is needed because parent will restore its context after this returns
    const isInheritedFilter = isFilteredContext;

    // Determine the describe function for the parent outline suite
    const outlineDescribeFunc = shouldSkip ? vitestDescribe.skip : shouldOnlyRun ? vitestDescribe.only : vitestDescribe;

    // Create a parent describe for the Scenario Outline itself
    // Use "Scenario:" prefix to match the display format (Scenario Outline shows as Scenario in output)
    outlineDescribeFunc(`Scenario: ${scenarioOutlineModel.title}`, () => {
        // Create a child describe for each example
        for (const example of scenarioOutlineModel.examples) {
            scenarioCount++;
            const thisScenarioId = scenarioCount;

            // Each example is a child describe with example values
            // Use "Example N:" prefix to distinguish from regular scenarios
            // Display the example values as a comma-separated list
            const materializedScenarioTitle = materializePlaceholders(scenarioOutlineModel.title, (example.exampleRaw ?? example.example ?? {}) as Record<string, unknown>);
            const exampleName = `Example ${example.sequence}: ${materializedScenarioTitle}`;

            vitestDescribe(exampleName, () => {
                // Set current scenario during registration so steps can be added
                const previousScenario = currentScenario;
                currentScenario = example as any;  // ScenarioExample is assignable to Scenario for our purposes
                
                // Track pending context for steps
                const previousPendingContext = isPendingContext;
                const previousFilteredContext = isFilteredContext;
                
                // Set isPendingContext for skipped scenarios
                // Only propagate isFilteredContext if inherited from parent (not if this scenario is excluded)
                // When a scenario is excluded by filter, steps should be 'pending', not 'unknown'
                if (shouldSkip) {
                    isPendingContext = true;
                    // Only inherit filter context from parent - don't set it just because we're excluded
                    if (isInheritedFilter) {
                        isFilteredContext = true;
                    }
                }

                beforeAll(() => {
                    scenarioId = thisScenarioId;
                    backgroundStepsComplete = false;
                });

                afterAll(async () => {
                    // Lookup afterBackground for THIS example's feature
                    // Note: ScenarioExample.parent is the Feature directly (not ScenarioOutline)
                    const featureForExample = example.parent as model.Feature;
                    const afterBackgroundFn = featureForExample ? afterBackgroundFnMap.get(featureForExample) : null;
                    if (afterBackgroundFn) {
                        const hookStep = parser.createStep("hook", "afterBackground", undefined);
                        // Use example (captured at registration) not currentScenario (global that may have changed)
                        example.addStep(hookStep);
                        currentStep = hookStep;
                        const startTime = Date.now();
                        try {
                            await afterBackgroundFn();
                            hookStep.setStatus(model.SpecStatus.pass, Date.now() - startTime);
                        } catch (error: any) {
                            const duration = Date.now() - startTime;
                            hookStep.setStatus(model.SpecStatus.fail, duration);
                            const exception = new model.Exception();
                            exception.message = error.message || String(error);
                            exception.stackTrace = error.stack || '';
                            hookStep.exception = exception;
                            throw error;
                        }
                    }
                });

                const ctx = {
                    get feature() {
                        return currentFeature?.getFeatureContext();
                    },
                    get scenario() {
                        return example.getScenarioContext();
                    },
                    get example() {
                        return example.getScenarioContext();
                    },
                };

                fn(ctx);

                // Restore contexts
                isPendingContext = previousPendingContext;
                isFilteredContext = previousFilteredContext;
                
                // Restore previous scenario after registration
                currentScenario = previousScenario;
            });
        }
    });
}

/**
 * Scenario Outline keyword - creates data-driven scenarios
 */
export const scenarioOutline = Object.assign(
    function scenarioOutline(title: string, fn: (ctx: any) => void) {
        scenarioOutlineImpl(title, fn);
    },
    {
        skip: function skip(title: string, fn: (ctx: any) => void) {
            scenarioOutlineImpl(title, fn, { pending: true });
        },
        only: function only(title: string, fn: (ctx: any) => void) {
            scenarioOutlineImpl(title, fn, { isOnly: true });
        }
    }
);

// ============================================
// Specification Pattern Functions
// ============================================

/**
 * Internal specification implementation
 */
function specificationImpl(title: string, fn: (ctx: any) => void | Promise<void>, opts: { pending?: boolean; isOnly?: boolean } = {}) {
    const filename = getFilenameFromStack(3);

    // Create specification immediately during registration phase
    const thisSpecification = parser.createSpecification(title, filename);
    currentSpecification = thisSpecification;
    ruleCount = 0;

    // Generate specification ID
    (thisSpecification as any).generateId(thisSpecification);

    // Register specification and validate uniqueness
    (thisSpecification as any).validateIdUniqueness(thisSpecification.id, specificationRegistry);
    specificationRegistry.push(thisSpecification);

    // Check if specification should be skipped based on tags or explicit skip
    const shouldSkip = opts.pending || shouldMarkAsPending(thisSpecification.tags);
    const shouldOnlyRun = opts.isOnly || shouldInclude(thisSpecification.tags);

    const describeFunc = shouldSkip ? vitestDescribe.skip : shouldOnlyRun ? vitestDescribe.only : vitestDescribe;

    describeFunc(thisSpecification.displayTitle, () => {
        // Restore currentSpecification for this describe's callback
        currentSpecification = thisSpecification;
        
        // Track pending context for rules
        const previousPendingContext = isPendingContext;
        const previousFilteredContext = isFilteredContext;
        
        if (shouldSkip) {
            isPendingContext = true;
        }
        
        const ctx = {
            get specification() {
                return thisSpecification?.getSpecificationContext();
            },
        };

        fn(ctx);
        
        // Restore contexts
        isPendingContext = previousPendingContext;
        isFilteredContext = previousFilteredContext;
    });
}

/**
 * Specification keyword - creates a new specification container
 */
export const specification = Object.assign(
    function specification(title: string, fn: (ctx: any) => void) {
        specificationImpl(title, fn);
    },
    {
        skip: function skip(title: string, fn: (ctx: any) => void) {
            specificationImpl(title, fn, { pending: true });
        },
        only: function only(title: string, fn: (ctx: any) => void) {
            specificationImpl(title, fn, { isOnly: true });
        }
    }
);

/**
 * Internal rule implementation
 */
function ruleImpl(title: string, fn: (ctx: any) => void | Promise<void>, opts: { pending?: boolean; isOnly?: boolean } = {}) {
    if (!currentSpecification) {
        throw new model.ParserException("Rule must be within a specification.", title, "");
    }

    const ruleModel = parser.addRule(currentSpecification, title);
    ruleCount++;

    // Capture the specification at registration time (not execution time)
    const specificationModel = currentSpecification;

    // Check if rule should be skipped based on tags or explicit skip
    const shouldSkip = opts.pending || isPendingContext || shouldMarkAsPending(ruleModel.tags);
    const shouldOnlyRun = opts.isOnly || shouldInclude(ruleModel.tags);

    const ruleMeta = {
        livedoc: {
            kind: "rule",
            rule: {
                title: ruleModel.title,
                description: ruleModel.description ?? "",
                tags: ruleModel.tags ?? [],
            },
        },
    };

    // Rules use a single test task (no step functions)
    const ruleHandler = async () => {
        const ctx = {
            get specification() {
                return specificationModel?.getSpecificationContext();
            },
            get rule() {
                return ruleModel.getRuleContext();
            },
        };

        const startTime = Date.now();
        try {
            await fn(ctx);
            ruleModel.status = model.SpecStatus.pass;
            ruleModel.executionTime = Date.now() - startTime;
        } catch (error: any) {
            ruleModel.status = model.SpecStatus.fail;
            ruleModel.executionTime = Date.now() - startTime;
            ruleModel.error = error;
            (error as any).code = fn.toString();
            throw error;
        }
    };

    const currentSuite = getCurrentSuite() as any;
    if (!currentSuite || typeof currentSuite.task !== "function") {
        throw new Error(
            "LiveDoc requires Vitest suite.task(name, { meta, handler }) to transport metadata to the reporter."
        );
    }

    currentSuite.task(ruleModel.displayTitle, {
        meta: ruleMeta,
        handler: ruleHandler as any,
        skip: shouldSkip,
        only: shouldOnlyRun,
    });
}

/**
 * Rule keyword - creates a simple specification rule
 */
export const rule = Object.assign(
    function rule(title: string, fn: (ctx: any) => void | Promise<void>) {
        ruleImpl(title, fn);
    },
    {
        skip: function skip(title: string, fn: (ctx: any) => void | Promise<void>) {
            ruleImpl(title, fn, { pending: true });
        },
        only: function only(title: string, fn: (ctx: any) => void | Promise<void>) {
            ruleImpl(title, fn, { isOnly: true });
        }
    }
);

/**
 * Internal rule outline implementation
 */
function ruleOutlineImpl(title: string, fn: (ctx: any) => void | Promise<void>, opts: { pending?: boolean; isOnly?: boolean } = {}) {
    if (!currentSpecification) {
        throw new model.ParserException("Rule Outline must be within a specification.", title, "");
    }

    const ruleOutlineModel = parser.addRuleOutline(currentSpecification, title);

    // Check if rule outline should be skipped based on tags or explicit skip
    const shouldSkip = opts.pending || isPendingContext || shouldMarkAsPending(ruleOutlineModel.tags);
    const shouldOnlyRun = opts.isOnly || shouldInclude(ruleOutlineModel.tags);

    // Determine the describe function for the parent outline suite
    const outlineDescribeFunc = shouldSkip ? vitestDescribe.skip : shouldOnlyRun ? vitestDescribe.only : vitestDescribe;

    // Create a parent describe for the Rule Outline itself
    // Capture the specification at registration time (not execution time)
    const specificationModel = currentSpecification;

    outlineDescribeFunc(`Rule Outline: ${ruleOutlineModel.title}`, () => {
        // Create a test for each example
        for (const example of ruleOutlineModel.examples) {
            ruleCount++;

            const exampleValuesRaw = (example.exampleRaw ?? example.example ?? {}) as Record<string, unknown>;
            const materializedRuleTitle = materializePlaceholders(ruleOutlineModel.title, exampleValuesRaw);

            // Make the example behave like a concrete Rule (for ctx.rule and renderers)
            example.title = materializedRuleTitle;
            example.displayTitle = materializedRuleTitle;

            // Child test name is an Example leaf
            const exampleName = `Example ${example.sequence}: ${materializedRuleTitle}`;

            const exampleMeta = {
                livedoc: {
                    kind: "ruleExample",
                    ruleOutline: {
                        title: ruleOutlineModel.title,
                        description: ruleOutlineModel.description ?? "",
                        tables: ruleOutlineModel.tables ?? [],
                        tags: ruleOutlineModel.tags ?? [],
                        example: {
                            sequence: example.sequence,
                            values: (example.example ?? {}) as Record<string, unknown>,
                            valuesRaw: (example.exampleRaw ?? {}) as Record<string, unknown>,
                        },
                    },
                },
            };

            const exampleHandler = async () => {
                const ctx = {
                    get specification() {
                        return specificationModel?.getSpecificationContext();
                    },
                    get rule() {
                        return example.getRuleContext();
                    },
                    get example() {
                        return example.example;
                    },
                };

                const startTime = Date.now();
                try {
                    await fn(ctx);
                    example.status = model.SpecStatus.pass;
                    example.executionTime = Date.now() - startTime;
                } catch (error: any) {
                    example.status = model.SpecStatus.fail;
                    example.executionTime = Date.now() - startTime;
                    example.error = error;
                    (error as any).code = fn.toString();
                    throw error;
                }
            };

            const currentSuite = getCurrentSuite() as any;
            if (!currentSuite || typeof currentSuite.task !== "function") {
                throw new Error(
                    "LiveDoc requires Vitest suite.task(name, { meta, handler }) to transport metadata to the reporter."
                );
            }

            currentSuite.task(exampleName, {
                meta: exampleMeta,
                handler: exampleHandler as any,
            });
        }
    });
}

/**
 * Rule Outline keyword - creates data-driven rules
 */
export const ruleOutline = Object.assign(
    function ruleOutline(title: string, fn: (ctx: any) => void | Promise<void>) {
        ruleOutlineImpl(title, fn);
    },
    {
        skip: function skip(title: string, fn: (ctx: any) => void | Promise<void>) {
            ruleOutlineImpl(title, fn, { pending: true });
        },
        only: function only(title: string, fn: (ctx: any) => void | Promise<void>) {
            ruleOutlineImpl(title, fn, { isOnly: true });
        }
    }
);

/**
 * Helper to create step functions
 */
function createStepFunction(stepType: string) {
    return function (title: string, fn?: (ctx: any) => void | Promise<void>, passedParam?: object | Function) {
        const filename = getFilenameFromStack(2);

        // If no feature, this step is at the top level - give helpful error
        if (!currentFeature) {
            throw new model.ParserException(
                `Invalid Gherkin, ${stepType} can only appear within a Background, Scenario or Scenario Outline`,
                title,
                filename
            );
        }

        const stepDefinition = parser.createStep(stepType, title, passedParam);
        
        // If this step is in a pending context (explicitly skipped with .skip), mark it as pending
        // Note: filter-based exclusions (isFilteredContext) should keep steps as 'unknown'
        if (isPendingContext && !isFilteredContext) {
            stepDefinition.status = model.SpecStatus.pending;
        }

        // Capture context at registration time - these variables will be null at execution time
        const isBackgroundStep = currentBackground !== null;
        const capturedScenario = currentScenario;
        const capturedFeature = currentFeature;

        // Add step to appropriate parent
        if (currentBackground) {
            currentBackground.addStep(stepDefinition);
        } else if (currentScenario) {
            currentScenario.addStep(stepDefinition);
            // For Scenario Outlines, add to outline on first example
            if (currentScenario instanceof model.ScenarioExample && currentScenario.sequence === 1) {
                currentScenario.scenarioOutline.steps.push(stepDefinition);
            }
        } else {
            throw new model.ParserException(
                `Invalid Gherkin, ${stepType} can only appear within a Background, Scenario or Scenario Outline`,
                title,
                filename
            );
        }

        const testName = stepDefinition.displayTitle;

        // For background steps: store the function during registration (not during execution)
        // This ensures background steps are available even when using .only on scenarios
        if (isBackgroundStep && fn && capturedFeature) {
            const featureSteps = backgroundStepsMap.get(capturedFeature) || [];
            featureSteps.push({ func: fn, stepDefinition });
            backgroundStepsMap.set(capturedFeature, featureSteps);
        }

        const taskMeta: Record<string, unknown> = {
            livedoc: {
                kind: "step",
                step: {
                    rawTitle: stepDefinition.rawTitle,
                    type: stepDefinition.type,
                },
                ...(capturedScenario instanceof model.ScenarioExample
                    ? {
                          scenarioOutline: {
                              title: capturedScenario.scenarioOutline?.title,
                              description: capturedScenario.scenarioOutline?.description ?? "",
                              tables: capturedScenario.scenarioOutline?.tables ?? [],
                              tags: capturedScenario.scenarioOutline?.tags ?? [],
                              example: {
                                  sequence: capturedScenario.sequence,
                                  values: capturedScenario.example ?? {},
                              },
                          },
                      }
                    : {}),
            },
        };

        const stepHandler = async () => {
            const startTime = Date.now();
            currentStep = stepDefinition;
            displayWarnings(filename);

            // Apply passed params
            parser.applyPassedParams(stepDefinition);

            try {
                // Handle step execution based on context (matching Mocha behavior)
                if (isBackgroundStep) {
                    // For background steps: execute during background's it() (first scenario only)
                    // The function was already stored in backgroundSteps during registration
                    // Mark that background's it() tests are executing
                    if (capturedFeature) {
                        backgroundItExecutedMap.set(capturedFeature, true);
                    }
                    if (fn) {
                        currentStep = stepDefinition;
                        const ctx = {
                            get feature() {
                                return capturedFeature?.getFeatureContext();
                            },
                            get background() {
                                return capturedFeature?.getBackgroundContext();
                            },
                            get step() {
                                return stepDefinition.getStepContext();
                            },
                        };
                        const result = fn(ctx);
                        if (result && typeof result.then === "function") {
                            await result;
                        }
                    }
                } else if (capturedScenario) {
                    // For scenario steps: Re-execute stored background steps before first step
                    // - For first scenario: Skip re-execution if background's it() already ran (backgroundItExecuted)
                    // - For subsequent scenarios: Always re-execute
                    // - For .only scenarios: Re-execute because background's it() didn't run (!backgroundItExecuted)
                    const backgroundItExecuted = capturedFeature ? backgroundItExecutedMap.get(capturedFeature) ?? false : false;
                    const backgroundSteps = capturedFeature ? backgroundStepsMap.get(capturedFeature) ?? [] : [];
                    const shouldReExecuteBackground = !backgroundItExecuted || scenarioId > 1;
                    if (shouldReExecuteBackground && backgroundSteps.length > 0 && !backgroundStepsComplete) {
                        backgroundStepsComplete = true;
                        for (const stepDetail of backgroundSteps) {
                            currentStep = stepDetail.stepDefinition;
                            // Apply passed params to background step before execution
                            parser.applyPassedParams(stepDetail.stepDefinition);
                            const bgStartTime = Date.now();
                            try {
                                const result = stepDetail.func({
                                    get feature() {
                                        return capturedFeature?.getFeatureContext();
                                    },
                                    get background() {
                                        return capturedFeature?.getBackgroundContext();
                                    },
                                    get step() {
                                        return stepDetail.stepDefinition.getStepContext();
                                    },
                                });
                                if (result && typeof result.then === "function") {
                                    await result;
                                }
                                // Mark background step as passed
                                stepDetail.stepDefinition.setStatus(model.SpecStatus.pass, Date.now() - bgStartTime);
                            } catch (error: any) {
                                // Mark background step as failed
                                stepDetail.stepDefinition.setStatus(model.SpecStatus.fail, Date.now() - bgStartTime);
                                const exception = new model.Exception();
                                exception.message = error.message || String(error);
                                exception.stackTrace = error.stack || '';
                                stepDetail.stepDefinition.exception = exception;
                                if (stepDetail.func) {
                                    stepDetail.stepDefinition.code = stepDetail.func.toString();
                                }
                                throw error;
                            }
                        }
                    }

                    // Execute the step function
                    if (fn) {
                        currentStep = stepDefinition;
                        const ctx = {
                            get feature() {
                                return capturedFeature?.getFeatureContext();
                            },
                            get scenario() {
                                return capturedScenario?.getScenarioContext();
                            },
                            get step() {
                                return stepDefinition.getStepContext();
                            },
                            get example() {
                                return capturedScenario instanceof model.ScenarioExample
                                    ? capturedScenario.example
                                    : undefined;
                            },
                            get background() {
                                return capturedFeature?.getBackgroundContext();
                            },
                        };

                        const result = fn(ctx);
                        if (result && typeof result.then === "function") {
                            await result;
                        }
                    }
                }
                
                // Mark step as passed
                const duration = Date.now() - startTime;
                stepDefinition.setStatus(model.SpecStatus.pass, duration);
            } catch (error: any) {
                // Mark step as failed and capture exception details
                const duration = Date.now() - startTime;
                stepDefinition.setStatus(model.SpecStatus.fail, duration);
                const exception = new model.Exception();
                exception.message = error.message || String(error);
                exception.stackTrace = error.stack || '';
                exception.actual = error.actual || '';
                exception.expected = error.expected || '';
                stepDefinition.exception = exception;
                if (fn) {
                    stepDefinition.code = fn.toString();
                    // Attach code to error so it can be retrieved by the reporter
                    if (typeof error === 'object' && error !== null) {
                        (error as any).code = stepDefinition.code;
                    }
                }
                // Re-throw so Vitest marks the test as failed
                throw error;
            }
        };

        const currentSuite = getCurrentSuite() as any;
        if (!currentSuite || typeof currentSuite.task !== "function") {
            throw new Error(
                "LiveDoc requires Vitest suite.task(name, { meta, handler }) to transport metadata to the reporter."
            );
        }

        currentSuite.task(testName, {
            meta: taskMeta,
            handler: stepHandler as any,
        });
    };
}

/**
 * given keyword - preconditions
 */
export const given = createStepFunction("given");

/**
 * when keyword - actions
 */
export const when = createStepFunction("when");

/**
 * Then keyword - assertions
 * NOTE: Uppercase 'Then' is required due to ESM thenable detection.
 * If a module exports 'then', Node.js treats it as a Promise-like object.
 * Users who prefer lowercase can use: import { Then as then } from '@livedoc/vitest'
 * Or use globals mode where lowercase 'then' is available.
 */
export const Then = createStepFunction("then");

/**
 * and keyword - continuation
 */
export const and = createStepFunction("and");

/**
 * but keyword - continuation with contrast
 */
export const but = createStepFunction("but");

/**
 * before - wrapper for Vitest's beforeAll that triggers rule violation when used inside LiveDoc context
 * Users should use 'given' instead of 'before' for better readability
 */
export function before(fn: Function): void {
    // Check if we're inside a LiveDoc scenario context
    if (currentScenario && livedoc.options.rules.enforceUsingGivenOverBefore !== LiveDocRuleOption.disabled) {
        const violation = new LiveDocRuleViolation(
            RuleViolations.enforceUsingGivenOverBefore,
            "Using before does not help with readability, consider using a given instead.",
            "before"
        );
        currentScenario.ruleViolations.push(violation);
    }
    // Still call the actual beforeAll
    beforeAll(fn as any);
}

// Lowercase step keywords are used for idiomatic JavaScript
// With ESM imports, there's no conflict with Promise.then()

/**
 * BDD mixing detection - throws an error when 'it' is used inside a LiveDoc feature/scenario
 * This helps users who accidentally mix BDD and Gherkin syntax
 */
function livedocItImpl(title: string, fn?: Function) {
    const filename = getFilenameFromStack(3);

    // Check if we're inside a Feature or Scenario context
    if (currentFeature) {
        if (currentScenario) {
            throw new model.ParserException(
                `This Scenario is using bdd syntax, did you mean to use given instead?`,
                title,
                filename
            );
        } else {
            throw new model.ParserException(
                `This Feature is using bdd syntax, did you mean to use given instead?`,
                title,
                filename
            );
        }
    }
    
    // If not inside a LiveDoc context, delegate to vitest's it
    return vitestIt(title, fn as any);
}

/**
 * Exported 'it' function with .skip and .only support
 */
export const livedocIt = Object.assign(
    function it(title: string, fn?: Function) {
        return livedocItImpl(title, fn);
    },
    {
        skip: function skip(title: string, fn?: Function) {
            return vitestIt.skip(title, fn as any);
        },
        only: function only(title: string, fn?: Function) {
            return vitestIt.only(title, fn as any);
        }
    }
);

/**
 * BDD mixing detection - throws an error when 'describe' is used inside a LiveDoc feature/scenario
 * This helps users who accidentally mix BDD and Gherkin syntax
 */
function livedocDescribeImpl(title: string, fn?: Function) {
    const filename = getFilenameFromStack(3);

    // Check if callback is async BEFORE calling vitest's describe
    if (fn && fn.constructor.name === 'AsyncFunction') {
        throw new model.ParserException(`The async keyword is not supported for describe`, title, filename);
    }

    // Check if we're inside a Feature or Scenario context
    if (currentFeature) {
        if (currentScenario) {
            throw new model.ParserException(
                `This Scenario is using bdd syntax, did you mean to use scenario instead?`,
                title,
                filename
            );
        } else {
            throw new model.ParserException(
                `This Feature is using bdd syntax, did you mean to use scenario instead?`,
                title,
                filename
            );
        }
    }
    
    // If not inside a LiveDoc context, delegate to vitest's describe
    return vitestDescribe(title, fn as any);
}

/**
 * Exported 'describe' function with .skip and .only support
 */
export const livedocDescribe = Object.assign(
    function describe(title: string, fn?: Function) {
        return livedocDescribeImpl(title, fn);
    },
    {
        skip: function skip(title: string, fn?: Function) {
            return vitestDescribe.skip(title, fn as any);
        },
        only: function only(title: string, fn?: Function) {
            return vitestDescribe.only(title, fn as any);
        }
    }
);

// Export as 'it', 'test', and 'describe' for user code that mixes BDD and Gherkin
// 'test' is an alias for 'it' (matching Vitest behavior)
export { livedocIt as it, livedocIt as test, livedocDescribe as describe };

/**
 * LiveDoc class for programmatic test execution
 * Provides utilities for running tests dynamically
 */
export class LiveDoc {
    constructor() {
        this.recommendedRuleSettings();
    }

    public options: LiveDocOptions = new LiveDocOptions();

    public shouldMarkAsPending(tags: string[]): boolean {
        return this.markedAsExcluded(tags) && (!this.markedAsIncluded(tags) || (this.options.filters.showFilterConflicts ?? false));
    }

    public shouldInclude(tags: string[]): boolean {
        if (tags.length === 0) {
            return false;
        }

        return this.markedAsIncluded(tags) && (!this.markedAsExcluded(tags) || (this.options.filters.showFilterConflicts ?? false));
    }

    public markedAsExcluded(tags: string[]): boolean {
        if (tags.length === 0 || !this.options.filters.exclude) {
            return false;
        }

        for (let i = 0; i < this.options.filters.exclude.length; i++) {
            if (tags.indexOf(this.options.filters.exclude[i]) > -1) {
                return true;
            }
        }

        return false;
    }

    public markedAsIncluded(tags: string[]): boolean {
        if (tags.length === 0 || !this.options.filters.include) {
            return false;
        }

        for (let i = 0; i < this.options.filters.include.length; i++) {
            if (tags.indexOf(this.options.filters.include[i]) > -1) {
                return true;
            }
        }

        return false;
    }

    public recommendedRuleSettings() {
        const warning = LiveDocRuleOption.warning;
        const enabled = LiveDocRuleOption.enabled;

        this.options.rules.singleGivenWhenThen = enabled;
        this.options.rules.backgroundMustOnlyIncludeGiven = enabled;
        this.options.rules.enforceTitle = enabled;
        this.options.rules.enforceUsingGivenOverBefore = warning;
        this.options.rules.mustIncludeGiven = warning;
        this.options.rules.mustIncludeWhen = warning;
        this.options.rules.mustIncludeThen = warning;
    }

    /**
     * Execute tests from a feature string dynamically
     * This is implemented using Vitest's programmatic API
     * 
     * @param feature Feature code as string (Gherkin-style test code)
     * @param _livedocOptions LiveDoc configuration options (currently unused, for API compatibility)
     * @param testTimeoutMs Per-test timeout for dynamic execution (defaults to 10 seconds)
     * @returns Promise resolving to execution results
     */
    public static async executeDynamicTestAsync(
        feature: string,
        _livedocOptions?: LiveDocOptions,
        testTimeoutMs: number = 10_000
    ): Promise<model.ExecutionResults> {
        const fs = await import('fs');
        const crypto = await import('crypto');
        const path = await import('path');
        const { startVitest } = await import('vitest/node');

        let filename: string = '';
        let errorFile: string = '';
        let resultsFile: string = '';
        const tempFolder = "_temp";
        
        // Trace helper for debugging - disabled in production
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const execTrace = (_loc: string, _data: any) => {
            // Disabled - was used for debugging double module load issue
        };

        try {
            if (feature.length === 0) {
                throw new Error("feature is empty!");
            }

            // Clear and enable dynamic execution mode
            featureRegistry.length = 0;
            suiteRegistry.length = 0;
            isDynamicExecution = true;

            // Create temp directory
            if (!fs.existsSync(tempFolder)) {
                fs.mkdirSync(tempFolder);
            }

            // Generate unique filename with random value
            const randomValue = crypto.randomBytes(4).readUInt32LE(0);
            filename = path.join(tempFolder, `livedoc${randomValue}.Spec.ts`);
            
            // Use unique error/results files based on the random value to avoid conflicts
            errorFile = path.join(tempFolder, `vitest-error-${randomValue}.json`);
            resultsFile = path.join(tempFolder, `vitest-results-${randomValue}.json`);
            
            // Clear any previous error/results files (shouldn't exist with unique names, but just in case)
            if (fs.existsSync(errorFile)) {
                fs.unlinkSync(errorFile);
            }
            if (fs.existsSync(resultsFile)) {
                fs.unlinkSync(resultsFile);
            }

            // Get the absolute path to livedoc module
            // Use __dirname_esm which is properly computed from import.meta.url for ES modules
            const livedocPath = path.resolve(__dirname_esm, 'livedoc').replace(/\\/g, '/');
            const errorFilePath = path.resolve(errorFile).replace(/\\/g, '/');

            // Strip import statements from the feature code since we provide our own imports
            // The user's feature code may have imports like:
            //   import { scenario } from './livedoc';
            // We need to remove these and use our centralized imports
            const strippedFeature = feature
                .split('\n')
                .filter((line: string) => !line.trim().startsWith('import '))
                .join('\n');

            // Serialize the options to pass to the subprocess
            const serializedOptions = JSON.stringify({
                rules: _livedocOptions?.rules,
                filters: _livedocOptions?.filters
            });
            
            // Debug: trace the options being serialized
            execTrace('EXEC_DYNAMIC_SERIALIZING_OPTIONS', {
                hasLivedocOptions: !!_livedocOptions,
                hasRules: !!_livedocOptions?.rules,
                rulesType: typeof _livedocOptions?.rules,
                rulesValue: _livedocOptions?.rules ? JSON.stringify(_livedocOptions.rules) : 'undefined',
                serializedOptions
            });

            // Wrap the content with our imports and error capturing
            // The results file writing is handled by the livedoc module itself
            // when it detects the LIVEDOC_DYNAMIC_RESULTS_FILE env var
            const wrappedContent = `
import { feature, scenario, scenarioOutline, background, afterBackground, before, given, when, Then as then, and, but, it, test, describe, livedoc } from "${livedocPath}";
import { writeFileSync } from 'fs';
import * as chai from 'chai';
chai.should();

// Apply passed-in options
const _dynamicOptions = ${serializedOptions};
if (_dynamicOptions.rules) {
    Object.assign(livedoc.options.rules, _dynamicOptions.rules);
}
if (_dynamicOptions.filters) {
    Object.assign(livedoc.options.filters, _dynamicOptions.filters);
}

// Execute the user's feature code with error capturing
(() => {
    try {
${strippedFeature.split('\n').map((line: string) => '        ' + line).join('\n')}
    } catch (e: any) {
        // Write error to file for parent process to read
        const errorData = {
            message: e.message || String(e),
            description: e.description || '',
            title: e.title || '',
            name: e.name || 'Error'
        };
        writeFileSync('${errorFilePath}', JSON.stringify(errorData));
        throw e;
    }
})();
`;

            fs.writeFileSync(filename, wrappedContent);

            // Create a reporter instance to capture errors
            const silentReporter = new SilentReporter();
            
            // Get absolute path for the temp file
            const absoluteFilename = path.resolve(filename);
            
            // Set environment variable so livedoc.ts knows to write results
            const absoluteResultsPath = path.resolve(resultsFile);
            
            execTrace('EXEC_DYNAMIC_BEFORE_ENV_SET', { 
                absoluteResultsPath,
                absoluteFilename,
                currentEnvValue: process.env.LIVEDOC_DYNAMIC_RESULTS_FILE || 'NOT_SET'
            });
            
            process.env.LIVEDOC_DYNAMIC_RESULTS_FILE = absoluteResultsPath;
            
            execTrace('EXEC_DYNAMIC_ENV_SET', { 
                newEnvValue: process.env.LIVEDOC_DYNAMIC_RESULTS_FILE 
            });
            
            // Run the test file using Vitest's programmatic API
            // Override include pattern to ensure our temp file is found
            // IMPORTANT: Disable setupFiles to prevent double module loading!
            // The temp file already imports everything it needs from livedoc.
            // If we also load setup.js (which imports from dist/app/livedoc.js),
            // we'd have two separate module instances with separate state.
            execTrace('EXEC_DYNAMIC_STARTING_VITEST', { absoluteFilename });
            
            const vitest = await startVitest('test', [absoluteFilename], {
                watch: false,
                reporters: [silentReporter],
                run: true,
                include: [absoluteFilename.replace(/\\/g, '/')],  // Override include pattern
                setupFiles: [],  // Disable setup files - temp file has its own imports
                testTimeout: testTimeoutMs,
            });

            if (!vitest) {
                // Clean up env var
                delete process.env.LIVEDOC_DYNAMIC_RESULTS_FILE;
                throw new Error('Failed to start Vitest');
            }
            
            // Get files from vitest state before closing - this has the complete task tree
            const vitestFiles = vitest.state?.getFiles?.() || [];
            
            // Check for file-level errors (e.g., duplicate names)
            for (const file of vitestFiles) {
                if (file.result?.errors && file.result.errors.length > 0) {
                    const firstError = file.result.errors[0] as Error;
                    silentReporter.collectedErrors.push(firstError);
                }
            }
            
            await vitest.close();
            
            // Clean up env var
            delete process.env.LIVEDOC_DYNAMIC_RESULTS_FILE;
            
            // Small delay to ensure file is written (subprocess may still be writing)
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Check if error file was created (error during module loading)
            if (fs.existsSync(errorFile)) {
                const errorData = JSON.parse(fs.readFileSync(errorFile, 'utf8'));
                // Delete error file
                fs.unlinkSync(errorFile);
                // Throw as ParserException
                throw new model.ParserException(
                    errorData.description || errorData.message,
                    errorData.title || '',
                    filename
                );
            }
            
            // Check if reporter captured any errors
            if (silentReporter.collectedErrors.length > 0) {
                const error = silentReporter.collectedErrors[0] as any;
                // Use description property if available (for ParserException), otherwise use message
                const description = error.description || error.message || String(error);
                const title = error.title || '';
                throw new model.ParserException(description, title, filename);
            }

            // Read execution results from the file written by the subprocess
            const results = new model.ExecutionResults();
            
            execTrace('EXEC_DYNAMIC_READ_RESULTS_START', { 
                resultsFile,
                fileExists: fs.existsSync(resultsFile)
            });
            
            if (fs.existsSync(resultsFile)) {
                const fileContent = fs.readFileSync(resultsFile, 'utf8');
                
                execTrace('EXEC_DYNAMIC_FILE_READ', {
                    bytes: fileContent.length,
                    containsThrownException: fileContent.includes('thrownException'),
                    last200chars: fileContent.slice(-200)
                });
                
                const resultsData = JSON.parse(fileContent);
                
                execTrace('EXEC_DYNAMIC_PARSED', {
                    hasThrownException: !!resultsData.thrownException,
                    thrownExceptionType: resultsData.thrownException?.type,
                    thrownExceptionMsg: resultsData.thrownException?.message?.substring(0, 50),
                    featureCount: resultsData.features?.length || 0
                });
                
                // Reconstruct Feature objects from JSON
                if (resultsData.features && Array.isArray(resultsData.features)) {
                    for (const featureData of resultsData.features) {
                        const feature = this.reconstructFeature(featureData);
                        results.addFeature(feature);
                    }
                }
                
                // Reconstruct VitestSuite objects from JSON
                if (resultsData.suites && Array.isArray(resultsData.suites)) {
                    for (const suiteData of resultsData.suites) {
                        const suite = this.reconstructSuite(suiteData);
                        results.addSuite(suite);
                    }
                }
                
                // Check for any exception that was thrown and captured
                if (resultsData.thrownException) {
                    results.thrownException = resultsData.thrownException;
                    execTrace('EXEC_DYNAMIC_EXCEPTION_LOADED', { 
                        thrownException: resultsData.thrownException 
                    });
                }
            } else {
                execTrace('EXEC_DYNAMIC_NO_RESULTS_FILE', { resultsFile });
            }

            // Build VitestSuites from the task tree for native describe/it blocks
            // These are not tracked in suiteRegistry, so we need to extract them from the vitest task tree
            for (const file of vitestFiles) {
                // Check if there are any root-level tests (not wrapped in describe blocks)
                const rootTests: any[] = [];
                
                for (const task of (file.tasks || [])) {
                    if (task.type === 'suite') {
                        // Skip BDD suites (Feature:, Specification:) - they're already in featureRegistry
                        if (!task.name.startsWith('Feature:') && !task.name.startsWith('Specification:')) {
                            const suite = this.buildSuiteFromTask(task, file.filepath);
                            results.addSuite(suite);
                        }
                    } else if (task.type === 'test') {
                        // Root-level test - will be added to a root suite below
                        rootTests.push(task);
                    }
                }
                
                // If there are root-level tests, create a root suite to contain them
                if (rootTests.length > 0) {
                    const rootSuite = new model.VitestSuite(null, '', 'suite');
                    rootSuite.filename = file.filepath;
                    
                    for (const testTask of rootTests) {
                        const test = this.buildTestFromTask(testTask, rootSuite);
                        rootSuite.tests.push(test);
                        rootSuite.statistics.updateStats(test.status, test.duration);
                    }
                    
                    results.addSuite(rootSuite);
                }
            }

            // Re-throw any captured exception from the subprocess
            execTrace('EXEC_DYNAMIC_RETHROW_CHECK', {
                hasThrownException: !!results.thrownException,
                type: results.thrownException?.type
            });
            
            if (results.thrownException) {
                execTrace('EXEC_DYNAMIC_RETHROWING', { 
                    type: results.thrownException.type,
                    message: results.thrownException.message
                });
                
                if (results.thrownException.type === 'LiveDocRuleViolation' && results.thrownException.data) {
                    throw this.reconstructRuleViolation(results.thrownException.data);
                } else {
                    throw new Error(results.thrownException.message);
                }
            }
            
            execTrace('EXEC_DYNAMIC_RETURNING_RESULTS', { 
                featureCount: results.features.length 
            });

            return results;

        } finally {
            // Disable dynamic execution mode
            isDynamicExecution = false;
            
            // Clean up temp file - DISABLED FOR DEBUGGING
            // if (filename && fs.existsSync(filename)) {
            //     fs.unlinkSync(filename);
            // }
        }
    }
    
    /**
     * Reconstruct a Feature object from JSON data
     */
    private static reconstructFeature(data: any): model.Feature {
        const feature = new model.Feature();
        feature.title = data.title || '';
        feature.description = data.description || '';
        feature.tags = data.tags || [];
        feature.filename = data.filename || '';
        feature.id = data.id || '';
        feature.executionTime = data.executionTime || data.duration || 0;
        
        // Reconstruct background if present
        if (data.background) {
            feature.background = this.reconstructBackground(data.background, feature);
        }
        
        // Reconstruct scenarios
        if (data.scenarios && Array.isArray(data.scenarios)) {
            for (const scenarioData of data.scenarios) {
                const scenario = this.reconstructScenario(scenarioData, feature);
                feature.scenarios.push(scenario);
            }
        }
        
        // Reconstruct ruleViolations if present
        if (data.ruleViolations && Array.isArray(data.ruleViolations)) {
            feature.ruleViolations = data.ruleViolations.map((v: any) => 
                this.reconstructRuleViolation(v)
            );
        }
        
        // Copy statistics if present
        if (data.statistics) {
            Object.assign(feature.statistics, data.statistics);
        }
        
        return feature;
    }
    
    /**
     * Reconstruct a Background object from JSON data
     */
    private static reconstructBackground(data: any, parent: model.Feature): model.Background {
        const background = new model.Background(parent);
        background.title = data.title || '';
        background.description = data.description || '';
        background.id = data.id || '';
        
        // Reconstruct steps (Background stores all steps as givens internally)
        if (data.steps && Array.isArray(data.steps)) {
            for (const stepData of data.steps) {
                const step = this.reconstructStep(stepData, background);
                background.steps.push(step);
                if (step.type === 'given' || step.type === 'and' || step.type === 'but') {
                    background.givens.push(step);
                }
            }
        }
        
        return background;
    }
    
    /**
     * Reconstruct a Scenario object from JSON data
     * Handles both Scenario and ScenarioOutline types
     */
    private static reconstructScenario(data: any, parent: model.Feature): model.Scenario {
        // Check if this is a ScenarioOutline
        const isOutline = data.type === 'ScenarioOutline';
        const scenario = isOutline 
            ? new model.ScenarioOutline(parent) 
            : new model.Scenario(parent);
            
        scenario.title = data.title || '';
        scenario.description = data.description || '';
        scenario.tags = data.tags || [];
        scenario.id = data.id || '';
        scenario.executionTime = data.executionTime || data.duration || 0;
        scenario.type = data.type || 'Scenario';
        
        // Reconstruct steps
        if (data.steps && Array.isArray(data.steps)) {
            for (const stepData of data.steps) {
                const step = this.reconstructStep(stepData, scenario);
                scenario.steps.push(step);
                
                // Also add to the appropriate array
                switch (step.type) {
                    case 'given':
                        scenario.givens.push(step);
                        break;
                    case 'when':
                        scenario.whens.push(step);
                        break;
                }
            }
        }
        
        // Reconstruct ruleViolations if present
        if (data.ruleViolations && Array.isArray(data.ruleViolations)) {
            scenario.ruleViolations = data.ruleViolations.map((v: any) => 
                this.reconstructRuleViolation(v)
            );
        }
        
        // Copy statistics if present
        if (data.statistics) {
            Object.assign(scenario.statistics, data.statistics);
        }
        
        // Handle ScenarioOutline-specific properties
        if (isOutline && scenario instanceof model.ScenarioOutline) {
            // Reconstruct tables
            if (data.tables && Array.isArray(data.tables)) {
                scenario.tables = data.tables.map((tableData: any) => {
                    const table = new model.Table();
                    table.name = tableData.name || '';
                    table.description = tableData.description || '';
                    table.dataTable = tableData.dataTable || [];
                    return table;
                });
            }
            
            // Reconstruct examples
            if (data.examples && Array.isArray(data.examples)) {
                for (const exampleData of data.examples) {
                    const example = new model.ScenarioExample(parent, scenario);
                    example.title = exampleData.title || '';
                    example.description = exampleData.description || '';
                    example.example = exampleData.example || {};
                    example.sequence = exampleData.sequence || 0;
                    
                    // Reconstruct steps for the example
                    if (exampleData.steps && Array.isArray(exampleData.steps)) {
                        for (const stepData of exampleData.steps) {
                            const step = this.reconstructStep(stepData, example);
                            example.steps.push(step);
                        }
                    }
                    
                    scenario.examples.push(example);
                }
            }
        }
        
        return scenario;
    }
    
    /**
     * Reconstruct a LiveDocRuleViolation from JSON data
     */
    private static reconstructRuleViolation(data: any): model.LiveDocRuleViolation {
        // Map the rule name back to the enum value
        let ruleValue = RuleViolations.error; // default
        if (typeof data.rule === 'string') {
            // Try to find the enum value by name
            const ruleName = data.rule as keyof typeof RuleViolations;
            if (ruleName in RuleViolations) {
                ruleValue = RuleViolations[ruleName];
            }
        } else if (typeof data.rule === 'number') {
            ruleValue = data.rule;
        }
        
        return new model.LiveDocRuleViolation(
            ruleValue,
            data.message || '',
            data.title || ''
        );
    }
    
    /**
     * Reconstruct a StepDefinition object from JSON data
     */
    private static reconstructStep(data: any, parent: model.Scenario): model.StepDefinition {
        const step = new model.StepDefinition(parent, data.title || '');
        step.rawTitle = data.rawTitle || data.title || '';
        step.type = data.type || '';
        step.description = data.description || '';
        step.docString = data.docString || '';
        step.dataTable = data.dataTable || [];
        step.values = data.values || [];
        step.valuesRaw = data.valuesRaw || [];
        step.status = data.status;
        step.duration = data.duration || 0;
        step.id = data.id || '';
        step.sequence = data.sequence || 0;
        step.code = data.code || '';
        
        // Reconstruct exception if present
        if (data.exception && (data.exception.message || data.exception.stackTrace)) {
            step.exception = new model.Exception();
            step.exception.message = data.exception.message || '';
            step.exception.stackTrace = data.exception.stackTrace || '';
            step.exception.actual = data.exception.actual || '';
            step.exception.expected = data.exception.expected || '';
        }
        
        // Reconstruct rule violations
        if (data.ruleViolations && Array.isArray(data.ruleViolations)) {
            step.ruleViolations = data.ruleViolations.map((v: any) => 
                this.reconstructRuleViolation(v)
            );
        }
        
        return step;
    }
    
    /**
     * Reconstruct a VitestSuite object from JSON data
     */
    private static reconstructSuite(data: any): model.VitestSuite {
        const suite = new model.VitestSuite(null, data.title || '', data.type || 'suite');
        suite.id = data.id || '';
        suite.filename = data.filename || '';
        
        // Reconstruct tests
        if (data.tests && Array.isArray(data.tests)) {
            for (const testData of data.tests) {
                const test = new model.LiveDocTest(suite, testData.title || '');
                test.status = testData.status;
                test.duration = testData.duration || 0;
                test.id = testData.id || '';
                suite.tests.push(test);
            }
        }
        
        return suite;
    }

    /**
     * Get all features registered during test execution
     * Used by reporters to access test results
     */
    public static getAllFeatures(): model.Feature[] {
        return featureRegistry;
    }

    /**
     * Get all suites registered during test execution
     * Used by reporters to access test results
     */
    public static getAllSuites(): model.VitestSuite[] {
        return suiteRegistry;
    }
    
    /**
     * Clear all registries (useful for testing)
     */
    public static clearRegistries(): void {
        featureRegistry.length = 0;
        suiteRegistry.length = 0;
    }

    /**
     * Build a VitestSuite from a task tree node (used for native describe/it blocks in dynamic tests)
     */
    private static buildSuiteFromTask(task: any, filepath: string, parent: model.VitestSuite | null = null): model.VitestSuite {
        const suite = new model.VitestSuite(parent, task.name, 'suite');
        suite.filename = filepath;
        
        // Process child tasks
        for (const childTask of (task.tasks || [])) {
            if (childTask.type === 'suite') {
                const childSuite = LiveDoc.buildSuiteFromTask(childTask, filepath, suite);
                suite.children.push(childSuite);
            } else if (childTask.type === 'test') {
                const test = LiveDoc.buildTestFromTask(childTask, suite);
                suite.tests.push(test);
                // Update suite statistics
                suite.statistics.updateStats(test.status, test.duration);
            }
        }
        
        return suite;
    }

    /**
     * Build a LiveDocTest from a task tree node (used for native describe/it blocks in dynamic tests)
     */
    private static buildTestFromTask(task: any, parent: model.VitestSuite): model.LiveDocTest<model.VitestSuite> {
        const test = new model.LiveDocTest<model.VitestSuite>(parent, task.name);
        
        // Set status based on task result or mode
        // Skipped tests may not have a result but have mode: 'skip'
        let taskState = task.result?.state || 'unknown';
        if (taskState === 'unknown' && task.mode === 'skip') {
            taskState = 'skipped';
        }
        test.status = LiveDoc.mapTaskStateToSpecStatus(taskState);
        test.duration = task.result?.duration || 0;
        
        if (task.result?.errors && task.result.errors.length > 0) {
            const exception = new model.Exception();
            exception.message = task.result.errors[0].message || '';
            exception.stackTrace = task.result.errors[0].stack || '';
            test.exception = exception;
        }
        
        return test;
    }

    /**
     * Map Vitest task state to LiveDoc SpecStatus
     */
    private static mapTaskStateToSpecStatus(state: string): model.SpecStatus {
        switch (state) {
            case 'pass':
            case 'passed':
                return model.SpecStatus.pass;
            case 'fail':
            case 'failed':
                return model.SpecStatus.fail;
            case 'skip':
            case 'skipped':
            case 'pending':
                return model.SpecStatus.pending;
            default:
                return model.SpecStatus.unknown;
        }
    }
}
