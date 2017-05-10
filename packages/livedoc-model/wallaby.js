module.exports = function () {
    return {
        files: [
            'src/app/*.ts'
        ],

        tests: [
            'src/test/*.ts'
        ],

        env: {
            type: 'node'
        },
        testFramework: 'mocha',
        debug: true,
        reportConsoleErrorAsError: true,
        setup: function (wallaby) {
            // wallaby.testFramework is jasmine/QUnit/mocha object
            wallaby.testFramework.ui('livedoc-mocha');

            // you can access 'window' object in a browser environment,
            // 'global' object or require(...) something in node environment
        }

    };
};