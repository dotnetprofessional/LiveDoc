import { Row } from "./Row";

export class StepContext {
    title: string;
    table: Row[];

    docString: string;

    get docStringAsEntity() {
        return JSON.parse(this.docString);
    }

    type: string;
    values: any[];

    tableAsEntity: Row;

    tableAsList: any[][];

    tableAsSingleList: any[];
}