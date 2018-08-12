import { LiveDocSuite } from "./LiveDocSuite";
import { Background } from "./Background";
import { Scenario } from "./Scenario";
import { FeatureContext } from "./FeatureContext";
import { BackgroundContext } from "./BackgroundContext";
import { RuleViolations } from "./RuleViolations";

export class Feature extends LiveDocSuite {
    public filename: string;
    public background: Background;
    public scenarios: Scenario[] = [];

    public executionTime: number;

    constructor() {
        super();
    }

    public addScenario(scenario: Scenario) {
        // validate we have a description!
        if (!scenario.title) {
            scenario.addViolation(RuleViolations.enforceTitle, `${scenario.type} seems to be missing a title. Titles are important to convey the meaning of the Spec.`, scenario.title);
        }

        scenario.sequence = scenario.parent.scenarios.length;

        // Assign unique ids
        this.generateId(scenario);
        this.validateIdUniqueness(scenario.id, this.scenarios);

        this.scenarios.push(scenario);
    }

    public getFeatureContext(): FeatureContext {
        return ({
            filename: this.filename,
            title: this.title,
            description: this.description,
            tags: this.tags
        });
    }

    public getBackgroundContext(): BackgroundContext {
        const context = this.background.getScenarioContext();
        return ({
            title: context.title,
            description: context.description,
            given: context.given,
            and: context.and,
            tags: context.tags
        });
    }
}