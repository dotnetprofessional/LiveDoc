import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'LiveDoc',
  tagline: 'Living Documentation from Executable Specifications',
  favicon: 'img/favicon.ico',

  url: 'https://livedoc.dev',
  baseUrl: '/',

  organizationName: 'swedevtools',
  projectName: 'livedoc',

  onBrokenLinks: 'warn',

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: ['@docusaurus/theme-mermaid'],

  themeConfig: {
    navbar: {
      title: 'LiveDoc',
      logo: {
        alt: 'LiveDoc Logo',
        src: 'img/logo.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'concepts',
          position: 'left',
          label: 'Concepts',
        },
        {
          type: 'docSidebar',
          sidebarId: 'vitest',
          position: 'left',
          label: 'Vitest SDK',
        },
        {
          type: 'docSidebar',
          sidebarId: 'xunit',
          position: 'left',
          label: 'xUnit SDK',
        },
        {
          type: 'docSidebar',
          sidebarId: 'viewer',
          position: 'left',
          label: 'Viewer',
        },
        {
          type: 'docSidebar',
          sidebarId: 'vscode',
          position: 'left',
          label: 'VS Code',
        },
        {
          href: 'https://github.com/nickvdyck/livedoc',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'SDKs',
          items: [
            { label: 'Vitest (TypeScript)', to: '/vitest/learn/getting-started' },
            { label: 'xUnit (.NET)', to: '/xunit/learn/getting-started' },
          ],
        },
        {
          title: 'Tools',
          items: [
            { label: 'LiveDoc Viewer', to: '/viewer/learn/getting-started' },
            { label: 'VS Code Extension', to: '/vscode/overview' },
          ],
        },
        {
          title: 'More',
          items: [
            { label: 'GitHub', href: 'https://github.com/nickvdyck/livedoc' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} SweDevTools. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['csharp', 'bash', 'json', 'powershell'],
    },
    mermaid: {
      theme: { light: 'neutral', dark: 'dark' },
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
