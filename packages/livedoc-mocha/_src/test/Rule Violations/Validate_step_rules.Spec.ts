import { LiveDoc } from "../../app/livedoc";
import { LiveDocRuleViolation, ExecutionResults } from "../../app/model";
import { LiveDocRuleOption } from "../../app/LiveDocRuleOption";
import { LiveDocOptions } from "../../app/LiveDocOptions";
require('chai').should();


feature(`Validate step rules

    There are some rules which are technically valid but are not recommended due to readability.
    These rules can be marked as Warning, Exception or Ignore. By default they are marked as warning.

    `, () => {
        let violation: LiveDocRuleViolation;
        let outlineGiven: StepContext;
        let ruleOptions: LiveDocOptions = new LiveDocOptions();
        let executionResults: ExecutionResults;

        scenarioOutline(`Setting the LiveDocOptions to enabled for rules
            Examples:
            | step  | display name |
            | given | Given        |
            | when  | When         |
            | then  | Then         |
            `, () => {
                given(`the livedoc rules are
                """
                {
                    "singleGivenWhenThen": "${LiveDocRuleOption.enabled}"
                }
                """
                `, () => {
                        ruleOptions.rules = stepContext.docStringAsEntity;
                    });

                and(`the following feature
                """
                feature("Validate the use of multiple steps", ()=> {
                    scenario("Multiple <step>s are used in a scenario", ()=>{
                        <step>("<step> sample 1", () => { });            
                        <step>("<step> sample 2", () => { });                
                    });
                });
                """
            `, () => {
                        outlineGiven = stepContext;
                    });

                when(`executing feature`, async () => {
                    try {
                        await LiveDoc.executeDynamicTestAsync(outlineGiven.docString, ruleOptions);
                    }
                    catch (e) {
                        violation = e;
                    }
                });

                then(`a rule violation with the following description is thrown 
                """
                there should be only one <display name> in a Scenario, Scenario Outline or Background. Try using and or but instead.
                """`, () => {
                        stepContext.docString.should.eql(violation.message);
                    });


            });

        scenarioOutline(`Using the same top level step multiple times
            Examples:
            | step  | display name |
            | given | Given        |
            | when  | When         |
            | then  | Then         |
            `, () => {
                given(`the livedoc rules are
                """
                {
                    "singleGivenWhenThen": "${LiveDocRuleOption.warning}"
                }
                """
                `, () => {
                        ruleOptions.rules = stepContext.docStringAsEntity;
                    });

                and(`the following feature
                """
                feature("Validate the use of multiple steps", ()=> {
                    scenario("Multiple <step>s are used in a scenario", ()=>{
                        given("a given", ()=> {});
                        when("a when", ()=> {});
                        then("a then", ()=> {});
                        <step>("<step> duplicate", () => { });            
                    });
                });
                """
                    `, () => {
                        outlineGiven = stepContext as StepContext;
                    });

                when(`executing feature`, async () => {
                    executionResults = await LiveDoc.executeDynamicTestAsync(outlineGiven.docString, ruleOptions);
                });

                then(`a rule violation with the following description is added to the rule violations collection of the step
                """
                there should be only one <display name> in a Scenario, Scenario Outline or Background. Try using and or but instead.
                """`, () => {
                        // locate the second step that has the violation
                        const step = executionResults.features[0].scenarios[0].steps[3];
                        step.ruleViolations[0].message.should.be.eq(stepContext.docString);
                    });


            });

        scenarioOutline(`Using secondary steps without a primary step
            
            The secondary steps and, but can only be used after a primary step given, when or then

            Examples:
            | step |
            | and  |
            | but  |
            `, () => {
                given(`the livedoc rules are
                """
                {
                    "andButMustHaveGivenWhenThen": "${LiveDocRuleOption.warning}"
                }
                """
                `, () => {
                        ruleOptions.rules = stepContext.docStringAsEntity;
                    });

                and(`the following feature
                """
                feature("Validate the use of invalid use of secondary steps", ()=> {
                    scenario("Secondary step <step>s used without given, when or then", ()=>{
                        <step>("<step> sample", () => { });            
                    });
                });
                """
            `, () => {
                        outlineGiven = stepContext;
                    });
                when(`executing feature`, async () => {
                    executionResults = await LiveDoc.executeDynamicTestAsync(outlineGiven.docString, ruleOptions);
                });

                then(`a rule violation with the following description is thrown 
                """
                <step> step definition must be preceded by a Given, When or Then.
                """`, () => {
                        // locate the second step that has the violation
                        const step = executionResults.features[0].scenarios[0].steps[0];
                        step.ruleViolations[0].message.should.be.eq(stepContext.docString);
                    });
            });

        scenario(`Ensure keywords have titles`, () => {
            given(`the livedoc rules are
                """
                {
                    "enforceTitle": "${LiveDocRuleOption.warning}"
                }
                """
                `, () => {
                    ruleOptions.rules = stepContext.docStringAsEntity;
                });

            and(`the following feature
                """
                feature("", ()=> {
                    scenario("", ()=>{
                        given("", () => { });            
                        when("", () => { });            
                        then("", () => { });            
                        and("", () => { });            
                        but("", () => { });            
                    });
                    scenarioOutline(\`
                        Examples:
                        | col1  |
                        | row 1 |
                        \`, ()=>{
                            given("", ()=>{});
                        });
                });
                """
            `, () => {
                    outlineGiven = stepContext;
                });

            when(`executing feature`, async () => {
                executionResults = await LiveDoc.executeDynamicTestAsync(outlineGiven.docString, ruleOptions);
            });

            then(`the feature has following rule violation added 
                """
                Feature seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, () => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0];
                    keyword.ruleViolations[0].message.should.be.eq(stepContext.docString);
                });

            and(`the scenarioOutline has following rule violation added 
                """
                Scenario Outline seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, () => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[1];
                    keyword.ruleViolations[0].message.should.be.eq(stepContext.docString);
                });

            and(`the scenario has following rule violation added 
                """
                Scenario seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, () => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[0];
                    keyword.ruleViolations[0].message.should.be.eq(stepContext.docString);
                });

            and(`the Given has following rule violation added 
                """
                Given seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, () => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[0].steps[0];
                    keyword.ruleViolations[0].message.should.be.eq(stepContext.docString);
                });

            and(`the When has following rule violation added 
                """
                When seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, () => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[0].steps[1];
                    keyword.ruleViolations[0].message.should.be.eq(stepContext.docString);
                });

            and(`the Then has following rule violation added 
                """
                Then seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, () => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[0].steps[2];
                    keyword.ruleViolations[0].message.should.be.eq(stepContext.docString);
                });

            and(`the and has following rule violation added 
                """
                and seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, () => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[0].steps[3];
                    keyword.ruleViolations[0].message.should.be.eq(stepContext.docString);
                });

            and(`the but has following rule violation added 
                """
                but seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, () => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[0].steps[4];
                    keyword.ruleViolations[0].message.should.be.eq(stepContext.docString);
                });
        });

        scenario(`Using before instead of given in scenario`, () => {
            given(`the livedoc rules are
            """
            {
                "enforceUsingGivenOverBefore": "${LiveDocRuleOption.warning}"
            }
            """
            `, () => {
                    ruleOptions.rules = stepContext.docStringAsEntity;
                });

            and(`the following feature
            """
            feature("Enforce using given over before()", ()=> {
                scenario("A scenario that uses a before()", ()=>{
                    before(() => { });
                    when("some condition", () => { });            
                });
            });
            """
            `, () => {
                    outlineGiven = stepContext;
                });

            when(`executing feature`, async () => {
                executionResults = await LiveDoc.executeDynamicTestAsync(outlineGiven.docString, ruleOptions);
            });

            then(`a rule violation with the following description is thrown 
                """
                Using before does not help with readability, consider using a given instead.
                """`, () => {
                    // locate the second step that has the violation
                    const scenario = executionResults.features[0].scenarios[0];
                    scenario.ruleViolations[0].message.should.be.eq(stepContext.docString);
                });
        });

        // Currently not implemented
        scenarioOutline.skip(`Ensure given, when and then exist for a scenario
            Examples:
            | step | missing step |
            | when | given        |
            | then | when         |

           `, () => {
                given(`the livedoc rules are
                    """
                    {
                        "givenWhenThenMustBeWithinScenario": "${LiveDocRuleOption.warning}"
                    }
                    """
            `, () => {
                        ruleOptions.rules = stepContext.docStringAsEntity;
                    });

                and(`the following feature
                    """
                    feature(\`Ensure a Given, When and Then exists
                    as nothing comes after a Then definition it is not possible for the
                    model to validate that one exists as the model is built up a step at a time.
                
                    \`, () => {
                        scenario("no given is used in scenario", () => {
                            <step>("<step> is used without a <missing step>", () => { });
                        });
                    });
                    """
            `, () => {
                        outlineGiven = stepContext;
                    });

                when(`executing feature`, async () => {
                    executionResults = await LiveDoc.executeDynamicTestAsync(outlineGiven.docString, ruleOptions);
                });

                then(`a rule violation with the following description is thrown 
                """
                Using before does not help with readability, consider using a given instead.
                """`, () => {
                        // locate the step that has the violation
                        const step = executionResults.features[0].scenarios[0].steps[0];
                        step.ruleViolations[0].message.should.be.eq(stepContext.docString);
                    });
            });

    });
