require('chai').should();

import { feature, scenario, given, when, Then as then, and } from "../../app/livedoc";
import * as model from "../../app/model/index";
import { LiveDocViewerReporter } from "../../app/reporter/LiveDocViewerReporter";

feature(`Viewer reporter includes TestCase.path on root documents`, () => {
    scenario(`Posting results includes path for Feature, Specification, and Container root documents`, () => {
        let postedTestCases: any[] = [];

        let featureTitle = "";
        let featureFilename = "";
        let specTitle = "";
        let specFilename = "";
        let suiteTitle = "";
        let suiteFilename = "";

        given(`a Feature titled 'Login Feature' with filename 'D:/repo/root/features/Login.Spec.ts', a Specification titled 'Calc Spec' with filename 'D:/repo/root/specs/Calc.Spec.ts', and a Suite titled 'Pure Suite' with filename 'D:/repo/root/suites/Pure.Spec.ts'`, (ctx) => {
            featureTitle = String(ctx.step.values[0]);
            featureFilename = String(ctx.step.values[1]);
            specTitle = String(ctx.step.values[2]);
            specFilename = String(ctx.step.values[3]);
            suiteTitle = String(ctx.step.values[4]);
            suiteFilename = String(ctx.step.values[5]);
        });

        when(`posting the execution results to the viewer server`, async () => {
            const results = new model.ExecutionResults();

            const sdkFeature = new model.Feature();
            sdkFeature.title = featureTitle;
            sdkFeature.filename = featureFilename;
            sdkFeature.scenarios = [];

            const sdkSpec = new model.Specification();
            sdkSpec.title = specTitle;
            sdkSpec.filename = specFilename;
            sdkSpec.rules = [];

            const sdkSuite = new model.VitestSuite(null, suiteTitle, "suite");
            sdkSuite.filename = suiteFilename;
            sdkSuite.tests = [];
            sdkSuite.children = [];

            (results as any).features = [sdkFeature];
            (results as any).specifications = [sdkSpec];
            (results as any).suites = [sdkSuite];

            const originalFetch = globalThis.fetch;
            postedTestCases = [];

            (globalThis as any).fetch = async (url: any, init?: any) => {
                const urlString = String(url);

                if (urlString.includes("/api/v1/runs/start")) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ protocolVersion: "1.0", runId: "run-1", websocketUrl: "" }),
                        text: async () => "",
                    } as any;
                }

                if (urlString.includes("/api/v1/runs/run-1/testcases")) {
                    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
                    if (body?.testCase) {
                        postedTestCases.push(body.testCase);
                    }
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({}),
                        text: async () => "",
                    } as any;
                }

                if (urlString.includes("/api/v1/runs/run-1/complete")) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({}),
                        text: async () => "",
                    } as any;
                }

                return {
                    ok: false,
                    status: 404,
                    json: async () => ({ message: "Unexpected URL" }),
                    text: async () => "Unexpected URL",
                } as any;
            };

            try {
                const reporter = new LiveDocViewerReporter({
                    server: "http://localhost:3100",
                    project: "proj",
                    environment: "env",
                    silent: true,
                });

                await reporter.execute(results);
            } finally {
                (globalThis as any).fetch = originalFetch;
            }
        });

        then(`the posted Feature node has path 'features/Login.Spec.ts'`, (ctx) => {
            const expectedPath = String(ctx.step.values[0]);
            const featureDoc = postedTestCases.find((n) => n && n.kind === "Feature" && n.title === featureTitle);

            featureDoc.should.exist;
            featureDoc.path.should.equal(expectedPath);
        });

        and(`the posted Specification node has path 'specs/Calc.Spec.ts'`, (ctx) => {
            const expectedPath = String(ctx.step.values[0]);
            const specDoc = postedTestCases.find((n) => n && n.kind === "Specification" && n.title === specTitle);

            specDoc.should.exist;
            specDoc.path.should.equal(expectedPath);
        });

        and(`the posted Container document has path 'suites/Pure.Spec.ts'`, (ctx) => {
            const expectedPath = String(ctx.step.values[0]);
            const suiteDoc = postedTestCases.find((n) => n && n.kind === "Container" && n.title === suiteTitle);

            suiteDoc.should.exist;
            suiteDoc.path.should.equal(expectedPath);
        });
    });
});
