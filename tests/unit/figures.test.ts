// Figures and the homepage word cloud: every number they show must be in content/facts.md, the
// parts of each bar must add up, and every word must link to a page that exists today.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { WORD_GROUPS, wordSchema } from '../../src/content/schemas.ts';
import {
  GROUNDING,
  STUDY1_KNOWLEDGE,
  STUDY1_STATS,
  STUDY2_SOURCES,
  STUDY2_STATS,
  CSUDT_REPLAY,
  SEG_DIMENSIONS,
  type SplitRow,
} from '../../src/data/figures.ts';
import { TIMELINE } from '../../src/data/cv.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const FACTS = readFileSync(join(ROOT, 'content', 'facts.md'), 'utf8').replace(/\*\*/g, '');

/** Numbers as written, e.g. "69.8", ".44", "1,130", "38.2" (a lone "1"–"9" is too common to test). */
function numbersIn(text: string): string[] {
  return (text.match(/(?<![\w.])(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?|\.\d+)/g) ?? []).filter(
    (n) => !/^\d$/.test(n),
  );
}

function expectInFacts(text: string, where: string): void {
  for (const number of numbersIn(text)) {
    const pattern = new RegExp(`(?<![\\d.,])${number.replace(/[.]/g, '\\.')}(?![\\d])`);
    expect(pattern.test(FACTS), `${where}: "${number}" is not in facts.md`).toBe(true);
  }
}

const percent = (part: number, whole: number, digits: number) =>
  ((part / whole) * 100).toFixed(digits);

describe('figure numbers (src/data/figures.ts)', () => {
  it('come from facts.md', () => {
    for (const metric of STUDY2_SOURCES.metrics) {
      for (const datum of metric.values) expectInFacts(datum.display, metric.label);
      if (metric.note) expectInFacts(metric.note, metric.label);
    }
    for (const stat of [...STUDY1_STATS, ...STUDY2_STATS]) {
      expectInFacts(`${stat.value} ${stat.label}`, stat.label);
    }
    for (const row of [...STUDY1_KNOWLEDGE, ...GROUNDING]) {
      expectInFacts(`${row.label} ${row.total.display} ${row.total.unit}`, row.label);
      for (const segment of row.segments) {
        expectInFacts(
          `${segment.display} ${segment.share ?? ''}`,
          `${row.label}: ${segment.label}`,
        );
      }
    }
    expectInFacts(`${CSUDT_REPLAY.hours} ${CSUDT_REPLAY.firstConfirmation.display}`, 'replay');
    expect(FACTS).toContain(`at the storm's peak, ${CSUDT_REPLAY.peak.confirmedCells} confirmed`);
    expect(FACTS).toContain(`and ${CSUDT_REPLAY.peak.openQuests} open quests`);
    for (const dimension of SEG_DIMENSIONS) expect(FACTS).toContain(dimension);
  });

  it('show values that match their display text', () => {
    for (const metric of STUDY2_SOURCES.metrics) {
      for (const datum of metric.values) {
        expect(Number(datum.display.replace('%', ''))).toBe(datum.value);
        expect(datum.value).toBeLessThanOrEqual(metric.max);
      }
    }
  });

  it('split bars add up, and their shares match the counts', () => {
    const check = (row: SplitRow) => {
      const sum = row.segments.reduce((total, segment) => total + segment.value, 0);
      expect(sum, row.label).toBe(row.total.value);
      expect(Number(row.total.display.replace(/,/g, '')), row.label).toBe(row.total.value);
      for (const segment of row.segments) {
        // A remainder facts.md doesn't state is drawn but not numbered.
        if (segment.display) expect(Number(segment.display), segment.label).toBe(segment.value);
        else expect(segment.kind, segment.label).toBe('rest');
        if (!segment.share) continue;
        const digits = segment.share.includes('.') ? 1 : 0;
        expect(segment.share, `${row.label}: ${segment.label}`).toBe(
          `(${percent(segment.value, row.total.value, digits)}%)`,
        );
      }
    };
    [...STUDY1_KNOWLEDGE, ...GROUNDING].forEach(check);
  });

  it('use grounded/inferred styling only on the grounding check', () => {
    for (const row of STUDY1_KNOWLEDGE) {
      for (const segment of row.segments) expect(['focus', 'rest']).toContain(segment.kind);
    }
    for (const row of GROUNDING) {
      expect(row.segments.map((segment) => segment.kind).sort()).toEqual(['grounded', 'inferred']);
    }
  });
});

describe('theme pages', () => {
  const dir = join(ROOT, 'src', 'content', 'themes');
  const bodies = readdirSync(dir)
    .filter((name) => /\.mdx?$/.test(name))
    .map((name) => {
      const text = readFileSync(join(dir, name), 'utf8');
      const body = text.slice(text.indexOf('\n---\n', 4) + 5);
      // Code lines (imports) and JSX attribute names carry no facts.
      return { name, body: body.replace(/^import .*$/gm, '') };
    });

  it('show only numbers that are in facts.md', () => {
    for (const { name, body } of bodies) expectInFacts(body, name);
  });
});

describe('CV timeline (src/data/cv.ts)', () => {
  it('uses dates in a form the timeline can draw', () => {
    for (const { items } of TIMELINE) {
      for (const item of items) {
        expect(item.start, item.label).toMatch(/^\d{4}(?:-\d{2})?$/);
        if (item.end) expect(item.end, item.label).toMatch(/^(?:\d{4}(?:-\d{2})?|present)$/);
        expect(item.when, item.label).toMatch(/\d{4}/);
      }
    }
  });
});

describe('homepage word cloud (content/wordcloud.yaml)', () => {
  const raw = parseYaml(readFileSync(join(ROOT, 'content', 'wordcloud.yaml'), 'utf8')) as {
    words: unknown[];
  };
  const words = raw.words.map((word) => wordSchema.parse(word));

  const themeIds = readdirSync(join(ROOT, 'src', 'content', 'themes')).map((name) =>
    name.replace(/\.mdx?$/, ''),
  );
  const publishedBuilds = readdirSync(join(ROOT, 'src', 'content', 'builds'))
    .filter(
      (name) =>
        !/^draft:\s*true$/m.test(readFileSync(join(ROOT, 'src/content/builds', name), 'utf8')),
    )
    .map((name) => name.replace(/\.md$/, ''));
  const PLACEHOLDERS = ['/hands/', '/ask/', '/life/'];

  function pageExists(link: string): boolean {
    const research = /^\/research\/([a-z0-9-]+)\/$/.exec(link);
    if (research) return themeIds.includes(research[1]!);
    const build = /^\/builds\/([a-z0-9-]+)\/$/.exec(link);
    if (build) return publishedBuilds.includes(build[1]!);
    const pages = join(ROOT, 'src', 'pages');
    return (
      existsSync(join(pages, link, 'index.astro')) ||
      existsSync(join(pages, `${link.replace(/\/$/, '')}.astro`))
    );
  }

  it('has words in every group, each text once', () => {
    for (const group of WORD_GROUPS) {
      expect(words.filter((word) => word.portal === group).length).toBeGreaterThan(3);
    }
    const texts = words.map((word) => word.text.toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('links every word to a page that exists, not a coming-soon placeholder', () => {
    for (const word of words) {
      expect(pageExists(word.link), `${word.text} → ${word.link}`).toBe(true);
      expect(PLACEHOLDERS, word.text).not.toContain(word.link);
    }
  });

  it('keeps blurbs free of markers, and their numbers in facts.md', () => {
    for (const word of words) {
      if (!word.blurb) continue;
      expect(word.blurb, word.text).not.toMatch(/TODO|VERIFY|DRAFT/);
      expect(word.blurb, word.text).not.toMatch(
        /\b(passionate|cutting-edge|leverage|innovative)\b/i,
      );
      expectInFacts(word.blurb, word.text);
    }
  });
});
