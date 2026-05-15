import { expect } from "vitest";
import { feature, scenario, given, when, Then as then, and } from "../../app/index";

class GettingStartedCalculator {
    private readonly entries: number[] = [];

    enter(value: number) {
        this.entries.push(value);
    }

    calculate(operation: string) {
        if (operation !== "add") {
            throw new Error(`The getting-started calculator only supports '${operation}' after the operation is documented in the step title.`);
        }

        return this.entries.reduce((total, value) => total + value, 0);
    }
}

feature(`First Feature: Add Numbers with LiveDoc
    @getting-started @bdd @first-feature @public-doc
    The smallest useful LiveDoc feature: a reader can see the setup, the action,
    and the expected result without opening the implementation.
    `, () => {
    scenario(`Adding two visible numbers displays the visible total
        @happy-path @calculator
        This is the first green experience: write the behavior in plain language,
        extract the values from the step context, then assert the documented result.
        `, () => {
        let calculator = new GettingStartedCalculator();
        let displayedTotal = 0;

        given("a new calculator is ready", () => {
            calculator = new GettingStartedCalculator();
        });

        and("the learner enters first number <first:50>", (ctx) => {
            calculator.enter(ctx.step.params.first);
        });

        and("the learner enters second number <second:70>", (ctx) => {
            calculator.enter(ctx.step.params.second);
        });

        when("the learner presses <operation:add>", (ctx) => {
            displayedTotal = calculator.calculate(ctx.step.params.operation);
        });

        then("the calculator displays <total:120>", (ctx) => {
            expect(displayedTotal).toBe(ctx.step.params.total);
        });
    });

    scenario(`Adding numbers from a table displays the documented total
        @data-table @calculator
        A data table keeps multiple inputs visible while still letting the step
        implementation read them from ctx.step.table.
        `, () => {
        let calculator = new GettingStartedCalculator();
        let displayedTotal = 0;

        given(`the learner enters these numbers:
            | number |
            |      3 |
            |      5 |
            |      7 |
            `, (ctx) => {
            calculator = new GettingStartedCalculator();
            for (const row of ctx.step.table) {
                calculator.enter(row.number);
            }
        });

        when("the learner presses <operation:add>", (ctx) => {
            displayedTotal = calculator.calculate(ctx.step.params.operation);
        });

        then("the calculator displays <total:15>", (ctx) => {
            expect(displayedTotal).toBe(ctx.step.params.total);
        });
    });
});
