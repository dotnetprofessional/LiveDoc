require('chai').should();
import { LiveDoc, feature, scenario, scenarioOutline, given, when, Then as then, and } from "../../app/livedoc";
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
            | given | given        |
            | when  | when         |
            | then  | then         |
            `, (ctx) => {
                given(`the livedoc rules are
                """
                {
                    "singleGivenWhenThen": "${LiveDocRuleOption.enabled}"
                }
                """
                `, (ctx) => {
                        ruleOptions.rules = ctx.step.docStringAsEntity!;
                    });

                and(`the following feature
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

                when(`executing feature`, async (ctx) => {
                    try {
                        await LiveDoc.executeDynamicTestAsync(outlineGiven.docString!, ruleOptions);
                    }
                    catch (e) {
                        violation = e;
                    }
                });

                then(`a rule violation with the following description is thrown 
                """
                there should be only one <display name> in a Scenario, Scenario Outline or Background. Try using and or but instead.
                """`, (ctx) => {
                        ctx.step.docString.should.eql(violation.message);
                    });


            });

        scenarioOutline(`Using the same top level step multiple times
            Examples:
            | step  | display name |
            | given | given        |
            | when  | when         |
            | then  | then         |
            `, (ctx) => {
                given(`the livedoc rules are
                """
                {
                    "singleGivenWhenThen": "${LiveDocRuleOption.warning}"
                }
                """
                `, (ctx) => {
                        ruleOptions.rules = ctx.step.docStringAsEntity!;
                    });

                and(`the following feature
                """
                import { feature, scenario, given, when, Then as then, <step> } from './livedoc';
                
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

                when(`executing feature`, async (ctx) => {
                    executionResults = await LiveDoc.executeDynamicTestAsync(outlineGiven.docString!, ruleOptions);
                });

                then(`a rule violation with the following description is added to the rule violations collection of the step
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
                given(`the livedoc rules are
                """
                {
                    "andButMustHaveGivenWhenThen": "${LiveDocRuleOption.warning}"
                }
                """
                `, (ctx) => {
                        ruleOptions.rules = ctx.step.docStringAsEntity!;
                    });

                and(`the following feature
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
                when(`executing feature`, async (ctx) => {
                    executionResults = await LiveDoc.executeDynamicTestAsync(outlineGiven.docString!, ruleOptions);
                });

                then(`a rule violation with the following description is thrown 
                """
                <step> step definition must be preceded by a given, when or then.
                """`, (ctx) => {
                        // locate the second step that has the violation
                        const step = executionResults.features[0].scenarios[0].steps[0];
                        step.ruleViolations[0].message.should.be.eq(ctx.step.docString);
                    });
            });

        scenario(`Ensure keywords have titles`, (ctx) => {
            given(`the livedoc rules are
                """
                {
                    "enforceTitle": "${LiveDocRuleOption.warning}"
                }
                """
                `, (ctx) => {
                    ruleOptions.rules = ctx.step.docStringAsEntity!;
                });

            and(`the following feature
                """
                import { feature, scenario, scenarioOutline, given, when, Then as then, and, but } from './livedoc';
                
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

            when(`executing feature`, async (ctx) => {
                executionResults = await LiveDoc.executeDynamicTestAsync(outlineGiven.docString!, ruleOptions);
            });

            then(`the feature has following rule violation added 
                """
                Feature seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, (ctx) => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0];
                    (keyword.ruleViolations[0].message as any).should.be.eq(ctx.step.docString);
                });

            and(`the scenarioOutline has following rule violation added 
                """
                Scenario Outline seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, (ctx) => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[1];
                    (keyword.ruleViolations[0].message as any).should.be.eq(ctx.step.docString);
                });

            and(`the scenario has following rule violation added 
                """
                Scenario seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, (ctx) => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[0];
                    keyword.ruleViolations[0].message.should.be.eq(ctx.step.docString);
                });

            and(`the given has following rule violation added 
                """
                given seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, (ctx) => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[0].steps[0];
                    keyword.ruleViolations[0].message.should.be.eq(ctx.step.docString);
                });

            and(`the when has following rule violation added 
                """
                when seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, (ctx) => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[0].steps[1];
                    keyword.ruleViolations[0].message.should.be.eq(ctx.step.docString);
                });

            and(`the then has following rule violation added 
                """
                then seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, (ctx) => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[0].steps[2];
                    keyword.ruleViolations[0].message.should.be.eq(ctx.step.docString);
                });

            and(`the and has following rule violation added 
                """
                and seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, (ctx) => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[0].steps[3];
                    keyword.ruleViolations[0].message.should.be.eq(ctx.step.docString);
                });

            and(`the but has following rule violation added 
                """
                but seems to be missing a title. Titles are important to convey the meaning of the Spec.
                """`, (ctx) => {
                    // locate the second step that has the violation
                    const keyword = executionResults.features[0].scenarios[0].steps[4];
                    keyword.ruleViolations[0].message.should.be.eq(ctx.step.docString);
                });
        });

        scenario(`Scenario with Background given does not violate mustIncludeGiven`, (ctx) => {
            given(`the livedoc rules are
                """
                {
                    "mustIncludeGiven": "${LiveDocRuleOption.warning}"
                }
                """
                `, (ctx) => {
                    ruleOptions.rules = ctx.step.docStringAsEntity!;
                });

            and(`the following feature
                """
                import { feature, background, scenario, given, when, Then as then } from './livedoc';
                
                feature("Background provides a given", ()=> {
                    background("Background sets preconditions", ()=> {
                        given("some precondition exists", ()=> {});
                    });
                    scenario("Scenario relies on Background", ()=>{
                        when("an action occurs", ()=> {});
                        then("an assertion passes", ()=> {});
                    });
                });
                """
                `, (ctx) => {
                    outlineGiven = ctx.step;
                });

            when(`executing feature`, async () => {
                executionResults = await LiveDoc.executeDynamicTestAsync(outlineGiven.docString!, ruleOptions);
            });

            then(`the scenario when step has no rule violations`, () => {
                const whenStep = executionResults.features[0].scenarios[0].steps[0];
                ((whenStep.ruleViolations || []).length as any).should.be.equal(0);
            });
        });

        scenario(`Using before instead of given in scenario`, (ctx) => {
            given(`the livedoc rules are
            """
            {
                "enforceUsingGivenOverBefore": "${LiveDocRuleOption.warning}"
            }
            """
            `, (ctx) => {
                    ruleOptions.rules = ctx.step.docStringAsEntity!;
                });

            and(`the following feature
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

            when(`executing feature`, async (ctx) => {
                executionResults = await LiveDoc.executeDynamicTestAsync(outlineGiven.docString!, ruleOptions);
            });

            then(`a rule violation with the following description is thrown 
                """
                Using before does not help with readability, consider using a given instead.
                """`, (ctx) => {
                    // locate the second step that has the violation
                    const scenario = executionResults.features[0].scenarios[0];
                    (scenario.ruleViolations[0].message as any).should.be.eq(ctx.step.docString);
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
                given(`the livedoc rules are
                    """
                    {
                        "givenWhenThenMustBeWithinScenario": "${LiveDocRuleOption.warning}"
                    }
                    """
            `, (ctx) => {
                        ruleOptions.rules = ctx.step.docStringAsEntity!;
                    });

                and(`the following feature
                    """
                    import { feature, scenario, <step> } from './livedoc';
                    
                    feature(\`Ensure a given, when and then exists
                    as nothing comes after a then definition it is not possible for the
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

                when(`executing feature`, async (ctx) => {
                    executionResults = await LiveDoc.executeDynamicTestAsync(outlineGiven.docString!, ruleOptions);
                });

                then(`a rule violation with the following description is thrown 
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

