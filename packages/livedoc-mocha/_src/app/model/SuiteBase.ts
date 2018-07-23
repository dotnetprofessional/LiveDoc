import { Statistics } from "./Statistics";

export class SuiteBase<T> {
    public id: string;
    public sequence: number;
    public statistics: Statistics<T>;

    public title: string;

    public tags: string[];
}