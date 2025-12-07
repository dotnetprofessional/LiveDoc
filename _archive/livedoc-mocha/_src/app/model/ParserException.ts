import chalk from "chalk";

/**
 * Thrown when invalid syntax is encountered
 * 
 * @export
 * @class ParserException
 */
export class ParserException extends Error {
    constructor (public description: string, public title: string, public filename: string) {
        super();
        this.message = `${chalk.redBright(description)}\n${chalk.yellow("Title: " + title + "\nFilename: " + filename)}`;
    }
}