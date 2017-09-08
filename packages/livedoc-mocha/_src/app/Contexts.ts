module LiveDocContexts {


    class FeatureContext {
        filename: string;
        title: string;
        description: string;
        tags: string[];
    }


    class ScenarioContext {
        title: string;
        description: string;
        given: StepContext;
        and: StepContext[] = [];
        tags: string[];
    }


    class ScenarioOutlineContext extends ScenarioContext {
        example: Row;
    }

    class BackgroundContext extends ScenarioContext {

    }

    class StepContext {
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
}