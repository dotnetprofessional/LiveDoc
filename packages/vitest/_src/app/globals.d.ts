import type { FeatureContext, ScenarioContext, StepContext, BackgroundContext } from "./model";

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
     * Define a Given step (precondition)
     */
    function Given(title: string, fn?: (ctx: LiveDocTestContext) => void | Promise<void>, passedParam?: object | Function): void;

    /**
     * Define a When step (action)
     */
    function When(title: string, fn?: (ctx: LiveDocTestContext) => void | Promise<void>, passedParam?: object | Function): void;

    /**
     * Define a Then step (assertion)
     */
    function Then(title: string, fn?: (ctx: LiveDocTestContext) => void | Promise<void>, passedParam?: object | Function): void;

    /**
     * Define an And step (continuation)
     */
    function And(title: string, fn?: (ctx: LiveDocTestContext) => void | Promise<void>, passedParam?: object | Function): void;

    /**
     * Define a But step (continuation with contrast)
     */
    function But(title: string, fn?: (ctx: LiveDocTestContext) => void | Promise<void>, passedParam?: object | Function): void;
}

export {};
