import { LiveDocReporter } from "../../app/reporter";

feature(`Remove the root path from filenames to define a path`, () => {
    scenario(`Multiple Features are executed with various paths`, () => {
        let rootPath = "";
        given(`the following Feature filenames
        """
        [
            "D:/dev/git.public/LiveDoc/packages/livedoc-mocha/_src/test/Reporter/Feature1.Spec.js",
            "D:/dev/git.public/LiveDoc/packages/livedoc-mocha/_src/test/Reporter/Feature3.Spec.js",
            "D:/dev/git.public/LiveDoc/packages/livedoc-mocha/_src/test/Background/Feature1.Spec.js",
            "D:/dev/git.public/LiveDoc/packages/livedoc-mocha/_src/test/Someother/Feature1.Spec.js",
            "D:/dev/git.public/LiveDoc/packages/livedoc-mocha/_src/test/Background/Feature2.Spec.js",
            "D:/dev/git.public/LiveDoc/packages/livedoc-mocha/_src/x/Feature2.Spec.js",
            "D:/dev/git.public/LiveDoc/packages/livedoc-mocha/_src/test/DeepFolder/Level2/Feature1.Spec.js"
        ]
        """
            `, () => {
            });

        when(`extracting the path root`, async () => {
            rootPath = LiveDocReporter.findRootPath(scenarioContext.given.docStringAsEntity);
        });

        then(`the root path is 'D:/dev/git.public/LiveDoc/packages/livedoc-mocha/_src'`, () => {
            rootPath.should.be.eq(stepContext.values[0]);
        });
    });
});