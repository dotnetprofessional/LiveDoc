import { LiveDocRules } from "./LiveDocRules";
import { FilterOptions } from "./FilterOptions";
import { ReporterOptions } from "./reporter";

export class LiveDocOptions {
    public constructor () {
    }
    public rules: LiveDocRules = new LiveDocRules();
    public filters: FilterOptions = new FilterOptions();
    public reporterOptions: ReporterOptions = new ReporterOptions();
}