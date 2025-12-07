module.exports = function () {
    return {
        files: [
            '_src/app/**/*.ts',
            '_src/app/**/*.js'
        ],

        tests: [
            '_src/test/**/*.ts'
        ],

        env: {
            type: 'node'
        },
        testFramework: 'mocha',
        debug: true,
        reportConsoleErrorAsError: true,
        setup: function (wallaby) {
            // wallaby.testFramework is jasmine/QUnit/mocha object
            require("./_src/app/livedoc");
            wallaby.testFramework.ui('livedoc-mocha');

            // you can access 'window' object in a browser environment,
            // 'global' object or require(...) something in node environment
        }

    };
};