// Open-source credits for /credits (CLAUDE.md: every shipped dependency or vendored project).
// Keep in sync with package.json and docs/THIRD_PARTY.md.

export interface Credit {
  name: string;
  /** npm package whose installed version is shown; omit for non-npm items. */
  pkg?: string;
  license: string;
  url: string;
  use: string;
}

/** Code and fonts that reach visitors' browsers, or build the pages they get. */
export const SITE_CREDITS: Credit[] = [
  {
    name: 'Astro',
    pkg: 'astro',
    license: 'MIT',
    url: 'https://astro.build/',
    use: 'Static site framework; builds every page.',
  },
  {
    name: '@astrojs/mdx',
    pkg: '@astrojs/mdx',
    license: 'MIT',
    url: 'https://docs.astro.build/en/guides/integrations-guide/mdx/',
    use: 'Lets the research pages place charts and diagrams inside their text.',
  },
  {
    name: 'd3-cloud',
    pkg: 'd3-cloud',
    license: 'BSD-3-Clause',
    url: 'https://github.com/jasondavies/d3-cloud',
    use: 'Packs the homepage word cloud (about 4 KB gzipped, homepage only).',
  },
  {
    name: '@astrojs/react',
    pkg: '@astrojs/react',
    license: 'MIT',
    url: 'https://github.com/withastro/astro',
    use: 'React islands for the interactive portals (none on these pages yet).',
  },
  {
    name: 'React',
    pkg: 'react',
    license: 'MIT',
    url: 'https://react.dev/',
    use: 'UI library for future interactive islands.',
  },
  {
    name: '@astrojs/sitemap',
    pkg: '@astrojs/sitemap',
    license: 'MIT',
    url: 'https://github.com/withastro/astro',
    use: 'sitemap-index.xml.',
  },
  {
    name: '@astrojs/rss',
    pkg: '@astrojs/rss',
    license: 'MIT',
    url: 'https://github.com/withastro/astro',
    use: 'Blog RSS feed.',
  },
  {
    name: 'Inter (Fontsource)',
    pkg: '@fontsource-variable/inter',
    license: 'OFL-1.1',
    url: 'https://fontsource.org/fonts/inter',
    use: 'Body and interface text.',
  },
  {
    name: 'Source Serif 4 (Fontsource)',
    pkg: '@fontsource-variable/source-serif-4',
    license: 'OFL-1.1',
    url: 'https://fontsource.org/fonts/source-serif-4',
    use: 'Headings.',
  },
  {
    name: 'IBM Plex Mono (Fontsource)',
    pkg: '@fontsource/ibm-plex-mono',
    license: 'OFL-1.1',
    url: 'https://fontsource.org/fonts/ibm-plex-mono',
    use: 'Datasheet labels and code.',
  },
  {
    name: 'fast-xml-parser',
    pkg: 'fast-xml-parser',
    license: 'MIT',
    url: 'https://github.com/NaturalIntelligence/fast-xml-parser',
    use: 'Reads the YouTube feed during the build.',
  },
  {
    name: 'sharp',
    pkg: 'sharp',
    license: 'Apache-2.0',
    url: 'https://sharp.pixelplumbing.com/',
    use: 'Image processing (through Astro) and the image-metadata check.',
  },
];

/** Tools that check the code; they never reach visitors. */
export const TOOL_CREDITS: Credit[] = [
  {
    name: 'TypeScript',
    pkg: 'typescript',
    license: 'Apache-2.0',
    url: 'https://www.typescriptlang.org/',
    use: 'Type checking (strict).',
  },
  {
    name: '@astrojs/check',
    pkg: '@astrojs/check',
    license: 'MIT',
    url: 'https://github.com/withastro/astro',
    use: 'Type checks .astro files.',
  },
  {
    name: 'ESLint',
    pkg: 'eslint',
    license: 'MIT',
    url: 'https://eslint.org/',
    use: 'Linting, with typescript-eslint and eslint-plugin-astro.',
  },
  {
    name: 'eslint-plugin-jsx-a11y-x',
    pkg: 'eslint-plugin-jsx-a11y-x',
    license: 'MIT',
    url: 'https://github.com/es-tooling/eslint-plugin-jsx-a11y-x',
    use: 'Accessibility lint rules for templates.',
  },
  {
    name: 'Prettier',
    pkg: 'prettier',
    license: 'MIT',
    url: 'https://prettier.io/',
    use: 'Formatting.',
  },
  {
    name: 'Vitest',
    pkg: 'vitest',
    license: 'MIT',
    url: 'https://vitest.dev/',
    use: 'Unit tests and content checks.',
  },
  {
    name: 'Playwright',
    pkg: '@playwright/test',
    license: 'Apache-2.0',
    url: 'https://playwright.dev/',
    use: 'End-to-end tests in a real browser.',
  },
  {
    name: 'axe-core for Playwright',
    pkg: '@axe-core/playwright',
    license: 'MPL-2.0',
    url: 'https://github.com/dequelabs/axe-core-npm',
    use: 'Automated accessibility checks.',
  },
  {
    name: 'yaml',
    pkg: 'yaml',
    license: 'ISC',
    url: 'https://eemeli.org/yaml/',
    use: 'Reads content files in tests.',
  },
];

/** Loaded by the self-contained CS-UDT demo files in public/demos/csudt/. */
export const DEMO_CREDITS: Credit[] = [
  {
    name: 'MapLibre GL JS 3.6.2',
    license: 'BSD-3-Clause',
    url: 'https://maplibre.org/',
    use: 'Map in the planner dashboard (loaded from unpkg.com).',
  },
  {
    name: 'OpenStreetMap tiles',
    license: 'ODbL (data), © OpenStreetMap contributors',
    url: 'https://www.openstreetmap.org/copyright',
    use: 'Base map in the planner dashboard.',
  },
  {
    name: 'QRCode.js 1.0.0',
    license: 'MIT',
    url: 'https://github.com/davidshimjs/qrcodejs',
    use: 'Offline QR relay in the citizen client (loaded from cdnjs).',
  },
];
