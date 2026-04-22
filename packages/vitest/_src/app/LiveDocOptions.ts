import { LiveDocRules } from "./LiveDocRules";
import { FilterOptions } from "./FilterOptions";
import { PublishOptions } from "./PublishOptions";

export class LiveDocOptions {
    public rules: LiveDocRules = new LiveDocRules();
    public filters: FilterOptions = new FilterOptions();
    public publish: PublishOptions = new PublishOptions();
    public postReporters: any[] = [];
    public isolatedMode: boolean = false;
}
