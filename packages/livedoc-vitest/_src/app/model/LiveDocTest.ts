import { SpecStatus } from "./SpecStatus";
import { Exception } from "./Exception";
import { LiveDocSuite } from "./LiveDocSuite";
import { VitestSuite } from "./VitestSuite";

export class LiveDocTest<P extends LiveDocSuite | VitestSuite> {
    public parent: P;
    public id: string = "";
    public sequence: number = 0;
    public duration: number = 0;
    public status: SpecStatus = SpecStatus.unknown;
    public code: string = "";
    public exception: Exception = new Exception();

    constructor(parent: P, public title: string) {
        this.parent = parent;
    }

    public setStatus(status: SpecStatus, duration: number): void {
        this.status = status;
        this.duration = duration;
        this.parent.statistics.updateStats(status, duration);
    }

    toJSON(): object {
        return {
            id: this.id,
            title: this.title,
            sequence: this.sequence,
            duration: this.duration,
            status: this.status,
            code: this.code,
            exception: this.exception
        };
    }
}
