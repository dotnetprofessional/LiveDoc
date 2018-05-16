import { LiveDocTest } from "./LiveDocTest";
import { SuiteBase } from "./SuiteBase";
import { Statistics } from "./Statistics";

export class MochaSuite extends SuiteBase<MochaSuite> {
    constructor (parent: MochaSuite, title: string, public type: string) {
        super()
        this.title = title;
        this.statistics = new Statistics(this);
        this.parent = parent;
        Object.defineProperty(this, 'parent', {
            enumerable: false
        });
    }

    public filename: string;
    public parent: MochaSuite;
    public children: MochaSuite[] = [];
    public tests: LiveDocTest<MochaSuite>[] = [];
}