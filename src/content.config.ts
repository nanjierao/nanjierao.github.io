import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { parse as parseYaml } from 'yaml';
import {
  blogSchema,
  buildSchema,
  newsSchema,
  noteSchema,
  publicationSchema,
  talkSchema,
  themeSchema,
  wordSchema,
} from './content/schemas.ts';
import { isNoteDate } from './lib/notes.ts';

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

// Daily notes (D71): one YAML file per day, src/content/notes/<YYYY-MM-DD>.yaml; the file name is
// the date. NOTES_FIXTURES=1 reads synthetic notes from tests/fixtures/notes instead, for
// end-to-end tests and layout screenshots; it is never set for the real site.
const notes = defineCollection({
  loader: glob({
    base: process.env.NOTES_FIXTURES === '1' ? './tests/fixtures/notes' : './src/content/notes',
    pattern: '*.yaml',
    generateId: ({ entry }) => {
      const id = entry.replace(/\.yaml$/, '');
      if (!isNoteDate(id))
        throw new Error(`A daily note's file name is its date, YYYY-MM-DD.yaml: ${entry}`);
      return id;
    },
  }),
  schema: noteSchema,
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

export const collections = { themes, builds, publications, talks, news, blog, notes, words };
