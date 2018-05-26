import { ColorTheme } from "./ColorTheme";
import { DefaultColorTheme } from ".";

export class ReporterOptions {
    public colors: ColorTheme = new DefaultColorTheme();
    public options: Object;
}
