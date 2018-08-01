import { ScenarioContext } from "./ScenarioContext";
import { StepContext } from "./StepContext";
import { StepDefinition } from "./StepDefinition";
import { LiveDocSuite } from "./LiveDocSuite";
import { Feature } from "./Feature";
import { RuleViolations } from "./RuleViolations";
import { jsonIgnore } from "../decorators/jsonIgnore";

export class Scenario extends LiveDocSuite {

    @jsonIgnore
    public parent: Feature;
    @jsonIgnore
    public givens: StepDefinition[] = [];
    @jsonIgnore
    public whens: StepDefinition[] = [];
    public steps: StepDefinition[] = [];

    public associatedFeatureId: number;
    public executionTime: number;

    // Used for validations and grouping
    @jsonIgnore
    private hasGiven: boolean = false;
    @jsonIgnore
    private hasWhen: boolean = false;
    @jsonIgnore
    private hasThen: boolean = false;
    @jsonIgnore
    private processingStepType: string;

    constructor(parent: Feature) {
        super();
        this.parent = parent;
    }

    public addStep(step: StepDefinition) {
        this.steps.push(step);
        step.sequence = this.steps.length;
        step.parent = this;

        // validate we have a description!
        if (!step.title) {
            step.addViolation(RuleViolations.enforceTitle, `${step.type} seems to be missing a title. Titles are important to convey the meaning of the Spec.`, step.title)
        } else {
            // set and validate the id
            this.generateId();
            this.validateIdUniqueness(this.id, this.parent.scenarios);
        }

        switch (step.type) {
            case "Given":
                // Check rules
                if (this.hasGiven) {
                    // Too many givens
                    this.addGivenWhenThenViolation(step);
                }
                this.processingStepType = step.type;
                this.hasGiven = true;
                this.givens.push(step);
                break;
            case "When":
                // Validate that we have a given here or from a Background
                if (!this.hasGiven && (this.parent.background && !this.parent.background.hasGiven)) {
                    step.addViolation(RuleViolations.mustIncludeGiven, `scenario does not have a Given or a Background with a given.`, this.title);
                }
                if (this.hasWhen) {
                    // Too many givens
                    this.addGivenWhenThenViolation(step);
                }
                this.processingStepType = step.type;
                this.hasWhen = true;
                this.whens.push(step);
                break;
            case "Then":
                if (!this.hasWhen) {
                    step.addViolation(RuleViolations.mustIncludeWhen, `scenario does not have a When, use When to describe the test action.`, this.title);
                }
                if (this.hasThen) {
                    // Too many givens
                    this.addGivenWhenThenViolation(step);
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
                        step.addViolation(RuleViolations.andButMustHaveGivenWhenThen, `${step.type} step definition must be preceded by a Given, When or Then.`, this.title);
                }
        }
    }

    private addGivenWhenThenViolation(step: StepDefinition): void {
        step.addViolation(RuleViolations.singleGivenWhenThen, `there should be only one ${step.type} in a Scenario, Scenario Outline or Background. Try using and or but instead.`, this.title);
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