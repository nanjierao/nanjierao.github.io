// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// Pages that are placeholders or not meant for search engines stay out of the sitemap.
// Keep this list in sync with the `noindex` prop on those pages.
const NOT_IN_SITEMAP = ['/hands/', '/ask/', '/life/', '/404/'];

export default defineConfig({
  site: 'https://nanjierao.github.io',
  output: 'static',
  // Whitespace follows Astro 7's default JSX rules ('jsx'), which is also how Prettier's Astro
  // plugin formats templates: write {' '} where a space must survive a line break.
  integrations: [
    // MDX lets research pages place figures (src/components/figures) inside their text.
    mdx(),
    react(),
    sitemap({
      filter: (page) => !NOT_IN_SITEMAP.some((path) => new URL(page).pathname === path),
    }),
  ],
  // Every page carries its CSS inside its HTML (D73). Two pages now share the sketch scenes'
  // stylesheet, which made it a render-blocking file of its own: it slowed the home page and,
  // on the teacher support page, let the web fonts arrive after the first paint (CLS 0.059
  // against the 0.05 budget). Inline, the teacher page measures as on main (CLS 0.030), and no
  // page waits for CSS; the home page's LCP stays over its budget, as on main (D73).
  build: { inlineStylesheets: 'always' },
  devToolbar: { enabled: false },
});
