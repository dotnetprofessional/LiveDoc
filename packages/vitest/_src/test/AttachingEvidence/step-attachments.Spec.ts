/**
 * Step Attachments
 *
 * Validates the StepContext attachment API (attach, attachScreenshot, attachJSON)
 * using the framework-provided ctx.step — proving the full pipeline from
 * step execution → StepDefinition → reporter → server output.
 */

import { feature, scenario, when, Then as then, and } from "../../app/livedoc";
import { expect } from "vitest";
import type { Attachment } from "@swedevtools/livedoc-schema";
import { generateScreenshot } from "../Attachments/generate-test-image";

feature(`Step Attachments
    @attaching-evidence @attachments @public-doc
    Validates the ctx.step attachment API end-to-end.
    Each test calls ctx.step.attach() on the real framework context,
    then verifies the data is captured and flows through the reporter.
    `, () => {

    // =========================================================================
    // Basic attach() via ctx.step
    // =========================================================================

    scenario("Attaching data with default options", () => {
        let attachment: Attachment;

        when("attaching base64 data 'dGVzdA==' via ctx.step with no options", (ctx) => {
            ctx.step.attach(ctx.step.valuesRaw[0]);
            attachment = ctx.step.attachments[0];
        });

        then("the attachment kind should be 'file'", (ctx) => {
            expect(attachment.kind).toBe(ctx.step.valuesRaw[0]);
        });

        and("the mimeType should be 'application/octet-stream'", (ctx) => {
            expect(attachment.mimeType).toBe(ctx.step.valuesRaw[0]);
        });

        and("the base64 data should be 'dGVzdA=='", (ctx) => {
            expect(attachment.base64).toBe(ctx.step.valuesRaw[0]);
        });

        and("the attachment should have a defined ID", () => {
            expect(attachment.id).toBeDefined();
            expect(attachment.id.length).toBeGreaterThan(0);
        });
    });

    scenario("Attaching data with custom mimeType 'text/plain' and kind 'image'", () => {
        let attachment: Attachment;

        when("attaching data with mimeType 'text/plain' and kind 'image' via ctx.step", (ctx) => {
            ctx.step.attach("aGVsbG8=", {
                mimeType: ctx.step.valuesRaw[0],
                kind: ctx.step.valuesRaw[1] as "image",
            });
            attachment = ctx.step.attachments[0];
        });

        then("the mimeType should be 'text/plain'", (ctx) => {
            expect(attachment.mimeType).toBe(ctx.step.valuesRaw[0]);
        });

        and("the kind should be 'image'", (ctx) => {
            expect(attachment.kind).toBe(ctx.step.valuesRaw[0]);
        });
    });

    scenario("Attaching data with title 'My Report'", () => {
        let attachment: Attachment;

        when("attaching data with title 'My Report' via ctx.step", (ctx) => {
            ctx.step.attach("ZGF0YQ==", { title: ctx.step.valuesRaw[0] });
            attachment = ctx.step.attachments[0];
        });

        then("the attachment title should be 'My Report'", (ctx) => {
            expect(attachment.title).toBe(ctx.step.valuesRaw[0]);
        });
    });

    scenario("Each attachment gets a unique ID", () => {
        let firstId: string;
        let secondId: string;

        when("attaching data 'YQ==' and then 'Yg==' via ctx.step", (ctx) => {
            ctx.step.attach(ctx.step.valuesRaw[0]);
            ctx.step.attach(ctx.step.valuesRaw[1]);
            firstId = ctx.step.attachments[0].id;
            secondId = ctx.step.attachments[1].id;
        });

        then("both attachments should have defined IDs", () => {
            expect(firstId).toBeDefined();
            expect(secondId).toBeDefined();
        });

        and("the IDs should be different", () => {
            expect(firstId).not.toBe(secondId);
        });
    });

    // =========================================================================
    // attachScreenshot() via ctx.step
    // =========================================================================

    scenario("Screenshot attachment uses generated image dimensions", () => {
        let attachment: Attachment;
        let screenshotData: string;

        when("generating a '200' x '100' pixel screenshot and attaching it via ctx.step", (ctx) => {
            screenshotData = generateScreenshot(
                ctx.step.values[0] as number,
                ctx.step.values[1] as number
            );
            ctx.step.attachScreenshot(screenshotData);
            attachment = ctx.step.attachments[0];
        });

        then("the attachment kind should be 'screenshot'", (ctx) => {
            expect(attachment.kind).toBe(ctx.step.valuesRaw[0]);
        });

        and("the mimeType should be 'image/png'", (ctx) => {
            expect(attachment.mimeType).toBe(ctx.step.valuesRaw[0]);
        });

        and("the base64 data should decode to PNG signature bytes '137', '80', '78', and '71'", (ctx) => {
            const bytes = Buffer.from(attachment.base64!, "base64");
            expect(bytes[0]).toBe(ctx.step.values[0] as number);
            expect(bytes[1]).toBe(ctx.step.values[1] as number);
            expect(bytes[2]).toBe(ctx.step.values[2] as number);
            expect(bytes[3]).toBe(ctx.step.values[3] as number);
        });

        and("the image data should be more than '100' bytes", (ctx) => {
            const bytes = Buffer.from(attachment.base64!, "base64");
            expect(bytes.length).toBeGreaterThan(ctx.step.values[0] as number);
        });
    });

    scenario("Screenshot attachment with title 'Login page'", () => {
        let attachment: Attachment;

        when("generating and attaching a screenshot with title 'Login page' via ctx.step", (ctx) => {
            const screenshotData = generateScreenshot();
            ctx.step.attachScreenshot(screenshotData, ctx.step.valuesRaw[0]);
            attachment = ctx.step.attachments[0];
        });

        then("the attachment title should be 'Login page'", (ctx) => {
            expect(attachment.title).toBe(ctx.step.valuesRaw[0]);
        });
    });

    // =========================================================================
    // attachJSON() via ctx.step
    // =========================================================================

    scenario("JSON attachment serializes objects as pretty-printed base64", () => {
        let attachment: Attachment;

        when(`attaching this JSON payload via ctx.step
            """
            {"name":"Alice","score":42}
            """`, (ctx) => {
            const payload = ctx.step.docStringAsEntity as Record<string, unknown>;
            ctx.step.attachJSON(payload);
            attachment = ctx.step.attachments[0];
        });

        then(`the decoded base64 should match this pretty-printed JSON
            """
            {
              "name": "Alice",
              "score": 42
            }
            """`, (ctx) => {
            const decoded = Buffer.from(attachment.base64!, "base64").toString("utf-8");
            expect(decoded).toBe(ctx.step.docString);
        });
    });

    scenario("JSON attachment with a raw string avoids double-serialization", () => {
        let decoded: string;

        when(`attaching this raw JSON string via ctx.step
            """
            {"already":"formatted"}
            """`, (ctx) => {
            const rawJson = ctx.step.docString;
            ctx.step.attachJSON(rawJson);
            decoded = Buffer.from(ctx.step.attachments[0].base64!, "base64").toString("utf-8");
        });

        then(`the decoded base64 should match this original raw string
            """
            {"already":"formatted"}
            """`, (ctx) => {
            expect(decoded).toBe(ctx.step.docString);
        });
    });

    scenario("JSON attachment produces correct kind and mimeType", () => {
        let attachment: Attachment;

        when("attaching a JSON object with property 'ok' set to 'true' via ctx.step", (ctx) => {
            ctx.step.attachJSON({ [ctx.step.valuesRaw[0]]: ctx.step.values[1] });
            attachment = ctx.step.attachments[0];
        });

        then("the attachment kind should be 'file'", (ctx) => {
            expect(attachment.kind).toBe(ctx.step.valuesRaw[0]);
        });

        and("the mimeType should be 'application/json'", (ctx) => {
            expect(attachment.mimeType).toBe(ctx.step.valuesRaw[0]);
        });
    });

    scenario("JSON attachment with nested objects serializes correctly", () => {
        let attachment: Attachment;

        when(`attaching this nested JSON object via ctx.step
            """
            {"user":{"name":"Bob","address":{"city":"Sydney"}}}
            """`, (ctx) => {
            const nested = ctx.step.docStringAsEntity as Record<string, unknown>;
            ctx.step.attachJSON(nested);
            attachment = ctx.step.attachments[0];
        });

        then(`the decoded base64 should match this original nested object
            """
            {"user":{"name":"Bob","address":{"city":"Sydney"}}}
            """`, (ctx) => {
            const decoded = Buffer.from(attachment.base64!, "base64").toString("utf-8");
            expect(JSON.parse(decoded)).toEqual(ctx.step.docStringAsEntity);
        });
    });

    scenario("JSON attachment with title 'API Response'", () => {
        let attachment: Attachment;

        when("attaching JSON status '200' with title 'API Response' via ctx.step", (ctx) => {
            ctx.step.attachJSON({ status: ctx.step.values[0] }, ctx.step.valuesRaw[1]);
            attachment = ctx.step.attachments[0];
        });

        then("the attachment title should be 'API Response'", (ctx) => {
            expect(attachment.title).toBe(ctx.step.valuesRaw[0]);
        });
    });

    // =========================================================================
    // Multiple Attachments on a Single Step
    // =========================================================================

    scenario("Multiple attach() calls accumulate in order", () => {
        let attachments: Attachment[];

        when("attaching data 'Zmlyc3Q=', 'c2Vjb25k', and 'dGhpcmQ=' in order via ctx.step", (ctx) => {
            ctx.step.attach(ctx.step.valuesRaw[0]);
            ctx.step.attach(ctx.step.valuesRaw[1]);
            ctx.step.attach(ctx.step.valuesRaw[2]);
            attachments = [...ctx.step.attachments];
        });

        then("there should be '3' attachments", (ctx) => {
            expect(attachments).toHaveLength(ctx.step.values[0] as number);
        });

        and("the first attachment base64 should be 'Zmlyc3Q='", (ctx) => {
            expect(attachments[0].base64).toBe(ctx.step.valuesRaw[0]);
        });

        and("the second attachment base64 should be 'c2Vjb25k'", (ctx) => {
            expect(attachments[1].base64).toBe(ctx.step.valuesRaw[0]);
        });

        and("the third attachment base64 should be 'dGhpcmQ='", (ctx) => {
            expect(attachments[2].base64).toBe(ctx.step.valuesRaw[0]);
        });
    });

    scenario("Mixing attach(), attachScreenshot(), and attachJSON() on same step", () => {
        let attachments: Attachment[];

        when("attaching file data 'ZmlsZQ==', screenshot data 'c2NyZWVu', and JSON object type 'json' via ctx.step", (ctx) => {
            ctx.step.attach(ctx.step.valuesRaw[0]);
            ctx.step.attachScreenshot(ctx.step.valuesRaw[1]);
            ctx.step.attachJSON({ type: ctx.step.valuesRaw[2] });
            attachments = [...ctx.step.attachments];
        });

        then("there should be '3' attachments", (ctx) => {
            expect(attachments).toHaveLength(ctx.step.values[0] as number);
        });

        and("the first should have kind 'file' and mimeType 'application/octet-stream'", (ctx) => {
            expect(attachments[0].kind).toBe(ctx.step.valuesRaw[0]);
            expect(attachments[0].mimeType).toBe(ctx.step.valuesRaw[1]);
        });

        and("the second should have kind 'screenshot' and mimeType 'image/png'", (ctx) => {
            expect(attachments[1].kind).toBe(ctx.step.valuesRaw[0]);
            expect(attachments[1].mimeType).toBe(ctx.step.valuesRaw[1]);
        });

        and("the third should have kind 'file' and mimeType 'application/json'", (ctx) => {
            expect(attachments[2].kind).toBe(ctx.step.valuesRaw[0]);
            expect(attachments[2].mimeType).toBe(ctx.step.valuesRaw[1]);
        });
    });

    // =========================================================================
    // Edge Cases
    // =========================================================================

    scenario("Attaching empty string data via ctx.step", () => {
        let attachment: Attachment;

        when("attaching an empty string via ctx.step", (ctx) => {
            ctx.step.attach("");
            attachment = ctx.step.attachments[0];
        });

        then("the attachment should exist", () => {
            expect(attachment).toBeDefined();
        });

        and("the base64 data should be an empty string", () => {
            expect(attachment.base64).toBe("");
        });

        and("the attachment should have a defined ID", () => {
            expect(attachment.id).toBeDefined();
        });
    });

    scenario("JSON attachment with null value via ctx.step", () => {
        let decoded: string;

        when("attaching null as JSON via ctx.step", (ctx) => {
            ctx.step.attachJSON(null);
            decoded = Buffer.from(ctx.step.attachments[0].base64!, "base64").toString("utf-8");
        });

        then("the decoded base64 should be 'null'", (ctx) => {
            expect(decoded).toBe(ctx.step.valuesRaw[0]);
        });
    });

    scenario("JSON attachment with array data via ctx.step", () => {
        let decoded: unknown;

        when(`attaching this JSON array via ctx.step
            """
            [1,"two",{"three":3}]
            """`, (ctx) => {
            const data = ctx.step.docStringAsEntity as unknown[];
            ctx.step.attachJSON(data);
            decoded = JSON.parse(
                Buffer.from(ctx.step.attachments[0].base64!, "base64").toString("utf-8")
            );
        });

        then(`the decoded base64 should match this original array
            """
            [1,"two",{"three":3}]
            """`, (ctx) => {
            expect(decoded).toEqual(ctx.step.docStringAsEntity);
        });
    });
});
