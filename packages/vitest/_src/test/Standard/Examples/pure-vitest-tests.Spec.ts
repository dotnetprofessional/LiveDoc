/**
 * Pure Vitest test - no LiveDoc dependencies
 * Used to test if VS Code extension debugging works with standard Vitest
 */
import { describe, it, expect, beforeEach } from 'vitest';

describe('Pure Vitest Tests', () => {
    let counter = 0;

    beforeEach(() => {
        counter = 0;
    });

    describe('Basic math', () => {
        it('should add numbers', () => {
            const result = 1 + 2;
            expect(result).toBe(3);
        });

        it('should multiply numbers', () => {
            const result = 3 * 4;
            expect(result).toBe(12);
        });
    });

    describe('Counter tests', () => {
        it('should increment counter', () => {
            counter++;
            expect(counter).toBe(1);
        });

        it('should start fresh each test', () => {
            // counter should be 0 due to beforeEach
            expect(counter).toBe(0);
            counter = 5;
            expect(counter).toBe(5);
        });
    });

    describe('Async tests', () => {
        it('should handle async operations', async () => {
            const result = await Promise.resolve(42);
            expect(result).toBe(42);
        });

        it('should handle delayed operations', async () => {
            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
            await delay(10);
            expect(true).toBe(true);
        });
    });
});
