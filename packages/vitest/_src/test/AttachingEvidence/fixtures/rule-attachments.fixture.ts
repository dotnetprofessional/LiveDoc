import { expect } from "vitest";
import { specification, rule, ruleOutline } from "../../../app/livedoc";

specification("Execution evidence probe", () => {
    rule("A passing rule attaches 'dGVzdA==' as 'image/png' kind 'image' titled 'Chart'", ctx => {
        const [base64, mimeType, kind, title] = ctx.rule!.valuesRaw;
        ctx.rule!.attach(base64, { mimeType, kind: kind as "image", title });
    });

    rule("The failed rule retains 'rule-failure' evidence", ctx => {
        ctx.rule!.attachJSON({ value: ctx.rule!.valuesRaw[0] }, ctx.rule!.valuesRaw[0]);
        expect(false).toBe(true);
    });

    ruleOutline(`The example '<value>' retains evidence even when it fails
        Examples:
        | value |
        | first |
        | second |
        `, ctx => {
        ctx.rule!.attachJSON({ value: ctx.example!.value }, String(ctx.example!.value));
        ctx.rule!.attachScreenshot("cG5n", String(ctx.example!.value));
        ctx.rule!.attach("dGVzdA==", { title: String(ctx.example!.value) });
        expect(ctx.example!.value).toBe("first");
    });
});
