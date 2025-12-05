import { LiveDocRules } from "./LiveDocRules";
import { FilterOptions } from "./FilterOptions";

export class LiveDocOptions {
    public rules: LiveDocRules = new LiveDocRules();
    public filters: FilterOptions = new FilterOptions();
    public postReporters: any[] = [];
    public isolatedMode: boolean = false;
}
