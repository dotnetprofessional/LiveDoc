export enum ScenarioStatus {
    unknown = 0,
    pass = 1,
    fail = 2,
    pending = 4,
    passPending = pass | pending,
    failPending = fail | pending
}