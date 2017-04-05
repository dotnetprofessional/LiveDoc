# LiveDoc

A Living Documentation platform for BDD projects using various testing libraries. The project is setup in two phases:

* Phase I: define Gherkin language extensions for popular testing libraries. The first one is for the javascript library mocha. The mocha extension can be found here: [livedoc-mocha](packages/livedoc-mocha/readme.md).
* Phase II: provides a reporting tool for displaying the output of the specifications. This phase is where we take the test output in Gherkin and make it usable as Living Documentation. The idea is to make navigation and discovery of the specifications easy and insightful.

As part of Phase I, an almost feature complete version of [livedoc-mocha](packages/livedoc-mocha/readme.md) is available. Even without Phase II, this library provides a lot of benefits over the out of the box mocha. So we encourage you to start using [livedoc-mocha](packages/livedoc-mocha/readme.md) today and start enjoying the benefits that BDD offer. Then when phase II is ready, you'll be able to take full advantage of the Living Documentation platform.
