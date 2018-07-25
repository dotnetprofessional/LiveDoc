export enum ScenarioStatus {
    unknown = 0,
    pass = 1 << 0,
    fail = 1 << 1,
    pending = 1 << 2,
    passPending = pass | pending,
    failPending = fail | pending
}