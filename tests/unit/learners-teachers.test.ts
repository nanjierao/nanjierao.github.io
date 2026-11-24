// The home page's "Modeling Learners and Teachers" section (D66): every sentence and number it
// shows comes from one data module, so the checks here cover them (section headings and fixed
// labels are in the component; the end-to-end test reads the rendered section). Numbers must be in content/facts.md and stay
// with the study facts.md gives them to, the term is "learner model", and the copy has no em
// dashes.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import * as page from '../../src/data/learners-teachers.ts';
import { NAV } from '../../src/data/site.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const FACTS = readFileSync(join(ROOT, 'content', 'facts.md'), 'utf8').replace(/\*\*/g, '');
/** facts.md on one line, without emphasis marks, for matching sentences and titles. */
const FACTS_LINE = FACTS.replace(/[*_]/g, '').replace(/\s+/g, ' ');
/** The page uses typographic apostrophes; facts.md uses straight ones. */
const plain = (text: string) => text.replace(/’/g, "'");

/** Every string in the module, however deeply nested. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

const COPY = strings(page).filter((text) => !text.startsWith('/') && !/^[a-z0-9-]+$/.test(text));
const LINKS = strings(page).filter((text) => text.startsWith('/'));

describe('copy of the learners-and-teachers section', () => {
  it('shows only numbers that are in facts.md', () => {
    for (const text of COPY) {
      const numbers = (
        text.match(/(?<![\w.])(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?|\.\d+)/g) ?? []
      ).filter((n) => !/^\d$/.test(n));
      for (const number of numbers) {
        const pattern = new RegExp(`(?<![\\d.,])${number.replace(/[.]/g, '\\.')}(?![\\d])`);
        expect(pattern.test(FACTS), `"${number}" in "${text}" is not in facts.md`).toBe(true);
      }
    }
  });

  it('says "learner model" and never "world model"', () => {
    const all = COPY.join(' ');
    expect(all).toContain('learner model');
    expect(all).not.toMatch(/world model/i);
  });

  it('has no em dashes, markers or words CLAUDE.md rules out', () => {
    for (const text of COPY) {
      expect(text).not.toContain('—');
      expect(text).not.toMatch(/TODO|VERIFY|DRAFT/);
      expect(text).not.toMatch(/\b(passionate|cutting-edge|leverage|innovative)\b/i);
    }
  });

  it('keeps the §5.2 caveat next to the inferred share', () => {
    const note = page.GROUNDING_NOTE.join(' ');
    expect(note).toContain('44.7%');
    expect(note).toContain('Inferred does not mean false');
    expect(note).toContain('does not test truth');
  });

  it('quotes the dissertation takeaway word for word', () => {
    const quote = /“([^”]+)”/.exec(page.LEARNER_STUDIES[0]!.found)![1]!;
    expect(FACTS_LINE).toContain(plain(quote));
  });

  it('gives every work its own title, exactly as facts.md has it', () => {
    for (const study of page.LEARNER_STUDIES) {
      expect(FACTS_LINE, study.id).toContain(plain(study.title));
      expect(study.label, study.id).not.toBe(study.title);
    }
  });

  it('keeps each number with the study and the meaning facts.md gives it', () => {
    const [dissertation, icalt, icids, ieeevr] = page.LEARNER_STUDIES;
    const coding = page.STEPS[2]!.items[2]!.detail;
    const pinned: Array<[inFacts: RegExp, copy: string, inCopy: RegExp]> = [
      [/transcripts of 35 college students/, dissertation!.who, /35 in the asking study/],
      [
        /77 initial participants, 32 retained after data-quality screening/,
        dissertation!.who,
        /77 initial participants in the records study, 32 after data-quality screening/,
      ],
      [
        /Browsing history had higher precision: 69\.8% confirmed vs\. 56\.3% for posts/,
        icalt!.found,
        /69\.8% of the interests found in browsing history and 56\.3% of those found in posts/,
      ],
      [
        /Posts' explanations carried more grounded information per confirmed interest \(2\.14 vs\. 1\.58/,
        icalt!.found,
        /Posts’ explanations carried more grounded information .*\(2\.14 units compared with 1\.58\)/,
      ],
      [/Hands as Narrators \(ICIDS 2026.{0,200}?N = 24/, icids!.who, /^24 participants/],
      [/took about a quarter of writing time/, icids!.found, /about a quarter of writing time/],
      [
        /IEEE VR 2020\): Latin-square within-subjects study, N = 25/,
        ieeevr!.who,
        /^25 participants/,
      ],
      [
        /1,130 units . 625 grounded and 505 \(44\.7%\) inferred/,
        page.GROUNDING_NOTE[0]!,
        /Of 1,130 units in its explanations, 505 \(44\.7%\) were inferred/,
      ],
      [
        /Study 1 \(asking\).*two coders; on 25 double-coded transcripts they agreed on 90\.7% of 700 code-by-transcript decisions; code-level Cohen's κ = \.51/,
        coding,
        /^in the asking study, two coders agreed on 90\.7% of decisions on 25 double-coded transcripts \(Cohen’s κ = \.51\)$/,
      ],
      [
        /Survey of 81 studies on teacher autonomy vs\. automation/,
        page.TEACHER_ITEMS[3]!.text,
        /^A survey of 81 studies on teacher autonomy and automation/,
      ],
      [
        /32 retained after data-quality screening/,
        page.SOURCES_FIGURE.note,
        /^32 participants after/,
      ],
    ];
    for (const [inFacts, copy, inCopy] of pinned) {
      expect(FACTS_LINE, String(inFacts)).toMatch(inFacts);
      expect(copy).toMatch(inCopy);
    }
  });

  it('credits the dataset the asking study used, and scopes the diagram to the dissertation', () => {
    expect(page.LEARNER_STUDIES[0]!.observed).toContain('existing transcripts');
    expect(page.LEARNER_STUDIES[0]!.observed).toContain('Dr. Abhishek Kulkarni’s dataset');
    expect(FACTS_LINE).toContain("Dr. Abhishek Kulkarni's dataset");
    const diagram = page.STEPS.flatMap((step) => step.items.map((item) => item.detail)).join(' ');
    expect(diagram).not.toMatch(/gaze|keystroke/);
    expect(page.STEPS_NOTE).toContain('dissertation');
  });
});

describe('publications and links in the learners-and-teachers section', () => {
  const publications = parseYaml(
    readFileSync(join(ROOT, 'src', 'content', 'publications.yaml'), 'utf8'),
  ) as Array<{ id: string; type: string; verify?: boolean; firstAuthor: boolean }>;
  const listed = (id: string) =>
    publications.find((pub) => pub.id === id && pub.type !== 'in-preparation' && !pub.verify);

  it('lists the papers in the order of the outline, all of them published and listed', () => {
    expect([...page.TEACHER_PUBLICATIONS]).toEqual([
      'icalt-2023-context-for-contextualizing',
      'hcii-2022-information-retrieval',
      'icalt-2021-visual-efficiency',
    ]);
    expect([...page.BREADTH_PUBLICATIONS]).toEqual([
      'chi-2020-self-avatars',
      'hcomp-2020-explanation-types',
      'interact-2023-everyday-inspired-movies',
      'icids-2019-emotional-priming',
    ]);
    for (const id of [...page.TEACHER_PUBLICATIONS, ...page.BREADTH_PUBLICATIONS]) {
      expect(listed(id), id).toBeDefined();
    }
    // "three of them as a co-author"
    expect(page.BREADTH_PUBLICATIONS.filter((id) => !listed(id)!.firstAuthor)).toHaveLength(3);
  });

  it('links only to pages and citations that exist', () => {
    expect(LINKS.length).toBeGreaterThan(5);
    for (const link of LINKS) {
      const [path, anchor] = link.split('#') as [string, string | undefined];
      const research = /^\/research\/([a-z0-9-]+)\/$/.exec(path);
      const build = /^\/builds\/([a-z0-9-]+)\/$/.exec(path);
      if (research) {
        const base = join(ROOT, 'src', 'content', 'themes', research[1]!);
        expect(existsSync(`${base}.md`) || existsSync(`${base}.mdx`), link).toBe(true);
      } else if (build) {
        expect(existsSync(join(ROOT, 'src', 'content', 'builds', `${build[1]}.md`)), link).toBe(
          true,
        );
      } else {
        expect(path, link).toBe('/publications/');
        expect(listed(anchor!), link).toBeDefined();
      }
    }
  });

  it('is a section of the home page, with no tab of its own', () => {
    expect(NAV.map((item) => item.href)).toEqual([
      '/research/',
      '/publications/',
      '/builds/',
      '/teaching/',
      '/cv/',
      '/blog/',
      '/about/',
    ]);
    expect(existsSync(join(ROOT, 'src', 'pages', 'learners-and-teachers.astro'))).toBe(false);
    const home = readFileSync(join(ROOT, 'src', 'pages', 'index.astro'), 'utf8');
    expect(home.indexOf('<WordCloud />')).toBeLessThan(home.indexOf('<LearnersTeachers />'));
    expect(home.indexOf('<LearnersTeachers />')).toBeLessThan(
      home.indexOf('id="research-heading"'),
    );
  });
});
