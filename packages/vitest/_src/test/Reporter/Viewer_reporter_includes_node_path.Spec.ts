require('chai').should();

import { feature, scenario, given, when, Then as then, and } from "../../app/livedoc";
import * as model from "../../app/model/index";
import { LiveDocViewerReporter } from "../../app/reporter/LiveDocViewerReporter";

feature(`Viewer reporter includes Node.path on root documents`, () => {
    scenario(`Posting results includes path for Feature, Specification, and Suite root nodes`, () => {
        let postedNodes: any[] = [];

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
            postedNodes = [];

            (globalThis as any).fetch = async (url: any, init?: any) => {
                const urlString = String(url);

                if (urlString.includes("/api/runs/start")) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ runId: "run-1", websocketUrl: "" }),
                        text: async () => "",
                    } as any;
                }

                if (urlString.includes("/api/runs/run-1/nodes")) {
                    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
                    if (body?.node) {
                        postedNodes.push(body);
                    }
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({}),
                        text: async () => "",
                    } as any;
                }

                if (urlString.includes("/api/runs/run-1/complete")) {
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
            const featureNode = postedNodes
                .map((p) => p.node)
                .find((n) => n && n.kind === "Feature" && n.title === featureTitle);

            featureNode.should.exist;
            featureNode.path.should.equal(expectedPath);
        });

        and(`the posted Specification node has path 'specs/Calc.Spec.ts'`, (ctx) => {
            const expectedPath = String(ctx.step.values[0]);
            const specNode = postedNodes
                .map((p) => p.node)
                .find((n) => n && n.kind === "Specification" && n.title === specTitle);

            specNode.should.exist;
            specNode.path.should.equal(expectedPath);
        });

        and(`the posted Suite node has path 'suites/Pure.Spec.ts'`, (ctx) => {
            const expectedPath = String(ctx.step.values[0]);
            const suiteNode = postedNodes
                .map((p) => p.node)
                .find((n) => n && n.kind === "Suite" && n.title === suiteTitle);

            suiteNode.should.exist;
            suiteNode.path.should.equal(expectedPath);
        });
    });
});
