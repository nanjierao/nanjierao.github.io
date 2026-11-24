// Daily notes (D71): the files in src/content/notes/ (the real site) and tests/fixtures/notes/
// (synthetic notes for the end-to-end tests), and the helpers the pages use.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isMap, isScalar, isSeq, parseDocument, Scalar } from 'yaml';
import { NOTE_LINE_MAX, noteSchema } from '../../src/content/schemas.ts';
import { PERSON } from '../../src/data/site.ts';
import {
  formatNoteDay,
  formatNoteMonth,
  groupNotesByMonth,
  isNoteDate,
  lineLang,
} from '../../src/lib/notes.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const SITE = join(ROOT, 'src', 'content', 'notes');
const FIXTURES = join(ROOT, 'tests', 'fixtures', 'notes');

/** Every note file, with what the YAML says and how each line is written. */
function readNotes(dir: string) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.yaml'))
    .map((name) => {
      const raw = readFileSync(join(dir, name), 'utf8');
      const doc = parseDocument(raw);
      const lines = isMap(doc.contents) ? doc.contents.get('lines', true) : undefined;
      const styles = isSeq(lines)
        ? lines.items.map((item) => (isScalar(item) ? item.type : 'not text'))
        : [];
      return {
        name,
        id: name.replace(/\.yaml$/, ''),
        raw,
        doc,
        data: doc.toJS() as unknown,
        styles,
      };
    });
}

const site = readNotes(SITE);
const fixtures = readNotes(FIXTURES);
const today = new Date().toISOString().slice(0, 10);

describe('daily notes on the site (D71)', () => {
  it('keeps only dated YAML files and the README in src/content/notes', () => {
    for (const name of readdirSync(SITE)) {
      if (name === 'README.md') continue;
      expect(name, 'a note is <YYYY-MM-DD>.yaml').toMatch(/^\d{4}-\d{2}-\d{2}\.yaml$/);
    }
  });

  for (const [where, notes] of [
    ['src/content/notes', site],
    ['tests/fixtures/notes', fixtures],
  ] as const) {
    it(`gives each note in ${where} a real date that has already come`, () => {
      for (const note of notes) {
        expect(isNoteDate(note.id), note.name).toBe(true);
        // Notes are dated in Jimmy's time zone, which is never ahead of UTC.
        expect(note.id <= today, `${note.name} is dated after ${today}`).toBe(true);
      }
    });

    it(`reads each note in ${where} with the schema, every line quoted`, () => {
      for (const note of notes) {
        expect(note.doc.errors, note.name).toEqual([]);
        expect(noteSchema.safeParse(note.data).error?.issues ?? [], note.name).toEqual([]);
        // A plain YAML line would end at " #" and could turn "Learned: …" into a key. Quoted
        // lines keep his words exactly.
        for (const style of note.styles)
          expect([Scalar.QUOTE_SINGLE, Scalar.QUOTE_DOUBLE], note.name).toContain(style);
      }
    });

    it(`keeps ${where} free of markers, other addresses and study identifiers`, () => {
      for (const note of notes) {
        const text = (noteSchema.parse(note.data).lines ?? []).join('\n');
        expect(text, note.name).not.toMatch(/TODO|VERIFY|DRAFT/);
        for (const address of text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? [])
          expect(address, `${note.name}: only the public address`).toBe(PERSON.email);
        // CLAUDE.md rule 12: no course number and no review-board or protocol number.
        expect(text.replace(/\b(?:CHI|ICER) 20\d{2}\b/g, ''), note.name).not.toMatch(
          /(?<![A-Za-z])[A-Za-z]{3}[\s-]*(?!(?:19|20)\d{2}(?!\d))\d{4}[A-Za-z]?(?![A-Za-z\d])/,
        );
        expect(text, note.name).not.toMatch(/\bIRB[\s#:-]*\d|\bprotocol\s+\S*\d/i);
      }
    });
  }

  it('labels the test notes as synthetic, and covers what the layout must handle', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(3);
    for (const note of fixtures) expect(note.raw, note.name).toMatch(/^# Synthetic daily note/);
    const lines = fixtures.flatMap((note) => noteSchema.parse(note.data).lines);
    expect(lines.some((line) => line.includes('#'))).toBe(true);
    expect(lines.some((line) => line.includes("'"))).toBe(true);
    expect(lines.some((line) => lineLang(line) === 'zh-CN')).toBe(true);
    expect(new Set(fixtures.map((note) => note.id.slice(0, 7))).size).toBeGreaterThan(1);
  });
});

describe('daily notes: the schema', () => {
  const lines = (...values: unknown[]) => noteSchema.safeParse({ lines: values }).success;

  it('takes one to five short lines', () => {
    expect(lines('One.')).toBe(true);
    expect(lines('One.', 'Two.', 'Three.')).toBe(true);
    expect(lines('1', '2', '3', '4', '5')).toBe(true);
    expect(lines()).toBe(false);
    expect(lines('1', '2', '3', '4', '5', '6')).toBe(false);
    expect(lines('x'.repeat(NOTE_LINE_MAX))).toBe(true);
    expect(lines('x'.repeat(NOTE_LINE_MAX + 1))).toBe(false);
  });

  it('refuses empty lines, padded lines, line breaks and anything but text', () => {
    expect(lines('')).toBe(false);
    expect(lines(' Padded.')).toBe(false);
    expect(lines('Two\nsentences.')).toBe(false);
    expect(lines({ Learned: 'a key, not a sentence' })).toBe(false);
    expect(noteSchema.safeParse({}).success).toBe(false);
  });
});

describe('daily notes: helpers', () => {
  it('accepts only real calendar days', () => {
    expect(isNoteDate('2026-11-25')).toBe(true);
    expect(isNoteDate('2028-02-29')).toBe(true);
    expect(isNoteDate('2026-02-29')).toBe(false);
    expect(isNoteDate('2026-13-01')).toBe(false);
    expect(isNoteDate('2026-11-31')).toBe(false);
    expect(isNoteDate('2026-1-05')).toBe(false);
    expect(isNoteDate('2026-11-25-notes')).toBe(false);
  });

  it('writes the day with its weekday, and the month with its year', () => {
    expect(formatNoteDay('2026-11-25')).toBe('Wednesday, November 25');
    expect(formatNoteDay('2027-01-01')).toBe('Friday, January 1');
    expect(formatNoteMonth('2026-11')).toBe('November 2026');
  });

  it('groups by month, newest month and newest day first', () => {
    const ids = ['2026-10-01', '2026-11-25', '2026-09-30', '2026-11-02', '2026-10-31'];
    expect(
      groupNotesByMonth(ids.map((id) => ({ id }))).map(({ month, notes }) => [
        month,
        notes.map((note) => note.id),
      ]),
    ).toEqual([
      ['2026-11', ['2026-11-25', '2026-11-02']],
      ['2026-10', ['2026-10-31', '2026-10-01']],
      ['2026-09', ['2026-09-30']],
    ]);
    expect(groupNotesByMonth([])).toEqual([]);
  });

  it('marks Chinese lines as Chinese, also with an English word inside', () => {
    expect(lineLang('今天把网站的新页面做好了。')).toBe('zh-CN');
    expect(lineLang('今天学会用 Playwright 截图。')).toBe('zh-CN');
    expect(lineLang('读了一篇 CHI 论文。')).toBe('zh-CN');
    expect(lineLang('Finished the notes page today.')).toBeUndefined();
    expect(lineLang('Cooked 红烧肉 for dinner.')).toBeUndefined();
    expect(lineLang('Wrote 饶楠杰 beside my name on the CV.')).toBeUndefined();
    expect(lineLang('2026: 12 of 12.')).toBeUndefined();
  });
});
