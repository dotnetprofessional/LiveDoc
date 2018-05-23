import { ReporterTheme } from "./ReporterTheme";
import { ColorTheme } from "./ColorTheme";
import { DefaultReporter, DefaultColorTheme } from ".";

export class ReporterOptions {
    public reporter: ReporterTheme = new DefaultReporter();
    public colors: ColorTheme = new DefaultColorTheme();
    public options: Object;
}
