import { LiveDocSuite } from "./LiveDocSuite";
import { Specification } from "./Specification";
import { SpecStatus } from "./SpecStatus";
import { RuleContext } from "./RuleContext";
import { Exception } from "./Exception";

/**
 * Rule is a simple specification assertion.
 * Unlike Scenario, it doesn't have step functions (given/when/then).
 * The test body contains assertions directly.
 */
export class Rule extends LiveDocSuite {
    public parent!: Specification;
    public executionTime: number = 0;
    public status: SpecStatus = SpecStatus.unknown;
    public error?: Error;
    public code: string = "";
    public exception: Exception = new Exception();

    constructor(parent: Specification) {
        super();
        this.parent = parent;
    }

    public setStatus(status: SpecStatus, duration: number): void {
        this.status = status;
        this.executionTime = duration;
        this.parent.statistics.updateStats(status, duration);
    }

    public getRuleContext(): RuleContext {
        const context = new RuleContext();
        context.title = this.title;
        context.description = this.description;
        context.tags = this.tags;
        context.specification = this.parent.getSpecificationContext();
        return context;
    }

    toJSON(): object {
        return {
            ...super.toJSON(),
            executionTime: this.executionTime,
            status: this.status,
            error: this.error ? { message: this.error.message, stack: this.error.stack } : undefined
        };
    }
}
