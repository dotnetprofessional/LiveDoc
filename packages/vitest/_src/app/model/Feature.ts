import { LiveDocSuite } from "./LiveDocSuite";
import { Background } from "./Background";
import { Scenario } from "./Scenario";
import { FeatureContext } from "./FeatureContext";
import { BackgroundContext } from "./BackgroundContext";
import { RuleViolations } from "./RuleViolations";

export class Feature extends LiveDocSuite {
    public filename: string = "";
    public background?: Background;
    public scenarios: Scenario[] = [];
    public executionTime: number = 0;

    constructor() {
        super();
    }

    public addScenario(scenario: Scenario): void {
        // Validate we have a description
        if (!scenario.title) {
            scenario.addViolation(
                RuleViolations.enforceTitle,
                `${scenario.type} seems to be missing a title. Titles are important to convey the meaning of the Spec.`,
                scenario.title
            );
        }

        scenario.sequence = this.scenarios.length;

        // Assign unique ids
        this.generateId(scenario);
        this.validateIdUniqueness(scenario.id, this.scenarios);

        this.scenarios.push(scenario);
    }

    public getFeatureContext(): FeatureContext {
        const context = new FeatureContext();
        context.filename = this.filename;
        context.title = this.title;
        context.description = this.description;
        context.tags = this.tags;
        return context;
    }

    public getBackgroundContext(): BackgroundContext | undefined {
        if (!this.background) {
            return undefined;
        }
        const context = this.background.getScenarioContext() as BackgroundContext;
        return context;
    }

    toJSON(): object {
        return {
            ...super.toJSON(),
            filename: this.filename,
            background: this.background?.toJSON?.() || this.background,
            scenarios: this.scenarios.map(s => s.toJSON()),
            executionTime: this.executionTime
        };
    }
}
