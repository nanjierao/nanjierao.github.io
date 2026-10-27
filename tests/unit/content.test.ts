// Content checks (CLAUDE.md: "every publication has year, venue, authors") plus the rules that
// keep unconfirmed facts off the site. Files are read directly and validated with the same Zod
// schemas the collections use.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'astro/zod';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import {
  blogSchema,
  buildSchema,
  newsSchema,
  publicationSchema,
  talkSchema,
  themeSchema,
} from '../../src/content/schemas.ts';
import {
  approvedTldr,
  isListedPublication,
  isListedWorkingPaper,
} from '../../src/lib/visibility.ts';
import { isSelf } from '../../src/lib/format.ts';
import { FLAGS } from '../../src/data/site.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const CONTENT = join(ROOT, 'src', 'content');
const imageStub = () => z.string();

function readYaml(file: string): unknown {
  return parseYaml(readFileSync(join(CONTENT, file), 'utf8'));
}

function readMarkdown(path: string): { data: unknown; body: string } {
  const text = readFileSync(path, 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!match) throw new Error(`No front matter in ${path}`);
  return { data: parseYaml(match[1]!), body: match[2]! };
}

function markdownDir(dir: string): Array<{ id: string; data: unknown; body: string }> {
  return readdirSync(join(CONTENT, dir))
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({ id: name.replace(/\.md$/, ''), ...readMarkdown(join(CONTENT, dir, name)) }));
}

const publications = z.array(publicationSchema).parse(readYaml('publications.yaml'));
const talks = z.array(talkSchema).parse(readYaml('talks.yaml'));
const news = z.array(newsSchema).parse(readYaml('news.yaml'));
const themes = markdownDir('themes').map((t) => ({ ...t, data: themeSchema.parse(t.data) }));
const builds = markdownDir('builds').map((b) => ({
  ...b,
  data: buildSchema(imageStub).parse(b.data),
}));

describe('publications (facts.md §6)', () => {
  const published = publications.filter((pub) => pub.type !== 'in-preparation');

  it('has the 12 peer-reviewed items, numbered 1–12 once each', () => {
    expect(published).toHaveLength(12);
    expect(published.map((pub) => pub.factsNumber).sort((a, b) => a! - b!)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
  });

  it('gives every publication a year, a venue and authors', () => {
    for (const pub of published) {
      expect(pub.year, pub.id).toBeTypeOf('number');
      expect(pub.venue.trim(), pub.id).not.toBe('');
      expect(pub.authors.length, pub.id).toBeGreaterThan(0);
      expect(pub.authors.some(isSelf), `${pub.id} lists Jimmy`).toBe(true);
    }
  });

  it('marks first authorship exactly when Jimmy is listed first', () => {
    for (const pub of publications) {
      expect(pub.firstAuthor, pub.id).toBe(isSelf(pub.authors[0]!));
    }
  });

  it('has unique ids', () => {
    const ids = publications.map((pub) => pub.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps VERIFY items off the site (DTRUE 2026, facts.md §6 [10])', () => {
    const dtrue = publications.find((pub) => pub.factsNumber === 10)!;
    expect(dtrue.verify).toBe(true);
    expect(isListedPublication(dtrue)).toBe(false);
    expect(published.filter(isListedPublication)).toHaveLength(11);
  });

  it('hides TL;DRs while they are DRAFT (D28)', () => {
    for (const pub of publications) {
      if (pub.tldr?.draft) expect(approvedTldr(pub), pub.id).toBeNull();
    }
    // facts.md §6 marks every drafted TL;DR as DRAFT today.
    expect(publications.filter((pub) => pub.tldr && !pub.tldr.draft)).toEqual([]);
  });

  it('keeps in-preparation items behind a flag that is off (D28)', () => {
    expect(FLAGS.showWorkingPapers).toBe(false);
    const wip = publications.filter((pub) => pub.type === 'in-preparation');
    expect(wip).toHaveLength(2);
    for (const pub of wip) expect(isListedWorkingPaper(pub, FLAGS.showWorkingPapers)).toBe(false);
    for (const pub of wip) expect(isListedWorkingPaper(pub, true)).toBe(true);
  });
});

describe('research themes (D45)', () => {
  it('has the five theme pages grouped Personal · Embodied · Civic', () => {
    expect(themes.map((t) => t.id).sort()).toEqual([
      'civic-digital-twins',
      'embodied-learning',
      'grounding',
      'interest-identification',
      'teacher-support',
    ]);
    const contexts = Object.fromEntries(themes.map((t) => [t.id, t.data.context]));
    expect(contexts).toEqual({
      'interest-identification': 'personal',
      grounding: 'personal',
      'teacher-support': 'personal',
      'embodied-learning': 'embodied',
      'civic-digital-twins': 'civic',
    });
  });

  it('only references publications and builds that exist', () => {
    const pubIds = new Set(publications.map((pub) => pub.id));
    const buildIds = new Set(builds.map((build) => build.id));
    for (const theme of themes) {
      for (const id of theme.data.publications)
        expect(pubIds.has(id), `${theme.id} → ${id}`).toBe(true);
      for (const id of theme.data.builds)
        expect(buildIds.has(id), `${theme.id} → ${id}`).toBe(true);
    }
  });

  it('includes the required caveat wherever grounded/inferred numbers appear (facts.md §5.2)', () => {
    for (const theme of themes) {
      if (/\b505\b|44\.7%|59\.6%/.test(theme.body)) {
        expect(theme.body, theme.id).toContain('not that it is false');
        expect(theme.body, theme.id).toContain('does not test');
      }
    }
  });
});

describe('builds (facts.md §7, D29)', () => {
  it('only references themes that exist', () => {
    const themeIds = new Set(themes.map((t) => t.id));
    for (const build of builds) {
      for (const id of build.data.themes)
        expect(themeIds.has(id), `${build.id} → ${id}`).toBe(true);
    }
  });

  it('has a "Hardest bug & fix" only where facts.md §7 gives one (XPRIZE)', () => {
    expect(builds.filter((b) => b.data.hardestBug).map((b) => b.id)).toEqual([
      'xprize-avatar-robot',
    ]);
  });

  it('keeps builds without a description hidden', () => {
    const iot = builds.find((b) => b.id === 'iot-curiosity-detector')!;
    expect(iot.data.draft).toBe(true);
  });

  it('starts the XPRIZE video at 74 s (facts.md §7)', () => {
    const xprize = builds.find((b) => b.id === 'xprize-avatar-robot')!;
    expect(xprize.data.video).toMatchObject({ id: 'u9nYUBc-_s0', start: 74 });
  });
});

describe('talks and news (D26)', () => {
  it('dates DTRUE 2026 as Nov 19–20, 2026 with both wordings', () => {
    const dtrue = talks.find((talk) => talk.id === 'dtrue-2026')!;
    expect(dtrue).toMatchObject({ startDate: '2026-11-19', endDate: '2026-11-20' });
    expect(dtrue.wording?.upcoming).toMatch(/^Upcoming oral presentation/);
    expect(dtrue.wording?.past).toBe('Presented at DTRUE 2026');
    const item = news.find((n) => n.id === 'dtrue-2026')!;
    expect(item.event).toMatchObject({ start: '2026-11-19', end: '2026-11-20' });
  });

  it('never hard-codes tense in fixed news text', () => {
    for (const item of news) {
      if (item.text)
        expect(item.text, item.id).not.toMatch(/\b(upcoming|will present|next week)\b/i);
    }
  });
});

describe('blog schema (D41)', () => {
  const schema = blogSchema;
  const valid = {
    title: '中文标题',
    title_en: 'English title',
    summary_en: 'Two plain sentences that summarize the post. Nothing more than what it says.',
    date: '2026-11-01',
    zhihu_url: 'https://www.zhihu.com/question/1/answer/2',
    tags: ['learning'],
  };

  it('accepts a complete post and defaults lang to zh-CN', () => {
    expect(schema.parse(valid)).toMatchObject({ lang: 'zh-CN', draft: false });
  });

  it('rejects posts without an English title or summary, or with a non-Zhihu link', () => {
    expect(() => schema.parse({ ...valid, title_en: undefined })).toThrow();
    expect(() => schema.parse({ ...valid, summary_en: 'Too short.' })).toThrow();
    expect(() => schema.parse({ ...valid, zhihu_url: 'https://example.com/post' })).toThrow();
    expect(() => schema.parse({ ...valid, tags: [] })).toThrow();
  });

  it('accepts the synthetic fixture post used by end-to-end tests', () => {
    const { data } = readMarkdown(
      join(ROOT, 'tests', 'fixtures', 'blog', '2026-10-01-fixture-post', 'index.md'),
    );
    expect(schema.parse(data).lang).toBe('zh-CN');
  });
});

describe('visible text', () => {
  const visibleStrings: Array<[string, string]> = [
    ...themes.flatMap(
      (t) =>
        [
          [t.id, t.data.title],
          [t.id, t.data.summary],
          [t.id, t.body],
        ] as Array<[string, string]>,
    ),
    ...builds
      .filter((b) => !b.data.draft)
      .flatMap(
        (b) =>
          [
            [b.id, b.data.title],
            [b.id, b.data.summary],
            ...b.data.datasheet.map(
              (row) => [b.id, `${row.label} ${row.value}`] as [string, string],
            ),
          ] as Array<[string, string]>,
      ),
    ...publications.filter(isListedPublication).flatMap(
      (p) =>
        [
          [p.id, p.title],
          [p.id, p.notes.join(' ')],
        ] as Array<[string, string]>,
    ),
    ...news.map(
      (n) => [n.id, n.text ?? `${n.event?.upcoming} ${n.event?.past}`] as [string, string],
    ),
  ];

  it('contains no TODO or VERIFY markers', () => {
    for (const [id, text] of visibleStrings) expect(text, id).not.toMatch(/TODO|VERIFY|DRAFT/);
  });

  it('avoids the retired framing (facts.md §5.1)', () => {
    for (const [id, text] of visibleStrings) {
      expect(text, id).not.toMatch(/decision matrix|18% name-only|self-report missed 38%/i);
    }
  });

  it('avoids the words CLAUDE.md rules out', () => {
    for (const [id, text] of visibleStrings) {
      expect(text, id).not.toMatch(/\b(passionate|cutting-edge|leverage|innovative)\b/i);
    }
  });

  it('does not call the DTRUE work sole-authored (D46)', () => {
    for (const [id, text] of visibleStrings) expect(text, id).not.toMatch(/sole[- ]author/i);
  });
});

describe('blog posts (CLAUDE.md: alt text for every meaningful image; one h1)', () => {
  const blogDir = join(CONTENT, 'blog');
  const postFile = (dir: string) =>
    ['index.md', 'index.mdx'].map((name) => join(dir, name)).find((path) => existsSync(path));
  const posts = readdirSync(blogDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => postFile(join(blogDir, entry.name)))
    .filter((path): path is string => Boolean(path));
  const fixture = join(ROOT, 'tests', 'fixtures', 'blog', '2026-10-01-fixture-post', 'index.md');
  const bodies = [...posts, fixture].map((path) => ({
    path,
    body: readMarkdown(path).body,
  }));

  it('gives every Markdown and HTML image alt text', () => {
    for (const { path, body } of bodies) {
      expect(body, path).not.toMatch(/!\[[\s\p{P}]*\]\s*[([]/u); // ![](x), ![ ][ref], ![.](x)
      expect(body, path).not.toMatch(/<img\b(?![^>]*\balt\s*=\s*"[^"]*[^\s"][^"]*")[^>]*>/i);
    }
  });

  it('keeps the page h1 for the English title (no "# " headings in the body)', () => {
    for (const { path, body } of bodies) expect(body, path).not.toMatch(/^#\s/m);
  });
});
