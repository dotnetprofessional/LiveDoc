import { feature, scenario, given, when, Then as then, and } from "../app/livedoc";
import * as chai from 'chai';
chai.should();

feature(`Step Named Values
    Step statements can include named values using the <name:value> syntax.
    These values are extracted and made available via ctx.step.params.<name>.`
    , (ctx) => {

    scenario("Step statement has named values", (ctx) => {
        let params: any;
        given("a user with <name:John> and <age:30> years old", (ctx) => {
            params = ctx.step!.params;
        });

        when("the step is parsed", () => { });

        then("the params should contain the named values", (ctx) => {
            chai.expect(params.name).to.equal("John");
            chai.expect(params.age).to.equal(30);
        });
    });

    scenario("Step statement has named values with different types", (ctx) => {
        let params: any;
        given('a config with <active:true>, <count:10>, and <tags:["a", "b"]>', (ctx) => {
            params = ctx.step!.params;
        });

        when("the step is parsed", () => { });

        then("the params should be correctly coerced", (ctx) => {
            chai.expect(params.active).to.equal(true);
            chai.expect(params.count).to.equal(10);
            chai.expect(params.tags).to.deep.equal(['a', 'b']);
        });
    });

    scenario("Step statement has both quoted and named values", (ctx) => {
        let params: any;
        let values: any[];
        given("a user 'John' with <age:30> and 'active' status", (ctx) => {
            params = ctx.step!.params;
            values = ctx.step!.values;
        });

        when("the step is parsed", () => { });

        then("both should be extracted correctly", (ctx) => {
            chai.expect(params.age).to.equal(30);
            chai.expect(values).to.deep.equal(["John", "active"]);
        });
    });

    scenario("Step statement has named values with spaces in names", (ctx) => {
        let params: any;
        given("a user with <user name:John> and <user age:30>", (ctx) => {
            params = ctx.step!.params;
        });

        when("the step is parsed", () => { });

        then("the names should be sanitized (spaces removed)", (ctx) => {
            chai.expect(params.username).to.equal("John");
            chai.expect(params.userage).to.equal(30);
        });
    });

    scenario("Step statement has named values that look like scenario outline placeholders", (ctx) => {
        // This scenario tests that <name:value> is treated as a named value,
        // while <name> (without colon) is NOT treated as a named value by the step parser
        // (it's usually handled by the scenario outline binder before reaching the step parser,
        // but we want to ensure the step parser doesn't misinterpret it if it somehow gets through).
        let params: any;
        given("a step with <named:value> and <placeholder>", (ctx) => {
            params = ctx.step!.params;
        });

        when("the step is parsed", () => { });

        then("only the colon-syntax should be in params", (ctx) => {
            chai.expect(params).to.have.property("named", "value");
            chai.expect(params).to.not.have.property("placeholder");
        });
    });
});
