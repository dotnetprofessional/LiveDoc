import { SpecStatus } from "./SpecStatus";
import { Exception } from "./Exception";
import { jsonIgnore } from "../decorators/jsonIgnore";
import { LiveDocSuite } from "./LiveDocSuite";
import { MochaSuite } from "./MochaSuite";

export class LiveDocTest<P extends LiveDocSuite | MochaSuite> {
    constructor(parent: P, public title: string) {
        this.parent = parent;
    }
    @jsonIgnore
    public parent: P;
    public id: string;
    public sequence: number;
    public duration: number;
    public status: SpecStatus = SpecStatus.unknown;
    public code: string;
    public exception: Exception = new Exception();


    public setStatus(status: SpecStatus, duration: number) {
        this.status = status;
        this.duration = duration
        this.parent.statistics.updateStats(status, duration);
    }
}