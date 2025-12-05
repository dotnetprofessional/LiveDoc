require('chai').should();
import { LiveDoc, feature, scenario, scenarioOutline, Given, When, Then, And } from "../../app/livedoc";
import { LiveDocRuleViolation, ExecutionResults, StepContext, ScenarioContext } from "../../app/model/index";
import { LiveDocRuleOption } from "../../app/LiveDocRuleOption";
import { LiveDocOptions } from "../../app/LiveDocOptions";

feature(`Validate step rules
    @dynamic

    There are some rules which are technically valid but are not recommended due to readability.
    These rules can be marked as Warning, Exception or Ignore. By default they are marked as warning.

    `, (ctx) => {
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
            `, (ctx) => {
                Given(`the livedoc rules are
                """
                {
                    "singleGivenWhenThen": "${LiveDocRuleOption.enabled}"
                }
                """
                `, (ctx) => {
                        ruleOptions.rules = ctx.step.docStringAsEntity!;
                    });

                And(`the following feature
                """
                import { feature, scenario, <step> } from './livedoc';
                
                feature("Validate the use of multiple steps", ()=> {
                    scenario("Multiple <step>s are used in a scenario", ()=>{
                        <step>("<step> sample 1", () => { });            
                        <step>("<step> sample 2", () => { });                
                    });
                });
                """
            `, (ctx) => {
                        outlineGiven = ctx.step;
                    });

                When(`executing feature`, async (ctx) => {
                    try {
                        await LiveDoc.executeDynamicTestAsync(outlineGiven.docString!, ruleOptions);
                    }
                    catch (e) {
                        violation = e;
                    }
                });

                Then(`a rule violation with the following description is thrown 
                """
                there should be only one <display name> in a Scenario, Scenario Outline or Background. Try using and or but instead.
                """`, (ctx) => {
                        ctx.step.docString.should.eql(violation.message);
                    });


            });

        scenarioOutline(`Using the same top level step multiple times
            Examples:
            | step  | display name |
            | given | Given        |
            | when  | When         |
            | then  | Then         |
            `, (ctx) => {
                Given(`the livedoc rules are
                """
                {
                    "singleGivenWhenThen": "${LiveDocRuleOption.warning}"
                }
                """
                `, (ctx) => {
                        ruleOptions.rules = ctx.step.docStringAsEntity!;
                    });

                And(`the following feature
                """
                import { feature, scenario, given, when, then, <step> } from './livedoc';
                
                feature("Validate the use of multiple steps", ()=> {
                    scenario("Multiple <step>s are used in a scenario", ()=>{
                        given("a given", ()=> {});
                        when("a when", ()=> {});
                        then("a then", ()=> {});
                        <step>("<step> duplicate", () => { });            
                    });
                });
                """
                    `, (ctx) => {
                        outlineGiven = ctx.step;
                    });

                When(`executing feature`, async (ctx) => {
                    executionResults = await LiveDoc.executeDynamicTestAsync(outlineGiven.docString!, ruleOptions);
                });

                Then(`a rule violation with the following description is added to the rule violations collection of the step
                """
                there should be only one <display name> in a Scenario, Scenario Outline or Background. Try using and or but instead.
                """`, (ctx) => {
                        // locate the second step that has the violation
                        const step = executionResults.features[0].scenarios[0].steps[3];
                        step.ruleViolations[0].message.should.be.eq(ctx.step.docString);
                    });


            });

        scenarioOutline(`Using secondary steps without a primary step
            
            The secondary steps and, but can only be used after a primary step given, when or then

            Examples:
            | step |
            | and  |
            | but  |
            `, (ctx) => {
                Given(`the livedoc rules are
                """
                {
                    "andButMustHaveGivenWhenThen": "${LiveDocRuleOption.warning}"
                }
                """
                `, (ctx) => {
                        ruleOptions.rules = ctx.step.docStringAsEntity!;
                    });

                And(`the following feature
                """
                import { feature, scenario, <step> } from './livedoc';
                
                feature("Validate the use of invalid use of secondary steps", ()=> {
                    scenario("Secondary step <step>s used without given, when or then", ()=>{
                        <step>("<step> sample", () => { });            
                    });
                });
                """
            `, (ctx) => {
                        outlineGiven = ctx.step;
                    });
                When(`executing feature`, async (ctx) => {
                    executionResults = await LiveDoc.executeDynamicTestAsync(outlineGiven.docString!, ruleOptions);
                });

                Then(`a rule violation with the following description is thrown 
                """
                <step> step definition must be preceded by a Given, When or Then.
                """`, (ctx) => {
                        // locate the second step that has the violation
                        const step = executionResults.features[0].scenarios[0].steps[0];
                        step.ruleViolations[0].message.should.be.eq(ctx.step.docString);
                    });
            });

        scenario(`Ensure keywords have titles`, (ctx) => {
            Given(`the livedoc rules are
                """
                {
                    "enforceTitle": "${LiveDocRuleOption.warning}"
                }
                """
                `, (ctx) => {
                    ruleOptions.rules = ctx.step.docStringAsEntity!;
                });

            And(`the following feature
                """
                import { feature, scenario, scenarioOutline, given, when, then, and, but } from './livedoc';
                
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
            `, (ctx) => {
                    outlineGiven = ctx.step;
                });

            When(`executing feature`, async (ctx) => {
                executionResults = await LiveDoc.executeDynamicTestAsync(outlineGiven.docString!, ruleOptions);
            });

            Then(`the feature has following rule violation added 
                """
                Feature seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, (ctx) => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0];
                    keyword.ruleViolations[0].message.should.be.eq(ctx.step.docString);
                });

            And(`the scenarioOutline has following rule violation added 
                """
                Scenario Outline seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, (ctx) => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[1];
                    keyword.ruleViolations[0].message.should.be.eq(ctx.step.docString);
                });

            And(`the scenario has following rule violation added 
                """
                Scenario seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, (ctx) => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[0];
                    keyword.ruleViolations[0].message.should.be.eq(ctx.step.docString);
                });

            And(`the Given has following rule violation added 
                """
                Given seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, (ctx) => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[0].steps[0];
                    keyword.ruleViolations[0].message.should.be.eq(ctx.step.docString);
                });

            And(`the When has following rule violation added 
                """
                When seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, (ctx) => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[0].steps[1];
                    keyword.ruleViolations[0].message.should.be.eq(ctx.step.docString);
                });

            And(`the Then has following rule violation added 
                """
                Then seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, (ctx) => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[0].steps[2];
                    keyword.ruleViolations[0].message.should.be.eq(ctx.step.docString);
                });

            And(`the and has following rule violation added 
                """
                and seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, (ctx) => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[0].steps[3];
                    keyword.ruleViolations[0].message.should.be.eq(ctx.step.docString);
                });

            And(`the but has following rule violation added 
                """
                but seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, (ctx) => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[0].steps[4];
                    keyword.ruleViolations[0].message.should.be.eq(ctx.step.docString);
                });
        });

        scenario(`Using before instead of given in scenario`, (ctx) => {
            Given(`the livedoc rules are
            """
            {
                "enforceUsingGivenOverBefore": "${LiveDocRuleOption.warning}"
            }
            """
            `, (ctx) => {
                    ruleOptions.rules = ctx.step.docStringAsEntity!;
                });

            And(`the following feature
            """
            import { feature, scenario, when, before } from './livedoc';
            
            feature("Enforce using given over before()", ()=> {
                scenario("A scenario that uses a before()", ()=>{
                    before(() => { });
                    when("some condition", () => { });            
                });
            });
            """
            `, (ctx) => {
                    outlineGiven = ctx.step;
                });

            When(`executing feature`, async (ctx) => {
                executionResults = await LiveDoc.executeDynamicTestAsync(outlineGiven.docString!, ruleOptions);
            });

            Then(`a rule violation with the following description is thrown 
                """
                Using before does not help with readability, consider using a given instead.
                """`, (ctx) => {
                    // locate the second step that has the violation
                    const scenario = executionResults.features[0].scenarios[0];
                    scenario.ruleViolations[0].message.should.be.eq(ctx.step.docString);
                });
        });

        // Currently not implemented - skip functionality not yet available for scenarioOutline
        /*
        scenarioOutline(`Ensure given, when and then exist for a scenario
            Examples:
            | step | missing step |
            | when | given        |
            | then | when         |

           `, (ctx) => {
                Given(`the livedoc rules are
                    """
                    {
                        "givenWhenThenMustBeWithinScenario": "${LiveDocRuleOption.warning}"
                    }
                    """
            `, (ctx) => {
                        ruleOptions.rules = ctx.step.docStringAsEntity!;
                    });

                And(`the following feature
                    """
                    import { feature, scenario, <step> } from './livedoc';
                    
                    feature(\`Ensure a Given, When and Then exists
                    as nothing comes after a Then definition it is not possible for the
                    model to validate that one exists as the model is built up a step at a time.
                
                    \`, () => {
                        scenario("no given is used in scenario", () => {
                            <step>("<step> is used without a <missing step>", () => { });
                        });
                    });
                    """
            `, (ctx) => {
                        outlineGiven = ctx.step;
                    });

                When(`executing feature`, async (ctx) => {
                    executionResults = await LiveDoc.executeDynamicTestAsync(outlineGiven.docString!, ruleOptions);
                });

                Then(`a rule violation with the following description is thrown 
                """
                Using before does not help with readability, consider using a given instead.
                """`, (ctx) => {
                        // locate the step that has the violation
                        const step = executionResults.features[0].scenarios[0].steps[0];
                        step.ruleViolations[0].message.should.be.eq(ctx.step.docString);
                    });
            });
        */

    });

