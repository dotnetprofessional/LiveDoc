import { LiveDocSuite } from "./LiveDocSuite";
import { Background } from "./Background";
import { Scenario } from "./Scenario";
import { FeatureContext } from "./FeatureContext";
import { BackgroundContext } from "./BackgroundContext";

export class Feature extends LiveDocSuite {
    public filename: string;
    public background: Background;
    public scenarios: Scenario[] = [];

    public executionTime: number;

    constructor () {
        super()
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