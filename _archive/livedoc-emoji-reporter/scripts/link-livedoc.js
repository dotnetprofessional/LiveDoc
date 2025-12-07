const fs = require('fs-extra');

const livedocModulePathSource = "../livedoc-mocha/release";
const livedocModulePathDestination = "./node_modules/livedoc-mocha";

// Check if we have a livedoc release built that can be symlinked
if (!fs.existsSync(livedocModulePathSource)) {
    throw new Error("You must have a release build. Use npm run release, in the livedoc-mocha folder");
}

// Check if we have a livedoc entry in the node_modules directory
if (fs.existsSync(livedocModulePathDestination)) {
    // Delete the existing folder
    console.log("removing existing livedoc-mocha modules");
    fs.removeSync(livedocModulePathDestination);
    console.log("removing existing livedoc-mocha modules:complete");
} else {
    console.log("no livedoc-mocha module installed");
}

// Now symlink to the release folder of livedoc. The release dir should be used as it
// is what will be shipped when packed, so its the most accurate.

// With Promises:
fs.ensureSymlink(livedocModulePathSource, livedocModulePathDestination)
    .then(() => {
        console.log('Successfully symlinked livedoc-mocha!')
    })
    .catch(err => {
        console.error(err)
        console.log("ENSURE YOU ARE RUNNING AS AN ADMINISTRATOR!");
    });
