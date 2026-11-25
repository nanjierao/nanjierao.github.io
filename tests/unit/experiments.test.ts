// The Experiments page (D74): every row is content/facts.md §5.10, the table Jimmy gave on
// Nov 25, 2026, cell for cell; the copy around it keeps to his rules (no "randomized
// controlled trial", none of the analyses he never ran, his author position on co-authored
// studies), and the counts on the home page follow the table.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import * as experiments from '../../src/data/experiments.ts';
import { MENTORING } from '../../src/data/cv.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const FACTS = readFileSync(join(ROOT, 'content', 'facts.md'), 'utf8');
/** facts.md on one line, without emphasis marks, for matching sentences across line breaks. */
const FACTS_LINE = FACTS.replace(/\*/g, '').replace(/\s+/g, ' ');
/** The site uses typographic apostrophes; facts.md uses straight ones. */
const plain = (text: string) => text.replace(/’/g, "'");

/** The rows of the Markdown table that follows `heading` in facts.md §5.10. */
function factsTable(heading: string): Array<Record<string, string>> {
  const section = FACTS.slice(FACTS.indexOf('### 5.10 '), FACTS.indexOf('## 6. Publications'));
  const start = section.indexOf(heading);
  expect(start, heading).toBeGreaterThan(-1);
  const lines = section
    .slice(start)
    .split('\n')
    .slice(1)
    .filter((line) => line.trim() !== '');
  const end = lines.findIndex((line) => !line.startsWith('|'));
  const table = end === -1 ? lines : lines.slice(0, end);
  const cells = (line: string) =>
    line
      .slice(1, -1)
      .split(' | ')
      .map((cell) => cell.trim());
  const [header, , ...rows] = table;
  const names = cells(header!);
  return rows.map((row) => Object.fromEntries(cells(row).map((cell, i) => [names[i], cell])));
}

const FIRST = factsTable('First-author studies:');
const CO = factsTable('Co-authored studies');

const publications = parseYaml(
  readFileSync(join(ROOT, 'src', 'content', 'publications.yaml'), 'utf8'),
) as Array<{
  id: string;
  authors: string[];
  year?: number;
  title: string;
  verify?: boolean;
  type: string;
  firstAuthor: boolean;
  url?: string;
}>;
const pub = (id: string) => publications.find((item) => item.id === id)!;

/** All the words the page shows, besides the citations from publications.yaml. */
const COPY = [
  experiments.TITLE,
  experiments.DESCRIPTION,
  ...experiments.INTRO,
  experiments.CAPTION,
  ...experiments.COLUMNS,
  ...Object.values(experiments.GROUPS),
  ...[...experiments.FIRST_AUTHOR, ...experiments.CO_AUTHORED].flatMap((row) => [
    row.note ?? '',
    row.role,
    row.design,
    row.participants,
    row.comparison,
    row.analysis,
    row.scenes?.label ?? '',
  ]),
  ...experiments.NOTES.flatMap((note) => [note.title, ...note.text]),
  experiments.SUMMARY_LINE,
  experiments.LINK_LABEL,
].join('\n');

describe('the Experiments page (D74)', () => {
  it('has one row per study in facts.md §5.10, in its order, with its cells word for word', () => {
    expect(FIRST).toHaveLength(7);
    expect(CO).toHaveLength(3);
    const check = (rows: experiments.ExperimentRow[], facts: Array<Record<string, string>>) => {
      expect(rows).toHaveLength(facts.length);
      rows.forEach((row, i) => {
        const fact = facts[i]!;
        const where = fact['Study']!.slice(0, 40);
        expect(plain(row.design), where).toBe(fact['Design']);
        expect(plain(row.participants), where).toBe(fact['Participants']);
        expect(plain(row.comparison), where).toBe(fact['Comparison']);
        // The AR glasses row shows its analysis without the quiz scores until Jimmy says which
        // condition each belongs to (facts.md §5.4 reads the other way; TODO(jimmy)).
        if (row.paper === 'ieeevr-2020-ar-smart-glasses')
          expect(fact['Analysis']!.startsWith(`${row.analysis};`), where).toBe(true);
        else expect(plain(row.analysis), where).toBe(fact['Analysis']);
        if (fact['My position']) expect(row.role, where).toBe(fact['My position']);
      });
    };
    check(experiments.FIRST_AUTHOR, FIRST);
    check(experiments.CO_AUTHORED, CO);
  });

  it('cites each study’s own paper, by its authors and year, and links what facts.md links', () => {
    const rows = [...experiments.FIRST_AUTHOR, ...experiments.CO_AUTHORED];
    const facts = [...FIRST, ...CO];
    rows.forEach((row, i) => {
      const study = facts[i]!['Study']!;
      if (!row.paper) {
        // The dissertation's Study 1: no paper of its own.
        expect(study).toMatch(/^Dissertation Study 1 \(2026\), secondary analysis$/);
        expect(row.study!.authors).toEqual(['Rao, N.']);
        expect(FACTS_LINE).toContain(plain(row.study!.title));
        return;
      }
      const paper = pub(row.paper);
      expect(paper, row.paper).toBeDefined();
      expect(paper.verify, row.paper).toBeFalsy();
      expect(paper.type, row.paper).not.toBe('in-preparation');
      // "Rao, Huang, Kulkarni, Ragan, Chu." in facts.md is the paper's author list, in order.
      const surnames = paper.authors.map((author) => author.split(',')[0]).join(', ');
      expect(study.startsWith(`${surnames}.`), row.paper).toBe(true);
      expect(study, row.paper).toContain(String(paper.year));
      // A DOI shown on the page is one facts.md gives.
      if (paper.url) expect(FACTS, row.paper).toContain(paper.url.replace('https://doi.org/', ''));
    });
    // The co-authored studies are the papers Jimmy did not lead, and say his position.
    for (const row of experiments.CO_AUTHORED) {
      expect(pub(row.paper!).firstAuthor, row.paper).toBe(false);
      expect(row.role).toMatch(/^(Third|Fourth) author$/);
    }
    for (const row of experiments.FIRST_AUTHOR)
      if (row.paper) expect(pub(row.paper).firstAuthor, row.paper).toBe(true);
  });

  it('lists newest first within each group', () => {
    for (const group of [experiments.FIRST_AUTHOR, experiments.CO_AUTHORED]) {
      const years = group.map((row) => (row.paper ? pub(row.paper).year! : row.study!.year));
      expect(years).toEqual([...years].sort((a, b) => b - a));
    }
  });

  it('counts six experiments run as first author and three co-authored, as the home page says', () => {
    const run = experiments.FIRST_AUTHOR.filter((row) => row.role === 'First author');
    expect(run).toHaveLength(6);
    expect(experiments.CO_AUTHORED).toHaveLength(3);
    expect(experiments.SUMMARY_LINE).toBe(
      'I have run six controlled experiments as first author and three more as co-author.',
    );
    expect(FACTS).toMatch(/Count: \*\*six\*\* controlled experiments as first author/);
    expect(FACTS).toMatch(/and \*\*three\*\* more\s+as co-author/);
  });

  it('claims only what the designs support, in Jimmy’s words', () => {
    const claims = experiments.NOTES.find((note) => note.id === 'claims')!.text.join(' ');
    expect(claims).toContain(
      'The experiments compare conditions within participants, in counterbalanced or randomized order.',
    );
    expect(claims).toContain('assigned participants to conditions at random');
    expect(claims).toContain(
      'My dissertation’s Study 1 reports an association, not an effect, because what students disclosed was not assigned.',
    );
    // Only HCOMP 2020 assigned participants at random, and Jimmy was its third author.
    expect(claims).toContain('One co-authored study, AAAI HCOMP 2020,');
    for (const term of [
      /randomi[sz]ed controlled trial/i,
      /\bRCT\b/,
      /\bmatch(ed|ing)\b/i,
      /\bweight(ed|ing)\b/i,
      /difference-in-differences/i,
      /field (evaluation|study|trial)/i,
      /\bretention\b/i,
      /\btransfer\b/i,
      /\bIRT\b|item response/i,
      /meta-analys/i,
      /\bled\b|\bleading\b/i,
    ])
      expect(COPY).not.toMatch(term);
  });

  it('gives the mentoring and reviewing lines as facts.md §9 has them, on the CV too', () => {
    for (const line of experiments.MENTORING_REVIEWING) {
      expect(FACTS_LINE).toContain(plain(line));
      expect(MENTORING).toContain(line);
    }
    expect(experiments.INTRO.join(' ')).toContain(
      'When I use AI in research, every reported number is re-derived from the data, every claim traces to a source, and every decision is logged.',
    );
    expect(FACTS_LINE).toContain(
      'When I use AI in research, every reported number is re-derived from the data, every claim traces to a source, and every decision is logged.',
    );
  });

  it('keeps the copy plain: first person, no em dashes, none of the words CLAUDE.md rules out', () => {
    expect(COPY).not.toContain('—');
    expect(COPY).not.toMatch(/\b(passionate|cutting-edge|leverage|innovative)\b/i);
    expect(COPY).not.toMatch(/TODO|VERIFY|DRAFT/);
    expect(experiments.INTRO.join(' ')).toMatch(/^I /);
    expect(experiments.INTRO.length).toBeLessThanOrEqual(3);
    // No job-specific framing.
    expect(COPY).not.toMatch(/\b(employer|position|posting|application|hiring|candidate)\b/i);
  });
});
