import { Statistics } from "./Statistics";

export class SuiteBase<T> {
    constructor() {
        this.type = this.constructor.name;
    }
    public type: string;
    public id: string;
    public sequence: number;
    public statistics: Statistics<T>;

    public title: string;

    public tags: string[];
    public path: string;
}