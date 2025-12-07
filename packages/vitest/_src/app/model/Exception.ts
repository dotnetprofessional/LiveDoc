export class Exception {
    actual: string = "";
    expected: string = "";
    message: string = "";
    stackTrace: string = "";

    toJSON(): object {
        // Only include properties that have values
        const result: Record<string, string> = {};
        if (this.message) result.message = this.message;
        if (this.stackTrace) result.stackTrace = this.stackTrace;
        if (this.actual) result.actual = this.actual;
        if (this.expected) result.expected = this.expected;
        return result;
    }
}
