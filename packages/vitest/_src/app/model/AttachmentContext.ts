import type { Attachment } from "@swedevtools/livedoc-schema";

let attachmentCounter = 0;

/** Attachment API shared by executable step and rule contexts. */
export class AttachmentContext {
    constructor(private readonly collectedAttachments: Attachment[] = []) {}

    attach(data: string, opts?: { title?: string; mimeType?: string; kind?: Attachment["kind"] }): void {
        this.collectedAttachments.push({
            id: `att-${Date.now()}-${++attachmentCounter}`,
            kind: opts?.kind ?? "file",
            title: opts?.title,
            mimeType: opts?.mimeType ?? "application/octet-stream",
            base64: data,
        });
    }

    attachScreenshot(base64: string, title?: string): void {
        this.attach(base64, { title, mimeType: "image/png", kind: "screenshot" });
    }

    attachJSON(data: unknown, title?: string): void {
        const json = typeof data === "string" ? data : JSON.stringify(data, null, 2);
        const base64 = typeof globalThis.btoa === "function"
            ? globalThis.btoa(unescape(encodeURIComponent(json)))
            : Buffer.from(json, "utf-8").toString("base64");
        this.attach(base64, { title, mimeType: "application/json", kind: "file" });
    }

    get attachments(): Attachment[] {
        return this.collectedAttachments;
    }
}
