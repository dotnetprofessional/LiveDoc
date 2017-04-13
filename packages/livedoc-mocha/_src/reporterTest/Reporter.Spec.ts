
describe.skip("reporter", () => {
    before((done) => {
        var Mocha = require('mocha'),
            fs = require('fs'),
            path = require('path');

        // Instantiate a Mocha instance.
        const reporter = require("../app/reporter");
        var mocha = new Mocha({
            reporter: reporter
        });

        var testDir = 'D:/dev/git.public/LiveDoc/packages/livedoc-mocha/build/reporterTest'
        debugger;
        // Add each .js file to the mocha instance
        fs.readdirSync(testDir).filter(function (file) {
            // Only keep the .js files
            console.log("try file: " + file);
            const match = file === 'ReporterExample.Spec.js';
            return match;

        }).forEach(function (file) {
            debugger;
            console.log("file:" + file);
            mocha.addFile(
                path.join(testDir, file)
            );
        });

        // Run the tests.
        mocha.run(function (failures) {
            process.on('exit', function () {
                debugger;
                done();  // exit with non-zero status if there were failures
                process.exit(failures);
            });
        });
    });

    it("x", () => {
        debugger;
    })
})