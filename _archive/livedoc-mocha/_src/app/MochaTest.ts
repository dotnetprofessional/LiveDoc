import * as mochaTest from "mocha/lib/test";

export class MochaTest extends mochaTest {
    constructor (title: string, wrappedFunction: Function, protected original: Function) {
        super(title, wrappedFunction);
    }
    run(fn) {
        super.run(fn);
        // reset the fn to the non-wrapped version for reporters to inspect
        (this as any).fn = this.original;
    }
}