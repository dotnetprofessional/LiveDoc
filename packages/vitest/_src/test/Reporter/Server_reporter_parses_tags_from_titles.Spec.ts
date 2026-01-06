require('chai').should();

import { expect } from "vitest";
import LiveDocServerReporter from "../../app/reporter/LiveDocServerReporter";
import { feature, scenario, given, when, Then as then } from "../../app/livedoc";

feature("Server reporter parses tags from title blocks", () => {
    scenario("Building execution results captures tags and strips tag lines from description", () => {
        let results: any;
        let testModules: any;

        given(
            "a feature task titled 'My Feature' with tags '@smoke fast' and description 'Some description', and a scenario titled 'My Scenario' with tags '@critical' and description 'Scenario description'",
            (ctx) => {
                const featureTitle = String(ctx.step.values[0]);
                const featureTagsLine = String(ctx.step.values[1]);
                const featureDescription = String(ctx.step.values[2]);
                const scenarioTitle = String(ctx.step.values[3]);
                const scenarioTagsLine = String(ctx.step.values[4]);
                const scenarioDescription = String(ctx.step.values[5]);

                const featureBlock = `${featureTitle}\n${featureTagsLine}\n${featureDescription}`;
                const scenarioBlock = `${scenarioTitle}\n${scenarioTagsLine}\n${scenarioDescription}`;

                const featureTask = {
                    type: "suite",
                    name: `Feature: ${featureBlock}`,
                    tasks: [
                        {
                            type: "suite",
                            name: `Scenario: ${scenarioBlock}`,
                            tasks: [
                                {
                                    type: "test",
                                    name: "Given something",
                                    result: { state: "pass", duration: 1 }
                                }
                            ]
                        }
                    ]
                };

                testModules = [
                    {
                        task: {
                            filepath: "C:/repo/specs/MyFeature.Spec.ts",
                            tasks: [featureTask]
                        }
                    }
                ];
            }
        );

        when("building execution results from Vitest tasks", () => {
            const reporter = new LiveDocServerReporter();
            results = (reporter as any).buildExecutionResults(testModules);
        });

        then("the built Feature has tags ['smoke','fast'] and description 'Some description' and the built Scenario has tags ['critical'] and description 'Scenario description'", () => {
            expect(results.features).toHaveLength(1);
            expect(results.features[0].title).toBe("My Feature");
            expect(results.features[0].tags).toEqual(["smoke", "fast"]);
            expect(results.features[0].description).toBe("Some description");

            const featureModel = results.features[0];
            expect(featureModel.scenarios).toHaveLength(1);

            const scenarioModel = featureModel.scenarios[0] as any;
            expect(scenarioModel.title).toBe("My Scenario");
            expect(scenarioModel.tags).toEqual(["critical"]);
            expect(scenarioModel.description).toBe("Scenario description");
        });
    });
});
