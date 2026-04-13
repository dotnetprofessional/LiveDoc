export class PublishOptions {
    /** Server URL, e.g., 'http://localhost:3100' */
    public server: string = "http://localhost:3100";
    /** Project name (defaults to 'default') */
    public project: string = "default";
    /** Environment name (defaults to 'local') */
    public environment: string = "local";
    /** Whether publishing is enabled */
    public enabled: boolean = false;
}
