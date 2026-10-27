// Queries over the content collections, with the visibility rules in one place:
// VERIFY items, DRAFT TL;DRs, draft builds and posts, and unapproved working papers stay hidden.
import { getCollection, type CollectionEntry } from 'astro:content';
import { FLAGS } from '../data/site.ts';
import { CONTEXTS } from '../content/schemas.ts';
import { comparePartialDatesDesc } from './format.ts';
import { isListedPublication, isListedWorkingPaper } from './visibility.ts';

export { approvedTldr } from './visibility.ts';

export type Publication = CollectionEntry<'publications'>['data'];
export type Theme = CollectionEntry<'themes'>;
export type Build = CollectionEntry<'builds'>;
export type Post = CollectionEntry<'blog'>;
export type Talk = CollectionEntry<'talks'>['data'];
export type NewsItem = CollectionEntry<'news'>['data'];

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
    .sort((a, b) => comparePartialDatesDesc(a.date, b.date));
  return limit ? items.slice(0, limit) : items;
}
