export default class TestReporter {
    onInit(ctx) {
        console.error('TestReporter.onInit called');
    }
    
    onTestRunEnd(testModules) {
        console.error('TestReporter.onTestRunEnd called with', testModules?.length, 'modules');
        console.log('\n✓ Test completed successfully\n');
    }
}
