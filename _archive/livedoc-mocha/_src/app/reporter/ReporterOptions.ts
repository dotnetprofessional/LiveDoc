import { ColorTheme } from "./ColorTheme";
import { DefaultColorTheme } from "./DefaultColorTheme";

export class ReporterOptions {
    public colors: ColorTheme = new DefaultColorTheme();
    public options: Object;
}
