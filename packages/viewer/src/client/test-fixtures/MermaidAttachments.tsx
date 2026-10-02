import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AttachmentViewer, type AttachmentItem } from '../components/AttachmentViewer';
import largeSequence from './large-sequence.mmd?raw';
import '../index.css';

function encode(source: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(source)));
}

const diagram = 'graph LR\n  A["Café 中文"] --> B["Ready"]';
const canvas = document.createElement('canvas');
canvas.width = 320;
canvas.height = 240;
const drawing = canvas.getContext('2d')!;
drawing.fillStyle = '#2563eb';
drawing.fillRect(0, 0, canvas.width, canvas.height);
const raster = canvas.toDataURL('image/png').split(',')[1];
const attachments: AttachmentItem[] = [
  { title: 'mime-diagram', mimeType: 'TEXT/VND.MERMAID; charset=utf-8', base64: encode(diagram) },
  { title: 'workflow.mmd', mimeType: 'application/octet-stream', base64: encode(diagram) },
  { title: 'workflow.MERMAID', mimeType: 'text/plain', base64: encode(diagram) },
  { title: 'legacy-diagram', mimeType: 'text/x-mermaid', base64: encode(diagram) },
  { title: 'alias-diagram', mimeType: 'text/mermaid', base64: encode(diagram) },
  { title: 'vendor-diagram', mimeType: 'application/vnd.mermaid', base64: encode(diagram) },
  { title: 'large-sequence.mmd', mimeType: 'text/vnd.mermaid', base64: encode(largeSequence) },
  { title: 'markdown.md', mimeType: 'text/markdown', base64: encode('```mermaid\ngraph LR\n  A --> B\n```') },
  { title: 'broken.mmd', mimeType: 'text/plain', base64: encode('graph LR\n  A -->') },
  { title: 'hostile.mmd', mimeType: 'text/plain',
    base64: encode('graph LR\n  A["<img src=x onerror=window.__mermaidExecuted=true>"] --> B["Safe"]') },
  { title: 'tree.json', mimeType: 'application/json',
    base64: encode(JSON.stringify({
      status: 'ready',
      profile: { user: 'Ada', options: { theme: 'night' } },
      entries: [{ id: 1, tags: ['one', 'two'] }, { id: 2 }],
    })) },
  { title: 'other.json', mimeType: 'application/json',
    base64: encode(JSON.stringify({ status: 'second', profile: { user: 'Lin' } })) },
  { title: 'invalid.json', mimeType: 'application/json', base64: encode('{"broken":,}') },
  { title: 'numbers.json', mimeType: 'application/json',
    base64: encode(JSON.stringify([1, { code: 'two' }])) },
  { title: 'preview.png', mimeType: 'image/png', base64: raster },
  { title: 'report.pdf', mimeType: 'application/pdf', base64: encode('fixture PDF data') },
  { title: 'long-log.txt', mimeType: 'text/plain', base64: encode(
    Array.from({ length: 100 }, (_, index) => `line ${index + 1}: document synchronization completed`).join('\n')
  ) },
  { title: 'long-data.json', mimeType: 'application/json', base64: encode(JSON.stringify(
    Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`entry-${index + 1}`, `value-${index + 1}`]))
  )) },
];

const jsonCases: AttachmentItem[] = [
  { title: 'search.json', mimeType: 'application/json', base64: encode(JSON.stringify({
    name: 'name',
    branch: { name: 'name', nested: { name: 'Café 中文.*[x] "quoted"\nline ΟΣ 🛰️ İ '.repeat(12) } },
    untouched: { description: 'not a search result' },
    'a.b': { '': true },
    numbers: [false, 0, null, [], {}],
  })) },
  { title: 'scalar-string.json', mimeType: 'application/json', base64: encode(JSON.stringify('Café 中文.*[x]')) },
  { title: 'collections.json', mimeType: 'application/json',
    base64: encode(JSON.stringify({
      documentType: 'collection-validation',
      services: [{ name: 'api', healthy: true, dependencies: [{ name: 'database', healthy: false }] }],
      summary: { total: 48, healthy: false },
      records: Array.from({ length: 48 }, (_, index) => ({
        id: index + 1, name: `record-${index + 1}`,
        description: 'Café 中文 — dependency information. '.repeat(10),
        dependencies: [{ name: 'database', healthy: false }, { name: 'cache', healthy: true }],
      })),
      Error: {
        httpStatusCode: null,
        dependencies: [{ name: 'database', healthy: false }, { name: 'cache', healthy: true }],
        emptyArray: [], emptyObject: {}, optional: null,
        message: 'long-value-without-spaces-'.repeat(30),
      },
      emptyArray: [], emptyObject: {}, optional: null, active: true,
      description: 'Café 中文 — collection validation',
    })) },
  { title: 'response.json', mimeType: 'application/json',
    base64: encode(JSON.stringify({
      SchemaVersion: 1,
      Status: 'degraded',
      StatusUpdatedUtc: '2026-09-30T11:00:00Z',
      Error: {
        provider: 'remote',
        operation: 'fetch',
        code: 'unavailable',
        message: 'long-value-without-spaces-'.repeat(30),
        httpStatusCode: null,
        dependencies: [{ name: 'database', healthy: false }, { name: 'cache', healthy: true }],
      },
      emptyArray: [],
      emptyObject: {},
      emptyString: '',
      zero: 0,
    })) },
  { title: 'null.json', mimeType: 'application/json', base64: encode('null') },
];

const wheelImage = encode('<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1400"><rect width="1800" height="1400" fill="#2563eb"/><path d="M0 700H1800M900 0V1400" stroke="white" stroke-width="4"/></svg>');
const wheelCases: AttachmentItem[] = [
  { title: 'large-image.svg', mimeType: 'image/svg+xml', base64: wheelImage },
  { title: 'second-image.svg', mimeType: 'image/svg+xml', base64: wheelImage },
  { title: 'loading-image.svg', mimeType: 'image/svg+xml', uri: '/wheel-loading.svg' },
  { title: 'invalid-image.png', mimeType: 'image/png', base64: encode('not an image') },
  attachments[6], attachments[8], attachments[10], attachments[16], attachments[15],
  { title: 'oversized-image.svg', mimeType: 'image/svg+xml',
    base64: encode('<svg xmlns="http://www.w3.org/2000/svg" width="100000" height="100000"><rect width="100000" height="100000" fill="#2563eb"/></svg>') },
];

declare global {
  interface Window { __mermaidExecuted?: boolean }
}

function Fixture() {
  const [open, setOpen] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const items: AttachmentItem[] = params.has('step-context')
    ? [
      { ...attachments[6], stepIndex: 1, stepCount: 3, stepTitle: 'the document is synchronized', stepKeyword: 'when', stepStatus: 'passed' },
      { ...attachments[10], stepIndex: 2, stepCount: 3, stepTitle: 'the result is inspected', stepKeyword: 'then', stepStatus: 'failed' },
    ]
    : params.has('step-sparse')
      ? [{ ...attachments[6], stepIndex: 1, stepTitle: 'the document is synchronized', stepKeyword: 'when' }]
      : params.has('step-gallery')
        ? [{ ...attachments[10], stepIndex: 0, stepTitle: 'a response is inspected', stepKeyword: 'then' }]
        : params.has('json-cases')
          ? [...attachments, ...jsonCases]
          : params.has('wheel-cases')
            ? wheelCases
          : attachments;
  return (
    <>
      <button onClick={() => setOpen(true)}>Open attachment gallery</button>
      <AttachmentViewer attachments={items} open={open} onOpenChange={setOpen} />
    </>
  );
}

const root = createRoot(document.getElementById('root')!);
import.meta.hot?.dispose(() => root.unmount());
root.render(<Fixture />);
