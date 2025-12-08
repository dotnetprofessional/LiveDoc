import { SpecificationContext } from "./SpecificationContext";

/**
 * Framework metadata about the rule
 * READ-ONLY - contains title/description/tags/specification reference
 * NOT for user test data! Use local variables instead.
 */
export class RuleContext {
    title: string = "";
    description: string = "";
    tags: string[] = [];
    specification!: SpecificationContext;
}
