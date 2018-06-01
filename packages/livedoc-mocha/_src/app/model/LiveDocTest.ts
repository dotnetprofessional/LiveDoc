import { SpecStatus } from "./SpecStatus";
import { Exception } from "./Exception";
import { LiveDocSuite, MochaSuite } from ".";

export class LiveDocTest<P extends LiveDocSuite | MochaSuite> {
    constructor (public parent: P, public title: string) {

    }
    public id: string;
    public sequence: number;
    public executionTime: number;
    public status: SpecStatus = SpecStatus.unknown;
    public code: string;
    public exception: Exception = new Exception();


    public setStatus(status: SpecStatus, elapsedTime: number) {
        this.status = status;
        this.parent.statistics.updateStats(status, elapsedTime);
    }
}