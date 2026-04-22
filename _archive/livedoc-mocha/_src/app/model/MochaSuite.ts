import { LiveDocTest } from "./LiveDocTest";
import { SuiteBase } from "./SuiteBase";
import { Statistics } from "./Statistics";
import { jsonIgnore } from "../decorators";

export class MochaSuite extends SuiteBase<MochaSuite> {
    constructor(parent: MochaSuite, title: string, public type: string) {
        super();
        this.title = title;
        this.statistics = new Statistics(this);
        this.parent = parent;
    }

    public filename: string;
    @jsonIgnore
    public parent: MochaSuite;
    public children: MochaSuite[] = [];
    public tests: LiveDocTest<MochaSuite>[] = [];
}