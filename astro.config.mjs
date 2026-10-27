// @ts-check
import { defineConfig } from 'astro/config';
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
    react(),
    sitemap({
      filter: (page) => !NOT_IN_SITEMAP.some((path) => new URL(page).pathname === path),
    }),
  ],
  devToolbar: { enabled: false },
});
