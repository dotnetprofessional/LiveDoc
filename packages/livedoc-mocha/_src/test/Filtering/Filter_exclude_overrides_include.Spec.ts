import { LiveDoc } from "../../app/livedoc";
import { SpecStatus, ExecutionResults, ScenarioOutline } from "../../app/model";
import { LiveDocOptions } from "../../app/LiveDocOptions";

feature(`Filter exclude overrides include tags
    `, () => {
        let executionResults: ExecutionResults;
        let liveDocOptions: LiveDocOptions = new LiveDocOptions();
        let featureText: string;

        scenario(`Using include and exclude option to specify Features to execute
            `, () => {
                given(`the filter is
                    """
                    {
                        "include": ["filter:include"],
                        "exclude": ["filter:exclude"]
                    }
                    """
            `, () => {
                        liveDocOptions.filters = stepContext.docStringAsEntity;
                    });

                and(`the following features
        
                    """
                    feature(\`This feature is executed as it matches the tag
                        @filter:include
                    \`, () => {
                        scenario(\`a scenario within a tagged feature\`, () => {
                            given("given within a scenario", () => {

                            });
                        });
                    });

                    feature(\`This feature is not executed as the exclude tag takes precedence
                        @filter:include
                        @filter:exclude

                    \`, () => {
                        scenario(\`a scenario within a tagged feature\`, () => {
                            given("given within a scenario", () => {
                                throw Error("This should not be executed!");
                            });
                        });
                    });
                    """
            `, () => {
                        featureText = stepContext.docString;
                    });

                when(`the feature is executed`, async () => {
                    executionResults = await LiveDoc.executeDynamicTestAsync(featureText, liveDocOptions);
                });

                then(`'2' features are processed`, () => {
                    executionResults.features.length.should.be.equal(stepContext.values[0]);
                });

                and(`the steps for the first feature are executed`, () => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[0].steps[0];
                    keyword.status.should.be.eq(SpecStatus.pass);
                });

                and(`the steps for the second feature are NOT executed`, () => {
                    const keyword = executionResults.features[1].scenarios[0].steps[0];
                    keyword.status.should.be.eq(SpecStatus.unknown);
                });
            });

        scenario("Using include and exclude option to specify Scenarios to execute", () => {
            given(`the filter is
                """
                {
                    "include": ["filter:include"],
                    "exclude": ["filter:exclude"]
                }
                """
                `, () => {
                    liveDocOptions.filters = stepContext.docStringAsEntity;
                });

            and(`the following features
        
                """
                feature(\`This features Scenarios are executed they match the tag\`, () => {
                    scenario(\`a scenario within a tagged feature
                        @filter:include
                        \`, () => {
                        given("given within a scenario 1", () => {

                        });
                    });
                    scenario(\`a scenario that's excluded due to the exclude tag
                        @filter:include
                        @filter:exclude
                    
                    \`, () => {
                        given("given within a scenario 2", () => {
                        });
                    });
                    scenario(\`another scenario within a tagged feature
                        @filter:include
                        \`, () => {
                        given("given within a scenario 3", () => {

                        });
                    });
                });

                feature(\`This feature is not executed as there are no matching tags\`, () => {
                    scenario(\`a non-tagged scenario\`, () => {
                        given("given within a scenario", () => {

                        });
                    });
                });
                """
                `, () => {
                    featureText = stepContext.docString;
                });

            when(`the feature is executed`, async () => {
                executionResults = await LiveDoc.executeDynamicTestAsync(featureText, liveDocOptions);
            });

            then(`'2' features are processed`, () => {
                executionResults.features.length.should.be.equal(stepContext.values[0]);
            });

            and(`the first scenarios steps are executed`, () => {
                // locate the second step that has the violation
                const keyword = executionResults.features[0].scenarios[0].steps[0];
                keyword.status.should.be.eq(SpecStatus.pass);
            });

            and(`the second scenarios steps are NOT executed`, () => {
                // locate the second step that has the violation
                const keyword = executionResults.features[0].scenarios[1].steps[0];
                keyword.status.should.be.eq(SpecStatus.unknown);
            });

            and(`the third scenarios steps are executed`, () => {
                // locate the second step that has the violation
                const keyword = executionResults.features[0].scenarios[2].steps[0];
                keyword.status.should.be.eq(SpecStatus.pass);
            });

            and(`the steps for the second feature are NOT executed`, () => {
                // locate the second step that has the violation
                const keyword = executionResults.features[1].scenarios[0].steps[0];
                keyword.status.should.be.eq(SpecStatus.unknown);
            });
        });

        scenario("Using include option to specify ScenarioOutline to execute", () => {
            given(`the filter is
        """
        {
            "include": ["filter:include"],
            "exclude": ["filter:exclude"]
        }
        """
        `, () => {
                    liveDocOptions.filters = stepContext.docStringAsEntity;
                });

            and(`the following features
        
        """
        feature(\`This features Scenarios are executed they match the tag\`, () => {
            scenarioOutline(\`a scenarioOutline within a tagged feature
                @filter:include

                Examples:
                | Col1  |
                | dummy |
                \`, () => {
                given("given within a scenario", () => {

                });
            });
            scenarioOutline(\`a scenario that's not executed due to exclude tag
                @filter:include
                @filter:exclude
                Examples:
                | Col1  |
                | dummy |
                \`, () => {
                given("given within a scenario", () => {

                });
            });
            scenarioOutline(\`another scenario within a tagged feature
                @filter:include

                Examples:
                | Col1  |
                | dummy |
                \`, () => {
                given("given within a scenario", () => {

                });
            });
        });

        feature(\`This feature is not executed as there are no matching tags\`, () => {
            scenarioOutline(\`a non-tagged scenario

                Examples:
                | Col1  |
                | dummy |
            
            \`, () => {
                given("given within a scenario", () => {

                });
            });
        });
        """
        `, () => {
                    featureText = stepContext.docString;
                });

            when(`the feature is executed`, async () => {
                executionResults = await LiveDoc.executeDynamicTestAsync(featureText, liveDocOptions);
            });

            then(`'2' features are processed`, () => {
                executionResults.features.length.should.be.equal(stepContext.values[0]);
            });

            and(`the first scenarios steps are executed`, () => {
                // locate the second step that has the violation
                const keyword = executionResults.features[0].scenarios[0] as ScenarioOutline;

                keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.pass);
            });

            and(`the second scenarios steps are NOT executed`, () => {
                // locate the second step that has the violation
                const keyword = executionResults.features[0].scenarios[1] as ScenarioOutline;

                keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.unknown);
            });

            and(`the third scenarios steps are executed`, () => {
                // locate the second step that has the violation
                const keyword = executionResults.features[0].scenarios[2] as ScenarioOutline;

                keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.pass);
            });

            and(`the steps for the second feature are NOT executed`, () => {
                // locate the second step that has the violation
                const keyword = executionResults.features[1].scenarios[0] as ScenarioOutline;

                keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.unknown);
            });
        });
    });