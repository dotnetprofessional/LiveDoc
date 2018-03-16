import { ScenarioContext } from "../ScenarioContext";
import { StepContext } from "../StepContext";
import { StepDefinition } from "./StepDefinition";
import { LiveDocDescribe } from "./LiveDocDescribe";
import { Feature } from "./Feature";
import { LiveDocRuleViolation } from "./LiveDocRuleViolation";

export class Scenario extends LiveDocDescribe {

    public givens: StepDefinition[] = [];
    public whens: StepDefinition[] = [];
    public steps: StepDefinition[] = [];

    public associatedFeatureId: number;
    public executionTime: number;

    // Used for validations and grouping
    private hasGiven: boolean = false;
    private hasWhen: boolean = false;
    private hasThen: boolean = false;
    private processingStepType: string;

    constructor (public parent: Feature) {
        super()
    }

    public addStep(step: StepDefinition) {
        this.steps.push(step);

        // validate we have a description!
        if (!step.title) {
            step.addViolation(new LiveDocRuleViolation(`${step.type} seems to be missing a title. Titles are important to convey the meaning of the Spec.`, livedoc.rules.enforceTitle, step.title, this.parent.filename))
                .report();
        }

        const oneGivenWhenThenViolation = new LiveDocRuleViolation(`there should be only one ${step.type} in a Scenario, Scenario Outline or Background. Try using and or but instead.`, livedoc.rules.singleGivenWhenThen, this.title, this.parent.filename);

        switch (step.type) {
            case "Given":
                // Check rules
                if (this.hasGiven) {
                    // Too many givens
                    step.addViolation(oneGivenWhenThenViolation)
                        .report();
                }
                this.processingStepType = step.type;
                this.hasGiven = true;
                this.givens.push(step);
                break;
            case "When":
                // Validate that we have a given here or from a Background
                if (!this.hasGiven && (this.parent.background && !this.parent.background.hasGiven)) {
                    step.addViolation(new LiveDocRuleViolation(`scenario does not have a Given or a Background with a given.`, livedoc.rules.mustIncludeGiven, this.title, this.parent.filename))
                        .report();
                }
                if (this.hasWhen) {
                    // Too many givens
                    step.addViolation(oneGivenWhenThenViolation)
                        .report();
                }
                this.processingStepType = step.type;
                this.hasWhen = true;
                this.whens.push(step);
                break;
            case "Then":
                if (!this.hasWhen) {
                    step.addViolation(new LiveDocRuleViolation(`scenario does not have a When, use When to describe the test action.`, livedoc.rules.mustIncludeWhen, this.title, this.parent.filename))
                        .report();
                }
                if (this.hasThen) {
                    // Too many givens
                    step.addViolation(oneGivenWhenThenViolation)
                        .report();
                }
                this.processingStepType = step.type;
                this.hasThen = true;
                break;
            case "and":
            case "but":
                // add the continuation of the main step to their collections    
                switch (this.processingStepType) {
                    case "Given":
                        this.givens.push(step);
                        break;
                    case "When":
                        this.whens.push(step);
                        break;
                    case "Then":
                        break;
                    default:
                        // Seems we're not processing a GTW!?
                        step.addViolation(new LiveDocRuleViolation(`a ${step.type} step definition must be preceded by a Given, When or Then.`, livedoc.rules.andButMustHaveGivenWhenThen, this.title, this.parent.filename))
                            .report();
                }
        }

    }

    public getScenarioContext(): ScenarioContext {
        const givens: StepContext[] = [];
        const and: StepContext[] = [];

        for (let i = 0; i < this.givens.length; i++) {
            const stepContext = this.givens[i].getStepContext();
            givens.push(stepContext);
            if (i > 0) {
                and.push(stepContext);
            }
        }

        const context = new ScenarioContext();
        context.title = this.title;
        context.description = this.description;
        context.given = givens.length != 0 ? givens[0] : undefined;
        context.and = and;
        context.tags = this.tags;
        return context;
    }
}