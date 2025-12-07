import { LiveDocTest } from "./LiveDocTest";
import { SuiteBase } from "./SuiteBase";
import { Statistics } from "./Statistics";

/**
 * Represents a Vitest describe/suite (non-Gherkin tests)
 * Replaces MochaSuite for Vitest compatibility
 */
export class VitestSuite extends SuiteBase<VitestSuite> {
    public parent?: VitestSuite;
    public children: VitestSuite[] = [];
    public tests: LiveDocTest<VitestSuite>[] = [];
    public filename: string = "";

    constructor(parent: VitestSuite | null, title: string, type: string) {
        super();
        if (parent) {
            this.parent = parent;
        }
        this.title = title;
        this.type = type;
        this.statistics = new Statistics(this);
    }

    toJSON(): object {
        return {
            type: this.type,
            title: this.title,
            filename: this.filename,
            children: this.children,
            tests: this.tests,
            statistics: this.statistics
        };
    }
}
