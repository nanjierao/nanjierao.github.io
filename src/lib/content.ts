// Queries over the content collections, with the visibility rules in one place:
// VERIFY items, DRAFT TL;DRs, draft builds and posts, and unapproved working papers stay hidden.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';
import { FLAGS } from '../data/site.ts';
import { CONTEXTS } from '../content/schemas.ts';
import { comparePartialDatesDesc } from './format.ts';
import { notesDir } from './notes.ts';
import { isListedPublication, isListedWorkingPaper } from './visibility.ts';

export { approvedTldr } from './visibility.ts';

export type Publication = CollectionEntry<'publications'>['data'];
export type Theme = CollectionEntry<'themes'>;
export type Build = CollectionEntry<'builds'>;
export type Post = CollectionEntry<'blog'>;
export type Talk = CollectionEntry<'talks'>['data'];
export type NewsItem = CollectionEntry<'news'>['data'];
export type Note = CollectionEntry<'notes'>;

/** Published work shown on the site, newest first (VERIFY items hidden). */
export async function getPublications(): Promise<Publication[]> {
  const all = (await getCollection('publications')).map((entry) => entry.data);
  return all
    .filter(isListedPublication)
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (a.factsNumber ?? 0) - (b.factsNumber ?? 0));
}

/** D28 working papers: only when Jimmy has approved them. */
export async function getWorkingPapers(): Promise<Publication[]> {
  return (await getCollection('publications'))
    .map((entry) => entry.data)
    .filter((pub) => isListedWorkingPaper(pub, FLAGS.showWorkingPapers));
}

export async function getPublicationsByIds(ids: readonly string[]): Promise<Publication[]> {
  const visible = await getPublications();
  return ids.map((id) => visible.find((pub) => pub.id === id)).filter((pub) => pub !== undefined);
}

export async function getThemes(): Promise<Theme[]> {
  return (await getCollection('themes')).sort((a, b) => a.data.order - b.data.order);
}

/** Themes grouped under the three contexts (D45), in context order. */
export async function getThemesByContext(): Promise<
  Array<{ context: (typeof CONTEXTS)[number]; themes: Theme[] }>
> {
  const themes = await getThemes();
  return CONTEXTS.map((context) => ({
    context,
    themes: themes.filter((theme) => theme.data.context === context),
  }));
}

/** Studies that are still running (D69), listed after the three contexts. */
export async function getOngoingThemes(): Promise<Theme[]> {
  return (await getThemes()).filter((theme) => theme.data.status === 'ongoing');
}

/** Daily notes (D71), newest first. A note's id is its date. */
export async function getNotes(): Promise<Note[]> {
  const notes = await getCollection('notes');
  // The glob loader only warns when it reads nothing, so a note file that didn't load would
  // quietly go missing from the site. Count the files and fail the build instead.
  const dir = notesDir();
  const files = readdirSync(join(process.cwd(), dir)).filter((name) => name.endsWith('.yaml'));
  if (files.length !== notes.length)
    throw new Error(
      `${dir} holds ${files.length} daily notes, but the build loaded ${notes.length}`,
    );
  return notes.sort((a, b) => b.id.localeCompare(a.id));
}

export async function getBuilds(): Promise<Build[]> {
  return (await getCollection('builds', (entry) => !entry.data.draft)).sort(
    (a, b) => a.data.order - b.data.order,
  );
}

export async function getBuildsByIds(ids: readonly string[]): Promise<Build[]> {
  const builds = await getBuilds();
  return ids
    .map((id) => builds.find((build) => build.id === id))
    .filter((build) => build !== undefined);
}

export async function getPosts(): Promise<Post[]> {
  return (await getCollection('blog', (entry) => !entry.data.draft)).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );
}

export async function getTalks(): Promise<Talk[]> {
  return (await getCollection('talks')).map((entry) => entry.data);
}

export async function getNews(limit?: number): Promise<NewsItem[]> {
  const items = (await getCollection('news'))
    .map((entry) => entry.data)
    // Newest first; items dated only as precisely (e.g. two "2026" items) keep a stable order.
    .sort((a, b) => comparePartialDatesDesc(a.date, b.date) || a.id.localeCompare(b.id));
  return limit ? items.slice(0, limit) : items;
}
