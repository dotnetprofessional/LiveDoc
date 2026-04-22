import { describe, it } from 'vitest';

describe('Stack trace test', () => {
    it('should show stack', () => {
        console.log('Stack trace:');
        console.log(new Error().stack);
    });
});
