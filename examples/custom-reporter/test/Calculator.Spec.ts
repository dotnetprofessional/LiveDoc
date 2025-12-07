import { feature, scenario, Given, When, Then } from "@livedoc/vitest";
import { expect } from "vitest";

feature(`Calculator operations
    As a user
    I want to perform basic calculations
    So that I can get quick answers
`, () => {
    scenario("Adding two numbers", () => {
        let result: number;
        
        Given("I have a calculator", () => {
            // Setup code here
        });
        
        When("I add 2 and 3", () => {
            result = 2 + 3;
        });
        
        Then("I should get 5", () => {
            expect(result).toBe(5);
        });
    });
    
    scenario("Subtracting two numbers", () => {
        let result: number;
        
        Given("I have a calculator", () => {
            // Setup code here
        });
        
        When("I subtract 3 from 10", () => {
            result = 10 - 3;
        });
        
        Then("I should get 7", () => {
            expect(result).toBe(7);
        });
    });
    
    scenario("Multiplying two numbers", () => {
        let result: number;
        
        Given("I have a calculator", () => {
            // Setup code here
        });
        
        When("I multiply 4 by 5", () => {
            result = 4 * 5;
        });
        
        Then("I should get 20", () => {
            expect(result).toBe(20);
        });
    });
});
