import { Test } from "./Test";

// Legacy BDD model
export class Describe {
    constructor (public title: string, public type: string) {

    }
    public children: Describe[] = [];
    public tests: Test[] = [];
}