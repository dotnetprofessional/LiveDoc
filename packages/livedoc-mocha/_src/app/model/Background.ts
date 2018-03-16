import { Scenario } from "./Scenario";
import { StepDefinition } from "./StepDefinition";
import { LiveDocRuleViolation } from "./LiveDocRuleViolation";
import { Feature } from "./Feature";

export class Background extends Scenario {
    constructor (parent: Feature) {
        super(parent)
    }

    public addStep(step: StepDefinition): StepDefinition {
        super.addStep(step);

        if (step.type === "Then" || step.type == "When") {
            step.addViolation(new LiveDocRuleViolation(`Backgrounds only support using the given step definition. Consider moving the ${step.type} to a scenario.`, livedoc.rules.backgroundMustOnlyIncludeGiven, step.title, this.parent.filename))
                .report();
        }
        return step;
    }
}