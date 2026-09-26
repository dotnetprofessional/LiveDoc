import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import LiveDocSpecReporter from "../../../app/reporter/LiveDocSpecReporter";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");

class ExportOnlyReporter extends LiveDocSpecReporter {
    async onInit(): Promise<void> {
        // No server discovery: this isolated failure probe exports JSON locally.
    }
}

export default defineConfig({
    root,
    test: {
        include: ["_src/test/AttachingEvidence/fixtures/rule-attachments.fixture.ts"],
        reporters: [new ExportOnlyReporter({
            detailLevel: "silent",
            export: {
                output: process.env.LIVEDOC_RULE_EVIDENCE_OUTPUT ??
                    resolve(root, `_src/test/AttachingEvidence/fixtures/attachment-export-${process.pid}.json`),
            },
        })],
    },
});
