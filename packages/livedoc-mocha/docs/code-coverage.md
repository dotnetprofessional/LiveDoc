# Code Coverage
Code coverage can be incorporated into your testing using the `istanbul` library. This can be configured in the same way you'd do for any `typescript` or `javascript` project. The following configuration can be used for a `typescript` project.

## Configuration
To support code coverage, the following additional packages are required to be installed. The following command will install and add them to the dev dependencies of your packages.json file.

```
npm install --dev--save nyc source-map-support ts-node @istanbuljs/nyc-config-typescript
```

To configure `nyc` add the following file to the root of your project or where you'll be executing your tests.

```js
{
    "extends": "@istanbuljs/nyc-config-typescript",
    "include": [
      "_src/app/**/*.ts"
    ],
    "extension": [
      ".ts",
      ".tsx"
    ],
    "require": [
      "ts-node/register/transpile-only"
    ],
    "reporter": [
      "text-summary",
      "html"
    ],
    "sourceMap": true,
    "instrument": true
}
```

This configuration file should be configured to desired requirements. For more details on how to configure this file refer to the [nyc documentation](https://github.com/istanbuljs/nyc) and [nyc-config-typescript documentation](https://www.npmjs.com/package/@istanbuljs/nyc-config-typescript).

Adding the following script to your packages file can then be used to execute the tests.

```
nyc npm run <existing test script>
```

A sample of this can be found in the `livedoc` [source](..\package.json).