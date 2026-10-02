### 2026-09-25T23-40-15: JSON gallery uses nested accessible disclosures
**By:** Kaylee
**What:** JSON gallery uses nested accessible disclosures
**References:** packages/viewer/src/client/components/AttachmentViewer.tsx, packages/viewer/src/client/components/ui/collapsible.tsx, packages/viewer/test/JsonAttachments.Spec.ts
**Why:** ### 2026-09-25: JSON attachment tree behavior
**By:** Kaylee
**What:** Valid JSON attachments use nested Radix Collapsible controls, with the root expanded and child objects/arrays collapsed by default. Each slide owns its own disclosure state; leaving and returning resets to that default. Copy still uses the full formatted JSON, while invalid JSON displays a warning and raw source with no disclosures.
**Why:** Large JSON evidence needs progressive disclosure without losing readable source, keyboard operation, clipboard behavior, or isolation between gallery items.