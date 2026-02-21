import { defineConfig } from 'vitest/config';
import { EmojiReporter } from './src/EmojiReporter';

export default defineConfig({
    test: {
        include: ['test/**/*.Spec.ts'],
        reporters: [new EmojiReporter()],
        // Disable default reporter output
        outputFile: undefined,
    },
});
