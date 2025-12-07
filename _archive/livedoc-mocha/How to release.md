# How to release
The current project is slightly hacked together to support multiple root scripts. This prevents simple package creation.

## Steps
1. Update package.json file to next version
1. Create release bits
    * `npm run release`

1. Create package
    * `npm run pack`

1. Validate package locally

1. Publish package just created
    * update the npm-publish script in package.json to match the name of the new package, just generated
    * `npm run npm-publish`

> Do not attempt to publish using just `npm publish` this will create a new package that is not correctly built. The result will be a corrupt package being published.