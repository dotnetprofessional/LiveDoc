import { SpecificationContext } from "./SpecificationContext";

/**
 * Framework metadata about the rule.
 * Provides title, description, tags, and extracted values/params from the rule title.
 *
 * @example
 * ```typescript
 * rule("Adding '5' and '3' returns '8'", (ctx) => {
 *     const [a, b, expected] = ctx.rule.values; // [5, 3, 8]
 *     expect(a + b).toBe(expected);
 * });
 *
 * rule("Processing <action:login> for <user:alice>", (ctx) => {
 *     const action = ctx.rule.params.action; // "login"
 * });
 * ```
 */
export class RuleContext {
    title: string = "";
    description: string = "";
    tags: string[] = [];
    specification!: SpecificationContext;

    /** Extracted and type-coerced quoted values from the rule title. */
    values: any[] = [];
    /** Raw string values before type coercion. */
    valuesRaw: string[] = [];
    /** Extracted and type-coerced named parameters from <name:value> patterns. */
    params: Record<string, any> = {};
    /** Raw string named parameters before type coercion. */
    paramsRaw: Record<string, string> = {};
}
