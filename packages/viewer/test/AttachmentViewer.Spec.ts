import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect } from 'vitest';
import { rule, specification } from '@swedevtools/livedoc-vitest';
import type { StepTest } from '@swedevtools/livedoc-schema';
import { AttachmentContentMetadata } from '../src/client/components/AttachmentViewer';
import { collectScenarioAttachments } from '../src/client/utils/gallery';

specification('Attachment Viewer Metadata', () => {
  rule("A JSON attachment titled 'Create order response' shows its title before MIME type 'application/json'", (ctx) => {
    const [title, mimeType] = ctx.rule.values as [string, string];
    const markup = renderToStaticMarkup(createElement(AttachmentContentMetadata, {
      item: { title, mimeType },
      fallbackMimeType: mimeType,
    }));

    expect(markup).toContain(title);
    expect(markup).toContain(mimeType);
    expect(markup.indexOf(title)).toBeLessThan(markup.indexOf(mimeType));
  });

  rule("An untitled JSON attachment shows fallback MIME type 'application/json'", (ctx) => {
    const fallbackMimeType = ctx.rule.values[0] as string;
    const markup = renderToStaticMarkup(createElement(AttachmentContentMetadata, {
      item: {},
      fallbackMimeType,
    }));

    expect(markup).toContain(fallbackMimeType);
  });

  rule("An attachment on step '2' of '3' retains the full scenario count when only one step has attachments", (ctx) => {
    const [stepNumber, totalSteps] = ctx.rule.values as [number, number];
    const steps: StepTest[] = [
      { id: 'given', kind: 'Step', keyword: 'given', title: 'a document exists',
        execution: { status: 'passed', duration: 0 } },
      { id: 'when', kind: 'Step', keyword: 'when', title: 'the document is synchronized',
        execution: { status: 'passed', duration: 0, attachments: [
          { id: 'diagram', kind: 'file', mimeType: 'text/vnd.mermaid', title: 'Document sync sequence', base64: 'YQ==' },
        ] } },
      { id: 'then', kind: 'Step', keyword: 'then', title: 'the result is inspected',
        execution: { status: 'passed', duration: 0 } },
    ];

    const items = collectScenarioAttachments(steps);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      stepIndex: stepNumber - 1,
      stepCount: totalSteps,
      stepKeyword: 'when',
      stepTitle: 'the document is synchronized',
      title: 'Document sync sequence',
    });
  });
});
