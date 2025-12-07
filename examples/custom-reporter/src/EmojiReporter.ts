import type { Reporter, File, TaskResultPack } from 'vitest';

/**
 * EmojiReporter - A custom Vitest reporter that outputs emoji for test results
 * 
 * This is a simple example showing how to create a custom reporter for Vitest.
 * For LiveDoc-aware reporters that understand Features, Scenarios, and Steps,
 * see the LiveDocSpecReporter in @livedoc/vitest.
 * 
 * Emojis used:
 * - 😃 Pass
 * - 😡 Fail
 * - 😴 Skip
 * - 🚀 Suite start
 * - ✨ Suite complete
 */
export class EmojiReporter implements Reporter {
    private passCount = 0;
    private failCount = 0;
    private skipCount = 0;
    private currentFile = '';

    /**
     * Called when test run starts
     */
    onInit(): void {
        console.log('\n🚀 Starting test run...\n');
    }

    /**
     * Called when a test file starts running
     */
    onCollected(files?: File[]): void {
        if (files) {
            files.forEach(file => {
                // Extract just the filename from the path
                const fileName = file.name.split(/[\\/]/).pop() || file.name;
                console.log(`📂 ${fileName}`);
            });
        }
    }

    /**
     * Called when individual test results come in
     */
    onTaskUpdate(packs: TaskResultPack[]): void {
        for (const pack of packs) {
            const [id, result] = pack;
            
            if (!result) continue;
            
            // Only process test results (not suites)
            if (result.state === 'pass') {
                this.passCount++;
                process.stdout.write('😃 ');
            } else if (result.state === 'fail') {
                this.failCount++;
                process.stdout.write('😡 ');
            } else if (result.state === 'skip') {
                this.skipCount++;
                process.stdout.write('😴 ');
            }
        }
    }

    /**
     * Called when all tests are complete
     */
    onFinished(files?: File[], errors?: unknown[]): void {
        console.log('\n');
        console.log('✨ Test run complete!\n');
        console.log('📊 Results:');
        console.log(`   😃 Passed: ${this.passCount}`);
        console.log(`   😡 Failed: ${this.failCount}`);
        console.log(`   😴 Skipped: ${this.skipCount}`);
        console.log(`   📝 Total: ${this.passCount + this.failCount + this.skipCount}`);
        console.log('');
        
        if (this.failCount > 0) {
            console.log('❌ Some tests failed!\n');
        } else {
            console.log('✅ All tests passed!\n');
        }
    }
}
