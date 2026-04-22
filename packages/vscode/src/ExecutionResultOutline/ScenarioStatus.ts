export enum ScenarioStatus {
    unknown = 0,
    pass = 1 << 0,                      // 1
    fail = 1 << 1,                      // 2
    pending = 1 << 2,                   // 4
    passPending = pass | pending,       // 5
    failPending = fail | pending,       // 6
    passFailPending = fail | pending    // 7
}