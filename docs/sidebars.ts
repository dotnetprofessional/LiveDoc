import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  concepts: [
    {
      type: 'category',
      label: 'Concepts',
      collapsed: false,
      link: { type: 'generated-index', description: 'Core concepts behind LiveDoc — language-agnostic philosophy, patterns, and models.' },
      items: [
        'concepts/living-documentation',
        'concepts/bdd-pattern',
        'concepts/specification-pattern',
        'concepts/data-driven-tests',
        'concepts/self-documenting-tests',
        'concepts/test-organization',
        'concepts/reporting-model',
        'concepts/tutorial-beautiful-tea',
      ],
    },
  ],
  vitest: [
    {
      type: 'category',
      label: 'Learn',
      collapsed: false,
      items: [
        'vitest/learn/getting-started',
        'vitest/learn/your-first-feature',
        'vitest/learn/your-first-spec',
        'vitest/learn/data-extraction',
        'vitest/learn/scenario-outlines',
        'vitest/learn/tutorial',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'vitest/reference/feature',
        'vitest/reference/scenario',
        'vitest/reference/scenario-outline',
        'vitest/reference/background',
        'vitest/reference/steps',
        'vitest/reference/specification',
        'vitest/reference/rule',
        'vitest/reference/rule-outline',
        'vitest/reference/context',
        'vitest/reference/data-apis',
        'vitest/reference/reporters',
        'vitest/reference/configuration',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'vitest/guides/setup-imports',
        'vitest/guides/setup-globals',
        'vitest/guides/tags-and-filtering',
        'vitest/guides/custom-reporters',
        'vitest/guides/viewer-integration',
        'vitest/guides/ci-cd',
        'vitest/guides/migration-from-mocha',
        'vitest/guides/troubleshooting',
        'vitest/guides/best-practices',
        'vitest/guides/contributing',
      ],
    },
  ],
  xunit: [
    {
      type: 'doc',
      id: 'xunit/index',
      label: 'Overview',
    },
    {
      type: 'category',
      label: 'Learn',
      collapsed: false,
      items: [
        'xunit/learn/getting-started',
        'xunit/learn/your-first-feature',
        'xunit/learn/your-first-spec',
        'xunit/learn/value-extraction',
        'xunit/learn/scenario-outlines',
        'xunit/learn/tutorial',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'xunit/reference/feature-test',
        'xunit/reference/specification-test',
        'xunit/reference/attributes',
        'xunit/reference/step-methods',
        'xunit/reference/example-attribute',
        'xunit/reference/value-extraction-api',
        'xunit/reference/context',
        'xunit/reference/configuration',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'xunit/guides/journey-testing',
        'xunit/guides/viewer-integration',
        'xunit/guides/ai-skill-setup',
        'xunit/guides/debugging',
        'xunit/guides/best-practices',
        'xunit/guides/troubleshooting',
      ],
    },
  ],
  viewer: [
    {
      type: 'category',
      label: 'Learn',
      collapsed: false,
      items: [
        'viewer/learn/getting-started',
        'viewer/learn/understanding-the-ui',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'viewer/reference/cli-options',
        'viewer/reference/rest-api',
        'viewer/reference/websocket-api',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'viewer/guides/ci-cd-dashboards',
        'viewer/guides/multi-project-setup',
      ],
    },
  ],
  vscode: [
    'vscode/overview',
    'vscode/development',
  ],
};

export default sidebars;
