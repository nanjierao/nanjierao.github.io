import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import {
  blogSchema,
  buildSchema,
  newsSchema,
  publicationSchema,
  talkSchema,
  themeSchema,
} from './content/schemas.ts';

const themes = defineCollection({
  loader: glob({ base: './src/content/themes', pattern: '*.md' }),
  schema: themeSchema,
});

const builds = defineCollection({
  loader: glob({ base: './src/content/builds', pattern: '*.md' }),
  schema: ({ image }) => buildSchema(image),
});

const publications = defineCollection({
  loader: file('src/content/publications.yaml'),
  schema: publicationSchema,
});

const talks = defineCollection({
  loader: file('src/content/talks.yaml'),
  schema: talkSchema,
});

const news = defineCollection({
  loader: file('src/content/news.yaml'),
  schema: newsSchema,
});

// Each post lives in its own folder with its images: src/content/blog/<slug>/index.md
// BLOG_FIXTURES=1 builds a synthetic post from tests/fixtures/blog instead, for end-to-end tests
// and layout screenshots; it is never set for the real site.
const blog = defineCollection({
  loader: glob({
    base: process.env.BLOG_FIXTURES === '1' ? './tests/fixtures/blog' : './src/content/blog',
    pattern: '*/index.{md,mdx}',
    generateId: ({ entry }) => entry.replace(/\/index\.mdx?$/, ''),
  }),
  schema: ({ image }) => blogSchema(image),
});

export const collections = { themes, builds, publications, talks, news, blog };
