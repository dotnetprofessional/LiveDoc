require('chai').should();

import * as model from "../../app/model/index";
import { LiveDocSpec, LiveDocReporterOptions } from "../../app/reporter/LiveDocSpec";
import { DefaultColorTheme } from "../../app/reporter/ColorTheme";
import { feature, scenario, given, when, Then as then, and } from "../../app/livedoc";

feature(`Summary grouping is consistent across Features, Specifications, and Suites`, () => {
    scenario(`When headers are enabled then Features show group 'FEATURES GROUP' and Specifications show group 'SPECS GROUP' and Suites show group 'SUITES GROUP'`, () => {
        let output = "";

        given(`reporter options include summary 'true' and headers 'true' and list 'false'`, (ctx) => {
            void ctx;
        });

        and(`execution results include a Feature in path 'features_group', a Specification in path 'specs_group', and a Suite in path 'suites_group'`, (ctx) => {
            void ctx;
        });

        when(`the spec reporter writes summary tables`, async (ctx) => {
            void ctx;

            const options = new LiveDocReporterOptions();
            options.summary = true;
            options.headers = true;
            options.list = false;
            options.spec = false;

            const specReporter = new LiveDocSpec(DefaultColorTheme, false);
            (specReporter as any).setOptions(options);

            const results = new model.ExecutionResults();

            // Feature
            const featureModel = new model.Feature();
            featureModel.title = "My Feature";
            featureModel.path = "features_group";
            const scenarioModel = new model.Scenario(featureModel);
            scenarioModel.title = "My Scenario";
            scenarioModel.statistics.updateStats(model.SpecStatus.pass, 1);
            featureModel.scenarios.push(scenarioModel);

            // Specification
            const specModel = new model.Specification();
            specModel.title = "My Specification";
            specModel.path = "specs_group";
            const ruleModel = new model.Rule(specModel);
            ruleModel.title = "My Rule";
            ruleModel.status = model.SpecStatus.pass;
            ruleModel.executionTime = 1;
            specModel.rules.push(ruleModel);

            // Suite
            const suiteModel = new model.VitestSuite(null, "My Suite", "suite");
            suiteModel.path = "suites_group";
            suiteModel.statistics.updateStats(model.SpecStatus.pass, 1);

            results.features = [featureModel];
            results.specifications = [specModel];
            results.suites = [suiteModel];

            const logs: string[] = [];
            const originalLog = console.log;
            console.log = (...args: any[]) => {
                logs.push(args.map(a => String(a)).join(" "));
            };

            try {
                await specReporter.executionEnd(results);
            } finally {
                console.log = originalLog;
            }

            output = logs.join("\n");
        });

        then(`the output includes the feature group header 'FEATURES GROUP'`, (ctx) => {
            output.should.contain(ctx.step.values[0]);
        });

        and(`the output includes the specification group header 'SPECS GROUP'`, (ctx) => {
            output.should.contain(ctx.step.values[0]);
        });

        and(`the output includes the suite group header 'SUITES GROUP'`, (ctx) => {
            output.should.contain(ctx.step.values[0]);
        });
    });
});
