import { SpecStatus } from "./SpecStatus";
import { Exception } from "./Exception";

export class Test {
    constructor (public title: string) {

    }

    public status: SpecStatus = SpecStatus.unknown;
    public code: string;
    public exception: Exception = new Exception();
}