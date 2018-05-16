import { LiveDocRules } from "./LiveDocRules";
import { FilterOptions } from "./FilterOptions";

export class LiveDocOptions {
    rules: LiveDocRules = new LiveDocRules();
    filters: FilterOptions = new FilterOptions();
}