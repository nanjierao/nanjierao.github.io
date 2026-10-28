import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { PERSON, SITE_URL } from '../data/site.ts';
import { getPosts } from '../lib/content.ts';

export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: `Blog — ${PERSON.displayName}`,
    description: 'Answers from Zhihu, in Chinese, each with an English title and summary.',
    site: context.site ?? SITE_URL,
    items: posts.map((post) => ({
      title: post.data.title_en,
      description: post.data.summary_en,
      pubDate: post.data.date,
      link: `/blog/${post.id}/`,
      categories: post.data.tags,
    })),
    customData: '<language>en</language>',
  });
}
