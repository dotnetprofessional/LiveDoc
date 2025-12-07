require('chai').should();
import { LiveDocReporter } from "../../app/reporter/index";
import { feature, scenario, Given, When, Then } from "../../app/livedoc";

feature(`Remove the root path from filenames to define a path`, (ctx) => {
    scenario(`Multiple Features are executed with various paths`, (ctx) => {
        let rootPath = "";
        Given(`the following Feature filenames
        """
        [
            "D:/dev/git.public/LiveDoc/packages/livedoc-vitest/_src/test/Reporter/Feature1.Spec.js",
            "D:/dev/git.public/LiveDoc/packages/livedoc-vitest/_src/test/Reporter/Feature3.Spec.js",
            "D:/dev/git.public/LiveDoc/packages/livedoc-vitest/_src/test/Background/Feature1.Spec.js",
            "D:/dev/git.public/LiveDoc/packages/livedoc-vitest/_src/test/Someother/Feature1.Spec.js",
            "D:/dev/git.public/LiveDoc/packages/livedoc-vitest/_src/test/Background/Feature2.Spec.js",
            "D:/dev/git.public/LiveDoc/packages/livedoc-vitest/_src/x/Feature2.Spec.js",
            "D:/dev/git.public/LiveDoc/packages/livedoc-vitest/_src/test/DeepFolder/Level2/Feature1.Spec.js"
        ]
        """
            `, (ctx) => {
            });

        When(`extracting the path root`, async (ctx) => {
            const givenStep = ctx.scenario.steps.find(s => s.type === 'Given');
            rootPath = LiveDocReporter.findRootPath(givenStep!.docStringAsEntity!);
        });

        Then(`the root path is 'D:/dev/git.public/LiveDoc/packages/livedoc-vitest/_src/'`, (ctx) => {
            rootPath.should.be.eq(ctx.step.values[0]);
        });
    });
});
