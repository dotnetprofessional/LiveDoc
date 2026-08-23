export class PublishOptions {
    /** Server URL, e.g., 'http://localhost:3100' */
    public server: string = "http://localhost:3100";
    /** Project name (defaults to 'livedoc') */
    public project: string = "livedoc";
    /** Environment name (defaults to 'local') */
    public environment: string = "local";
    /** Whether the invocation reports the complete test inventory or a focused subset. */
    public runType: "full" | "partial" = "full";
    /** Whether publishing is enabled */
    public enabled: boolean = false;
}
