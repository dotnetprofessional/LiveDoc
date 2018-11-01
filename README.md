# LiveDoc

A Living Documentation platform for BDD projects using various testing libraries. The project is setup in two phases:

* Phase I: define Gherkin language extensions for popular testing libraries. The first one is for the javascript library mocha. The mocha extension can be found here: [livedoc-mocha](packages/livedoc-mocha#readme).
* Phase II: provides a reporting tool for displaying the output of the specifications. This phase is where we take the test output in Gherkin and make it usable as Living Documentation. The idea is to make navigation and discovery of the specifications easy and insightful.

__Phase I__ is now feature complete, with a full featured version of [livedoc-mocha](packages/livedoc-mocha#readme) now available. Additional features continue to be added. 

__Phase II__ has begun with features being added to the livedoc VSCode plugin. The VSCode plugin will be the first iteration. The intent is to migrate the reporting to VSTS online as well. This work is currently being worked on the hackathon branch.

So we encourage you to start using [livedoc-mocha](packages/livedoc-mocha#readme) today and start enjoying the benefits that BDD offer. Then when phase II is ready, you'll be able to take full advantage of the Living Documentation platform.
