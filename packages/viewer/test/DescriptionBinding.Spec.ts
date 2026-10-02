import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect } from 'vitest';
import { rule, specification } from '@swedevtools/livedoc-vitest';
import { ScenarioBlock } from '../src/client/components/ScenarioBlock';

specification('Viewer Description Binding', () => {
  rule("A selected outline row binds policy 'express' into description template 'The express policy applies'", (ctx) => {
    const [policy, expectedDescription] = ctx.rule.values as [string, string];
    const markup = renderToStaticMarkup(createElement(ScenarioBlock, {
      label: 'Rule Outline',
      title: 'Shipping policy',
      description: 'The <policy> policy applies',
      bindValues: { policy },
      tone: 'scenario',
    }));

    expect(markup).toContain(expectedDescription);
    expect(markup).not.toContain('&lt;policy&gt;');
  });

  rule("A Markdown autolink 'https://example.com' remains unchanged without outline values", (ctx) => {
    const expectedUrl = ctx.rule.values[0] as string;
    const markup = renderToStaticMarkup(createElement(ScenarioBlock, {
      label: 'Rule',
      title: 'Shipping policy',
      description: `See <${expectedUrl}> for policy details.`,
      tone: 'scenario',
    }));

    expect(markup).toContain(`&lt;${expectedUrl}&gt;`);
    expect(markup).not.toContain('&lt;//example.com&gt;');
  });

  rule("A selected row binds policy 'express' without rewriting URL 'https://example.com' or time '12:30'", (ctx) => {
    const [policy, url, time] = ctx.rule.values as [string, string, string];
    const markup = renderToStaticMarkup(createElement(ScenarioBlock, {
      label: 'Rule Outline',
      title: 'Shipping policy',
      description: `See <${url}> for the <policy> policy at <${time}>.`,
      bindValues: { policy },
      tone: 'scenario',
    }));

    expect(markup).toContain(policy);
    expect(markup).toContain(`&lt;${url}&gt;`);
    expect(markup).toContain(`&lt;${time}&gt;`);
  });

  rule("An unmatched less-than comparison '< 100' does not prevent later placeholder '<value>' binding to '11'", (ctx) => {
    const [comparison, placeholder, value] = ctx.rule.values as [string, string, string];
    const markup = renderToStaticMarkup(createElement(ScenarioBlock, {
      label: 'Scenario Outline',
      title: 'Value limit',
      description: `Values must be ${comparison}.\n\nThe selected value is ${placeholder}.`,
      bindValues: { value },
      tone: 'scenario',
    }));

    expect(markup).toContain(value);
    expect(markup).not.toContain('&lt;value&gt;');
  });
});
