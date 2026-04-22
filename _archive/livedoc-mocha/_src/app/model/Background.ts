import { Scenario } from "./Scenario";
import { StepDefinition } from "./StepDefinition";
import { Feature } from "./Feature";
import { ParserException } from "./ParserException";

export class Background extends Scenario {
    constructor (parent: Feature) {
        super(parent)
    }

    public addStep(step: StepDefinition): StepDefinition {
        super.addStep(step);

        // Backgrounds only accept the Given keyword all other top level keywords are invalid
        if (step.type === "Then" || step.type == "When") {
            throw new ParserException(`Backgrounds only support using the given step definition. Consider moving the ${step.type} to a scenario.`, step.title, this.parent.filename);
        }
        return step;
    }
}