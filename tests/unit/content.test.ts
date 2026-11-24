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
import { FLAGS, PERSON } from '../../src/data/site.ts';
import { STATUS } from '../../src/data/cv.ts';

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
    .filter((name) => /\.mdx?$/.test(name))
    .map((name) => ({
      id: name.replace(/\.mdx?$/, ''),
      ...readMarkdown(join(CONTENT, dir, name)),
    }));
}

const publications = z.array(publicationSchema).parse(readYaml('publications.yaml'));
const talks = z.array(talkSchema).parse(readYaml('talks.yaml'));
const news = z.array(newsSchema).parse(readYaml('news.yaml'));
const themes = markdownDir('themes').map((t) => ({ ...t, data: themeSchema.parse(t.data) }));
const builds = markdownDir('builds').map((b) => ({
  ...b,
  data: buildSchema(imageStub).parse(b.data),
}));

describe('identity in the intro strip (facts.md §1, §2; D64)', () => {
  const facts = readFileSync(join(ROOT, 'content', 'facts.md'), 'utf8').replace(/\*\*/g, '');
  const section = (number: number) => {
    const start = facts.indexOf(`\n## ${number}. `);
    return facts.slice(start, facts.indexOf('\n## ', start + 1));
  };

  it('shows the Chinese name exactly as facts.md §1 gives it', () => {
    expect(section(1).match(/^- Chinese name: (\S+)/m)?.[1]).toBe(PERSON.chineseName);
  });

  it('builds the role line only from facts.md §2', () => {
    const lines = section(2);
    const status = lines.replace(/\s+/g, ' ');
    expect(status).toContain(`- ${STATUS.role} (Dept.`);
    expect(status).toContain(`(${STATUS.labShort.replace(' Lab', '')}) Lab`);
    expect(lines.match(/advised by (.+)$/m)?.[1]).toBe(STATUS.advisor);
    expect(STATUS.lab).toContain(STATUS.advisor);
    // /cv prints the whole sentence; the homepage puts Jimmy's shorter wording in brackets.
    const degree = lines.match(/^- (Defense passed .+)$/m)?.[1];
    expect(degree).toBe(STATUS.defense.replace(/\.$/, ''));
    expect(status).toContain(`("${STATUS.degreeNote}")`);
    expect(STATUS.role).not.toContain('candidate');
  });

  it('drops the bracketed note after the month facts.md §2 names (D26, D65)', () => {
    expect(STATUS.degreeNote).toContain('December 2026');
    expect(STATUS.defense).toContain('December 2026');
    expect(STATUS.degreeMonth).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });
});

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

describe('research themes (D45, D69)', () => {
  it('has the five theme pages grouped Personal · Embodied · Civic, and one ongoing study', () => {
    expect(themes.map((t) => t.id).sort()).toEqual([
      'civic-digital-twins',
      'data-analysis-through-ai',
      'embodied-learning',
      'grounding',
      'interest-identification',
      'teacher-support',
    ]);
    const contexts = Object.fromEntries(
      themes.filter((t) => t.data.context).map((t) => [t.id, t.data.context]),
    );
    expect(contexts).toEqual({
      'interest-identification': 'personal',
      grounding: 'personal',
      'teacher-support': 'personal',
      'embodied-learning': 'embodied',
      'civic-digital-twins': 'civic',
    });
    // A study that is still running is listed apart from the contexts (D69).
    expect(themes.filter((t) => t.data.status === 'ongoing').map((t) => t.id)).toEqual([
      'data-analysis-through-ai',
    ]);
    expect(() =>
      themeSchema.parse({ title: 'x', order: 1, summary: 'x', facts: ['5.9'] }),
    ).toThrow();
    expect(() =>
      themeSchema.parse({
        title: 'x',
        order: 1,
        summary: 'x',
        facts: ['5.9'],
        context: 'personal',
        status: 'ongoing',
      }),
    ).toThrow();
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

describe('the ongoing class study (facts.md §5.9, D69)', () => {
  const read = (...path: string[]) => readFileSync(join(ROOT, ...path), 'utf8');
  const facts = read('content', 'facts.md');
  const record = facts.slice(facts.indexOf('### 5.9 '), facts.indexOf('## 6. Publications'));
  const page = themes.find((t) => t.id === 'data-analysis-through-ai')!;
  /** The page as the repository holds it: front matter, comments and markup included. */
  const source = read('src', 'content', 'themes', 'data-analysis-through-ai.mdx');
  const decision = read('docs', 'DECISIONS.md')
    .split('\n')
    .find((line) => line.startsWith('| D69 |'))!;
  /** The site plan's words on the study: the line with its address, and its paragraph. */
  const sitePlan = read('docs', 'SITE_PLAN.md');
  const plan = [
    ...sitePlan.split('\n').filter((line) => line.includes('data-analysis-through-ai')),
    sitePlan.slice(
      sitePlan.indexOf('A study that is still running'),
      sitePlan.indexOf('no names and no course number.'),
    ),
  ].join('\n');
  const rule = /^12\. The ongoing class study[\s\S]*?(?=\n\n)/m.exec(read('CLAUDE.md'))![0];
  const qa = (
    parseYaml(read('content', 'qa-library.yaml')) as {
      items: Array<{ id: string; q: string; a: string; sources: string[] }>;
    }
  ).items.find((item) => item.id === 'class-study')!;
  const word = (
    parseYaml(read('content', 'wordcloud.yaml')) as {
      words: Array<{ text: string; link: string; blurb?: string }>;
    }
  ).words.find((item) => item.link === '/research/data-analysis-through-ai/')!;
  const entry = news.find((item) => item.id === 'class-study')!;

  /** The two lists of works, where other people's names belong. */
  const worksOnPage = source.slice(
    source.indexOf('## Work I build on (selected)'),
    source.indexOf('## Timeline'),
  );
  const worksInRecord = record.slice(record.indexOf('- Work he builds on (selected)'));
  const works = (text: string) =>
    text
      .replace(/\n {4,}/g, ' ')
      .split('\n')
      .filter((line) => /^\s*- .+https:\/\//.test(line))
      .map((line) => line.trim());

  /** Everything the repository says about the study, without the two lists of works. */
  const everywhere: Array<[where: string, text: string]> = [
    ['the page’s source', source.replace(worksOnPage, '')],
    ['facts.md §5.9', record.replace(worksInRecord, '')],
    ['news', `${entry.text} ${entry.link?.label}`],
    ['word cloud', `${word.text} ${word.blurb}`],
    ['Q&A', `${qa.q} ${qa.a}`],
    ['D69', decision],
    ['SITE_PLAN.md', plan],
    ['CLAUDE.md, content rule 12', rule],
  ];

  it('is marked ongoing and opens with its own status line', () => {
    expect(page.data.status).toBe('ongoing');
    expect(page.data.context).toBeUndefined();
    expect(page.data.lede).toBe(false);
    expect(page.data.facts).toEqual(['5.9']);
    expect(page.body.trimStart()).toMatch(
      /^\*\*Status:\*\* ongoing since November 2026\. This page describes the design of the study\. It holds no data and no results, and it does not say who takes part\./,
    );
    expect(record).toContain('Status: ongoing since November 2026.');
  });

  it('keeps the sections of Jimmy’s text, in his order', () => {
    expect([...page.body.matchAll(/^## (.+)$/gm)].map((match) => match[1])).toEqual([
      'In short',
      'Why I started it',
      'The course',
      'What I ask',
      'How the study works',
      'How the students are protected',
      'What this study can and cannot show',
      'What may be new',
      'Work I build on (selected)',
      'Timeline',
      'How this connects to my other work',
      'How AI is used in this research',
      'Team',
      ...(PERSON.email ? ['Contact'] : []),
    ]);
    // The first reason, as the page gives it.
    expect(page.body).toContain(
      '- I took the course in Fall 2024, as a PhD student in human-centered computing. The instructor acknowledged that students use large language models, encouraged it and taught us how to use them, and we still learned the subject.\n',
    );
  });

  it('holds back the Contact section until the site shows a contact address', () => {
    // His text closes with "My contact details are on this site." That is only true once
    // facts.md §1 names the public address, so the section returns together with it.
    expect(page.body.includes('My contact details are on this site.')).toBe(PERSON.email !== null);
    expect(source).toContain('# TODO(jimmy): his text closes with one more section, "## Contact"');
    expect(record).toContain('`TODO(jimmy)`: pick the\n  public address');
  });

  it('gives each position a row header in its table, with his words', () => {
    expect([...source.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map((m) => m[1])).toEqual([
      'Position',
      'Sees',
      'Does not see',
      'Writes',
    ]);
    expect([...source.matchAll(/<th scope="row">([^<]+)<\/th>/g)].map((m) => m[1])).toEqual([
      'Student now (those who choose to join)',
      'Former student, now analyst (I)',
      'Teaching assistant',
      'Designer and instructor',
    ]);
    expect(source.match(/<td>/g)).toHaveLength(12);
  });

  // The rules of facts.md §5.9 are held without a list of the names, which would publish them.
  /** Venue and year, as the lists of works write them: not a course number. */
  const VENUE_YEAR = /\b(?:CHI|ICER) 20\d{2}\b/g;
  const FORBIDDEN: Array<[what: string, pattern: RegExp]> = [
    // Three letters and four digits, however written: "ABC 1234", "abc-1234", "ABC1234C".
    [
      'a course number',
      /(?<![A-Za-z])[A-Za-z]{3}[\s-]*(?!(?:19|20)\d{2}(?!\d))\d{4}[A-Za-z]?(?![A-Za-z\d])/,
    ],
    ['a course number', /(?<![A-Za-z])[A-Z]{3}[\s-]*\d{4}[A-Za-z]?(?![A-Za-z\d])/],
    ['a person with a title', /\b(?:Dr|Prof|Professor|Mr|Mrs|Ms|Mx)\.?\s+\p{Lu}/u],
    ['an email address', /[\w.+-]+@[\w-]+\.[\w.]+/],
    ['a review-board or protocol number', /\bIRB|\b[A-Z]{2,4}\s?#?\s?\d{5,}\b|\bprotocol\s+\S*\d/],
    ['an ID number', /(?<!\d)\d{4}-?\d{4}(?!\d)/],
    [
      'a head count',
      /\b(?:\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:students?|co-authors?|authors?|participants?|people|classmates?)\b/i,
    ],
    [
      'who has joined',
      /\b(?:has|have|had)\s+(?:signed\s+up|joined|enrolled|agreed|declined|withdrawn)\b|\bsigned\s+up\b|\benrolled\b|\bwithdrew\b/i,
    ],
  ];

  it('names no participant and no course, and says nothing about who takes part', () => {
    const texts: Array<[string, string]> = [
      ...everywhere,
      ['the works on the page', worksOnPage],
      ['the works in facts.md', worksInRecord],
    ];
    for (const [where, text] of texts) {
      for (const [what, pattern] of FORBIDDEN)
        expect(text.replace(VENUE_YEAR, ''), `${what} in ${where}`).not.toMatch(pattern);
    }
    // People appear by role only.
    expect(
      page.body.slice(page.body.indexOf('## Team')).trim().split('\n').filter(Boolean),
    ).toEqual([
      '## Team',
      '- I designed the study and lead it.',
      "- Co-authors: the course's instructor, the course's teaching assistant, and students of the course who choose to join.",
      ...(PERSON.email
        ? [
            '## Contact',
            'Questions about the project are welcome. My contact details are on this site.',
          ]
        : []),
    ]);
    expect(record).toContain('It names no participants');
    expect(record).toContain('Study materials');
    expect(rule).toContain('Never name');
    expect(plan).toContain('The first one is the class study');
  });

  // A name is a capitalized word. Each one these texts use is listed here, so a new one fails
  // this test and gets looked at: an ordinary word is added to the list; a person's name or a
  // course title is taken out of the text instead (facts.md §5.9).
  const KNOWN_CAPITALS = new Set(
    (
      'A After AI Ammari An Analysis Analyzing Change Co-authors Connection Contact CV D45 D69 ' +
      'December Designer Does Each Every Everyone Facts Fall Florida For Former Four Here His How HTML ' +
      'I In It Its January Jimmy Kang Knowing Last Limits March Meetings Method Much My Never No ' +
      'Notes Nov November One Ongoing Only PhD Position Protection Q Questions Records Research ' +
      'Rules Sees Several Short Since Some Source Sources Started Status Student Students Study ' +
      'Taking Teaching Team Tests The Their Then These They This Those Time Timeline TODO ' +
      'University Until What When Where Why Writes Writing'
    ).split(' '),
  );
  const capitals = (text: string) => [
    ...new Set(
      (text.match(/(?<![\p{L}\p{N}])\p{Lu}[\p{L}\p{N}'’-]*/gu) ?? []).map((token) =>
        token.replace(/['’]s$/, '').replace(/['’-]+$/, ''),
      ),
    ),
  ];

  it('uses no capitalized word that has not been looked at', () => {
    for (const [where, text] of everywhere)
      expect(
        capitals(text).filter((token) => !KNOWN_CAPITALS.has(token)),
        where,
      ).toEqual([]);
  });

  it('lists the same fourteen works on the page and in facts.md, each with its link', () => {
    expect(works(worksOnPage)).toHaveLength(14);
    expect(works(worksInRecord)).toEqual(works(worksOnPage));
    for (const work of works(worksOnPage))
      expect(work).toMatch(
        /^- \p{Lu}[^()]+ \(20\d{2}\)\. .+ https:\/\/(?:doi\.org\/10\.\d{4}\/[\d.]+|arxiv\.org\/abs\/\d{4}\.\d{5})$/u,
      );
  });

  it('holds no data and no results, and says how the students are protected', () => {
    expect(page.body).toContain(
      'The University of Florida determined the study exempt in November 2026.',
    );
    expect(page.body).toContain('No course records and no grades are used.');
    for (const [where, text] of everywhere)
      expect(text, where).not.toMatch(/\b(?:we|I|the study) found\b|\bresults? show/i);
  });

  it('gives the same short account in the news, the word cloud and the Q&A library', () => {
    expect(entry.date).toBe('2026-11');
    expect(entry.link?.href).toBe('/research/data-analysis-through-ai/');
    expect(entry.facts).toEqual(['5.9']);
    expect(word.text).toBe('collaborative autoethnography');
    expect(qa.sources).toEqual(['/research/data-analysis-through-ai/']);
    for (const text of [entry.text!, qa.a]) {
      expect(text).toContain('one university course');
      expect(text).toContain('through an AI assistant');
      expect(text).toContain('collaborative autoethnography');
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
            [b.id, b.body],
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
