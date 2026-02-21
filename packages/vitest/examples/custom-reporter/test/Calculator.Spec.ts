import { feature, scenario, given, when, Then as then } from "@swedevtools/livedoc-vitest";
import { expect } from "vitest";

feature(`Calculator operations
    As a user
    I want to perform basic calculations
    So that I can get quick answers
`, () => {
    scenario("Adding two numbers", () => {
        let result: number;
        
        given("I have a calculator", () => {
            // Setup code here
        });
        
        when("I add 2 and 3", () => {
            result = 2 + 3;
        });
        
        then("I should get 5", () => {
            expect(result).toBe(5);
        });
    });
    
    scenario("Subtracting two numbers", () => {
        let result: number;
        
        given("I have a calculator", () => {
            // Setup code here
        });
        
        when("I subtract 3 from 10", () => {
            result = 10 - 3;
        });
        
        then("I should get 7", () => {
            expect(result).toBe(7);
        });
    });
    
    scenario("Multiplying two numbers", () => {
        let result: number;
        
        given("I have a calculator", () => {
            // Setup code here
        });
        
        when("I multiply 4 by 5", () => {
            result = 4 * 5;
        });
        
        then("I should get 20", () => {
            expect(result).toBe(20);
        });
    });
});
