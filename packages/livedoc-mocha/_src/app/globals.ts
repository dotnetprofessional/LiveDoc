
declare var feature: Mocha.IContextDefinition;
declare var background: Mocha.IContextDefinition;
declare var scenario: Mocha.IContextDefinition;
declare var scenarioOutline: Mocha.IContextDefinition;

declare var given: Mocha.ITestDefinition;
declare var when: Mocha.ITestDefinition;
declare var then: Mocha.ITestDefinition;
declare var and: Mocha.ITestDefinition;
declare var but: Mocha.ITestDefinition;

declare var afterBackground: (fn) => void;

declare var featureContext: FeatureContext;
declare var scenarioContext: ScenarioContext;
declare var stepContext: StepContext;
declare var backgroundContext: BackgroundContext;
declare var scenarioOutlineContext: ScenarioOutlineContext;