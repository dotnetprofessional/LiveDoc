import type { FeatureContext, ScenarioContext, StepContext, BackgroundContext, SpecificationContext, RuleContext } from "./model";

/**
 * The context object passed to all LiveDoc test functions.
 * Provides access to feature, scenario, step, example, and background contexts.
 */
export interface LiveDocTestContext {
    /** Framework metadata about the current feature */
    feature?: FeatureContext;
    /** Framework metadata about the current scenario */
    scenario?: ScenarioContext;
    /** Framework metadata about the current step */
    step?: StepContext;
    /** Framework metadata about the current scenario outline example */
    example?: ScenarioContext;
    /** Framework metadata about the background */
    background?: BackgroundContext;
}

/**
 * The context object passed to Specification pattern test functions.
 */
export interface SpecificationTestContext {
    /** Framework metadata about the current specification */
    specification?: SpecificationContext;
    /** Framework metadata about the current rule */
    rule?: RuleContext;
    /** Example data for rule outlines */
    example?: Record<string, any>;
}

declare global {
    /**
     * Define a Gherkin feature
     */
    function feature(title: string, fn: (ctx: LiveDocTestContext) => void): void;

    /**
     * Define a scenario within a feature
     */
    function scenario(title: string, fn: (ctx: LiveDocTestContext) => void | Promise<void>): void;

    /**
     * Define a scenario outline (data-driven test)
     * Examples are extracted from the title string by the parser
     */
    function scenarioOutline(title: string, fn: (ctx: LiveDocTestContext) => void): void;

    /**
     * Define background steps that run before each scenario
     */
    function background(title: string, fn: (ctx: LiveDocTestContext & {
        afterBackground: (fn: () => void | Promise<void>) => void;
    }) => void): void;

    /**
     * Define a given step (precondition)
     */
    function given(title: string, fn?: (ctx: LiveDocTestContext) => void | Promise<void>, passedParam?: object | Function): void;

    /**
     * Define a when step (action)
     */
    function when(title: string, fn?: (ctx: LiveDocTestContext) => void | Promise<void>, passedParam?: object | Function): void;

    /**
     * Define a then step (assertion)
     * Available as lowercase global when using globals mode.
     */
    function then(title: string, fn?: (ctx: LiveDocTestContext) => void | Promise<void>, passedParam?: object | Function): void;

    /**
     * Define an and step (continuation)
     */
    function and(title: string, fn?: (ctx: LiveDocTestContext) => void | Promise<void>, passedParam?: object | Function): void;

    /**
     * Define a but step (continuation with contrast)
     */
    function but(title: string, fn?: (ctx: LiveDocTestContext) => void | Promise<void>, passedParam?: object | Function): void;

    // ============================================
    // Specification Pattern Globals
    // ============================================

    /**
     * Define a specification (container for rules)
     */
    function specification(title: string, fn: (ctx: SpecificationTestContext) => void): void;

    /**
     * Define a rule within a specification
     */
    function rule(title: string, fn: (ctx: SpecificationTestContext) => void | Promise<void>): void;

    /**
     * Define a rule outline (data-driven rules)
     * Examples are extracted from the title string by the parser
     */
    function ruleOutline(title: string, fn: (ctx: SpecificationTestContext) => void | Promise<void>): void;
}

export {};
