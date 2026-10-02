### 2026-09-25T23-26-14: Render only explicit Mermaid attachments as isolated images
**By:** Kaylee
**What:** Render only explicit Mermaid attachments as isolated images
**References:** packages/viewer/src/client/components/AttachmentViewer.tsx, packages/vscode/src/viewer/ViewerPanel.ts, packages/viewer/test/MermaidAttachments.Spec.ts
**Why:** ### 2026-09-25: Mermaid attachment preview contract
**By:** Kaylee
**What:** The Viewer treats `text/vnd.mermaid`, `text/x-mermaid`, `text/mermaid`, `application/vnd.mermaid` (case/charset insensitive), or `.mmd`/`.mermaid` filenames as Mermaid. Ordinary text/Markdown fences remain text. Mermaid is lazy-loaded in strict mode, with the generated SVG shown only as a blob-backed image; invalid content exposes its source and an accessible error. The VS Code webview permits same-source module chunks and uses module script loading for Vite output.
**Why:** Prevent accidental diagram detection, keep untrusted attachment content non-interactive, preserve gallery controls and webview CSP behavior.