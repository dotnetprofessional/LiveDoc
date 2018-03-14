import { Scenario } from "./Scenario";
import { Table } from "./Table";
import { ScenarioOutlineScenario } from "./ScenarioOutlineScenario";
import { Feature } from "./Feature";

/**
 * The computed scenario from a ScenarioOutline definition
 * This differs from a standard scenario as it includes an example
 * 
 * @class ScenarioOutlineScenario
 * @extends {Scenario}
 */
export class ScenarioOutline extends Scenario {
    public tables: Table[] = [];
    public scenarios: ScenarioOutlineScenario[] = [];

    constructor (parent: Feature) {
        super(parent)
        this.displayPrefix = "Scenario Outline";
    }
}