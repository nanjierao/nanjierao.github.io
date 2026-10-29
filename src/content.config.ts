import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { parse as parseYaml } from 'yaml';
import {
  blogSchema,
  buildSchema,
  newsSchema,
  publicationSchema,
  talkSchema,
  themeSchema,
  wordSchema,
} from './content/schemas.ts';

const themes = defineCollection({
  loader: glob({ base: './src/content/themes', pattern: '*.{md,mdx}' }),
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
  schema: blogSchema,
});

// The homepage word cloud lives with the other editable drafts in content/.
const words = defineCollection({
  loader: file('content/wordcloud.yaml', {
    parser: (text) =>
      (parseYaml(text) as { words: Array<Record<string, unknown>> }).words.map((word, index) => ({
        id: `word-${index + 1}`,
        ...word,
      })),
  }),
  schema: wordSchema,
});

export const collections = { themes, builds, publications, talks, news, blog, words };
