import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect } from 'vitest';
import { rule, specification } from '@swedevtools/livedoc-vitest';
import { StepList } from '../src/client/components/StepList';

specification('Inline Step Descriptions', () => {
  rule("A step description renders heading 'Input' and JSON value '11' inline", (ctx) => {
    const [heading, value] = ctx.rule.values as [string, number];
    const markup = renderToStaticMarkup(createElement(StepList, {
      steps: [{
        id: 'step-1',
        kind: 'Step',
        keyword: 'given',
        title: 'an increment request',
        description: `### ${heading}\n\n\`\`\`json\n{"value":${value}}\n\`\`\``,
        execution: { status: 'passed', duration: 0 },
      }],
    }));

    expect(markup).toContain(`<h3>${heading}</h3>`);
    expect(markup).toContain(`{&quot;value&quot;:${value}}`);
  });

  rule("Inline Markdown code value '1' remains inline rather than a full-width code block", (ctx) => {
    const value = ctx.rule.values[0] as number;
    const markup = renderToStaticMarkup(createElement(StepList, {
      steps: [{
        id: 'step-1',
        kind: 'Step',
        keyword: 'when',
        title: 'the value is incremented',
        description: `The mapping adds \`${value}\` to the supplied value.`,
        execution: { status: 'passed', duration: 0 },
      }],
    }));

    expect(markup).toContain('bg-muted px-1 py-0.5');
    expect(markup).not.toContain('block bg-muted/50 p-3');
  });

  rule("A step description renders script-like text '<script>alert(1)</script>' without executable markup", (ctx) => {
    const scriptText = ctx.rule.values[0] as string;
    const markup = renderToStaticMarkup(createElement(StepList, {
      steps: [{
        id: 'step-1',
        kind: 'Step',
        keyword: 'then',
        title: 'the raw response is visible',
        description: `\`\`\`html\n${scriptText}\n\`\`\``,
        execution: { status: 'passed', duration: 0 },
      }],
    }));

    expect(markup).not.toContain('<script>');
    expect(markup).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(markup).not.toContain('`&lt;script&gt;`');
  });

  rule("A four-backtick Markdown fence preserves nested JSON placeholder '<orderId>' exactly", (ctx) => {
    const placeholder = ctx.rule.values[0] as string;
    const markup = renderToStaticMarkup(createElement(StepList, {
      steps: [{
        id: 'step-1',
        kind: 'Step',
        keyword: 'given',
        title: 'the nested example is visible',
        description: `\`\`\`\`markdown\n\`\`\`json\n{"id":"${placeholder}"}\n\`\`\`\n\`\`\`\``,
        execution: { status: 'passed', duration: 0 },
      }],
    }));

    expect(markup).toContain('&lt;orderId&gt;');
    expect(markup).not.toContain('`&lt;orderId&gt;`');
  });
});
