// Daily notes (D71): the files in src/content/notes/ (the real site) and tests/fixtures/notes/
// (synthetic notes for the end-to-end tests), and the helpers the pages use.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isMap, isScalar, isSeq, parseDocument, Scalar } from 'yaml';
import { NOTE_LINE_MAX, noteSchema } from '../../src/content/schemas.ts';
import { TEACHING_ASSISTANT } from '../../src/data/cv.ts';
import { PERSON } from '../../src/data/site.ts';
import {
  formatNoteDay,
  formatNoteMonth,
  groupNotesByMonth,
  isNoteDate,
  noteLine,
} from '../../src/lib/notes.ts';
import { CLASS_STUDY_FORBIDDEN, VENUE_YEAR } from './class-study-patterns.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const SITE = join(ROOT, 'src', 'content', 'notes');
const FIXTURES = join(ROOT, 'tests', 'fixtures', 'notes');

/**
 * Lines of real notes that a pattern below flags but that Jimmy confirmed are fine, for example
 * "ISO 8601", which is not a course number. Each key is the first 16 hex characters of the line's
 * SHA-256, as the failing test prints it, and each value is his reason, with the date. Add one only
 * on his word, in that note's pull request (add-note skill, step 5).
 */
const CLEARED_LINES: Readonly<Record<string, string>> = {};

const fingerprint = (line: string) => createHash('sha256').update(line).digest('hex').slice(0, 16);

/** Every note file: what the YAML says, and how each line is written in it. */
function readNotes(dir: string) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.yaml'))
    .map((name) => {
      const raw = readFileSync(join(dir, name), 'utf8');
      const doc = parseDocument(raw);
      const lines = isMap(doc.contents) ? doc.contents.get('lines', true) : undefined;
      const items = (isSeq(lines) ? lines.items : []).map((item) =>
        isScalar(item)
          ? {
              style: item.type,
              source: item.range ? raw.slice(item.range[0], item.range[1]) : '',
              comment: item.comment || item.commentBefore || undefined,
            }
          : { style: 'not text', source: '', comment: undefined },
      );
      const data = doc.toJS() as unknown;
      return {
        name,
        id: name.replace(/\.yaml$/, ''),
        raw,
        doc,
        data,
        items,
        lines: noteSchema.safeParse(data).data?.lines ?? [],
      };
    });
}

const site = readNotes(SITE);
const fixtures = readNotes(FIXTURES);
const today = new Date().toISOString().slice(0, 10);

/** An email address with a real top-level domain (so "astro@7.4.1" is a version, not an address). */
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}\b/g;

/** Checked on every line. Each pattern is narrow, so that ordinary sentences pass. */
const EVERY_LINE: ReadonlyArray<readonly [what: string, pattern: RegExp]> = [
  // The markers sessions write: TODO(jimmy): …, **VERIFY**, DRAFT.
  ['a marker', /\bTODO\(|\bVERIFY\b|\bDRAFT\b/],
  // CLAUDE.md rule 12, the class study's course: capitals before four digits that are not a year
  // ("ABC 1234"), or three letters joined to them ("abc1234", "abc-1234").
  [
    'a course number',
    /(?<![A-Za-z])(?:[A-Z]{3}[\s-]*|[A-Za-z]{3}-?)(?!(?:19|20)\d{2}(?!\d))\d{4}[A-Za-z]?(?![A-Za-z\d])/,
  ],
  [
    'a review-board or protocol number',
    /\bIRB[\s#:-]*\d|\bprotocol\s*(?:no\.?|number|#)?\s*[A-Z]*\d{4,}/i,
  ],
];

/** A line that mentions a study, a course or the people in one also gets the class study's rules. */
const ABOUT_A_STUDY =
  /\b(?:stud(?:y|ies|ents?)|participants?|consent\w*|co-?authors?|courses?|class(?:es|mates?)?|instructors?|TAs?|surveys?|diar(?:y|ies))\b|研究|实验|课|学生|同学|参与者|被试|同意书|共同作者|问卷|日记/iu;

/**
 * More of the class study's rules, for notes: a head count with words between the number and the
 * people ("two more students"), joining or leaving without "has", and both in Chinese.
 */
const MORE_FORBIDDEN: ReadonlyArray<readonly [what: string, pattern: RegExp]> = [
  [
    'a head count',
    /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|several|dozens?)\s+(?:[a-z-]+\s+){0,2}(?:students?|co-?authors?|authors?|participants?|people|classmates?|volunteers?)\b/i,
  ],
  ['who has joined', /\b(?:joined|signed\s+up|dropped\s+out|withdrew|consented)\b/i],
  [
    'a head count',
    /[0-9０-９一二两三四五六七八九十几百]+\s*(?:个|位|名)\s*(?:学生|同学|参与者|被试|人|共同作者|作者)/u,
  ],
  [
    'who has joined',
    /(?:学生|同学|参与者|被试|共同作者|作者)[^。，；！？]{0,6}(?:加入|报名|退出|同意)|报名|签了?同意书|退课/u,
  ],
];

/** Course codes the site already shows on /teaching and /cv: public, and none is the class study's. */
const PUBLIC_COURSES = TEACHING_ASSISTANT.items.flatMap(
  (item) => item.course.match(/\b[A-Z]{3} \d{4}\b/g) ?? [],
);

/** What the patterns flag in one line, by what it looks like; never the line itself. */
function flags(line: string): string[] {
  let text = line.replace(VENUE_YEAR, '');
  if (PERSON.email) text = text.replaceAll(PERSON.email, '');
  for (const code of PUBLIC_COURSES)
    text = text.replace(new RegExp(`\\b${code.replace(' ', '[\\s-]*')}\\b`, 'gi'), '');
  const rules = ABOUT_A_STUDY.test(text)
    ? [...EVERY_LINE, ...CLASS_STUDY_FORBIDDEN, ...MORE_FORBIDDEN]
    : EVERY_LINE;
  return [...new Set(rules.filter(([, pattern]) => pattern.test(text)).map(([what]) => what))];
}

/**
 * Every problem in these lines, named by file, line number and fingerprint, without the text.
 * A cleared line skips the patterns, but no line may hold an address other than the public one.
 */
function problemsIn(
  name: string,
  lines: readonly string[],
  cleared: Readonly<Record<string, string>> = CLEARED_LINES,
): string[] {
  return lines.flatMap((line, i) => {
    const at = `${name}, line ${i + 1} (fingerprint ${fingerprint(line)})`;
    const problems = [...line.matchAll(EMAIL)]
      .filter(([address]) => address !== PERSON.email)
      .map(() => `${at}: an email address other than ${PERSON.email ?? 'none'}`);
    if (!cleared[fingerprint(line)]) problems.push(...flags(line).map((what) => `${at}: ${what}`));
    return problems;
  });
}

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

    it(`reads each note in ${where} with the schema, in quotes that keep every line as written`, () => {
      for (const note of notes) {
        expect(note.doc.errors, note.name).toEqual([]);
        expect(noteSchema.safeParse(note.data).error?.issues ?? [], note.name).toEqual([]);
        note.items.forEach((item, i) => {
          const at = `${note.name}, line ${i + 1}`;
          // A plain line would end at " #" and could turn "Learned: …" into a key.
          expect([Scalar.QUOTE_SINGLE, Scalar.QUOTE_DOUBLE], `${at}: quote the line`).toContain(
            item.style,
          );
          // In double quotes a backslash starts an escape ("\t" turns into a tab); in single
          // quotes it stays as written.
          if (item.style === Scalar.QUOTE_DOUBLE)
            expect(
              item.source,
              `${at}: write a line with a backslash in single quotes ('' for an apostrophe)`,
            ).not.toContain('\\');
          // A single quote that ends the line early leaves the rest of it as a YAML comment.
          expect(item.comment, `${at}: a quote ended early, and the rest became a comment`).toBe(
            undefined,
          );
        });
      }
    });

    it(`keeps ${where} free of markers, other addresses and study identifiers`, () => {
      // When this fails on one of Jimmy's lines, change neither his words nor these patterns:
      // hold the note back and ask him (add-note skill, step 5). A line he clears goes into
      // CLEARED_LINES, by the fingerprint this prints.
      expect(notes.flatMap((note) => problemsIn(note.name, note.lines))).toEqual([]);
    });
  }

  it('clears only lines that are in a note, each with a reason', () => {
    const lines = site.flatMap((note) => note.lines.map(fingerprint));
    for (const [key, reason] of Object.entries(CLEARED_LINES)) {
      expect(lines, `${key} matches no line of a note`).toContain(key);
      expect(reason.trim().length, `${key} gives no reason`).toBeGreaterThan(10);
    }
  });

  it('labels the test notes as synthetic, and covers what the layout must handle', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(3);
    for (const note of fixtures) expect(note.raw, note.name).toMatch(/^# Synthetic daily note/);
    const lines = fixtures.flatMap((note) => note.lines);
    const marked = lines.map(noteLine);
    expect(lines.some((line) => line.includes('#'))).toBe(true);
    expect(lines.some((line) => line.includes("'"))).toBe(true);
    expect(lines.some((line) => line.includes('\\'))).toBe(true);
    // A line all in Chinese, a Chinese line with an English word, an English line with Chinese.
    expect(marked.some((line) => line.lang === 'zh-CN')).toBe(true);
    expect(marked.some((line) => !line.lang && line.runs[0]?.lang === 'zh-CN')).toBe(true);
    expect(
      marked.some((line) => !line.lang && !line.runs[0]?.lang && line.runs.some((run) => run.lang)),
    ).toBe(true);
    expect(new Set(fixtures.map((note) => note.id.slice(0, 7))).size).toBeGreaterThan(1);
    // The newest note reaches the home page's card: it has Chinese, and a long name with no
    // place to break, which must wrap on a phone.
    const newest = [...fixtures].sort((a, b) => b.id.localeCompare(a.id))[0];
    expect(newest?.lines.some((line) => /\p{Script=Han}/u.test(line))).toBe(true);
    expect(newest?.lines.some((line) => /\S{40,}/.test(line))).toBe(true);
  });
});

describe('daily notes: the patterns', () => {
  // Synthetic lines only: none of them is about the real class study (CLAUDE.md rule 12).
  it('let ordinary sentences through', () => {
    const ordinary = [
      'Ran 5000 meters before breakfast.',
      'Wrote the 1500 words of my discussion chapter.',
      'Cleared every TODO in the site code today.',
      'Learned how the QUIC protocol 0-RTT handshake works, and read about protocol v2.',
      'Submitted a paper to DIS 2027 and read two CHI 2026 papers.',
      'Led my COP 3530 discussion section today.',
      'Bumped astro@7.4.1 and answered a question sent to raon@ufl.edu.',
      'Signed up for a 10K race in December.',
      'Had lunch with two people from my lab.',
      '今天跑了 5 公里，学会了用 Playwright 截图。',
      '读了一篇 CHI 论文，有九个作者。',
    ];
    expect(problemsIn('ordinary', ordinary, {})).toEqual([]);
  });

  it('flag course and protocol numbers, markers and other addresses', () => {
    const flagged = (line: string) => problemsIn('x', [line], {}).map((p) => p.split(': ')[1]);
    expect(flagged('Example only: ABC 1234 met today.')).toEqual(['a course number']);
    expect(flagged('Example only: abc1234 and abc-1234.')).toEqual(['a course number']);
    expect(flagged('Example only: IRB-000000 came back.')).toEqual([
      'a review-board or protocol number',
    ]);
    expect(flagged('Example only: protocol ET0000000.')).toEqual([
      'a review-board or protocol number',
    ]);
    expect(flagged('TODO(jimmy): example only.')).toEqual(['a marker']);
    expect(flagged('Example only: write to someone@example.com.')).toEqual([
      `an email address other than ${PERSON.email ?? 'none'}`,
    ]);
  });

  it('flag a head count or who joined, in a line about a study or a course', () => {
    const flagged = (line: string) => problemsIn('x', [line], {}).length > 0;
    expect(flagged('In a made-up study, 7 participants signed up.')).toBe(true);
    expect(flagged('A made-up example: two more students joined the sample course.')).toBe(true);
    expect(flagged('A made-up example: three co-authors agreed.')).toBe(true);
    expect(flagged('Example only: Dr. Example visited the sample class.')).toBe(true);
    expect(flagged('虚构的例子：这个研究又有三个同学报名了。')).toBe(true);
    expect(flagged('虚构的例子：有同学退出了这门课。')).toBe(true);
    // The same words in a line about neither are fine.
    expect(flagged('Seven people came to the reading group.')).toBe(false);
  });

  it('skip the patterns for a line Jimmy cleared, but never the address check', () => {
    const line = 'Read RFC 9110 on HTTP caching.';
    expect(problemsIn('x', [line], {})).toHaveLength(1);
    expect(
      problemsIn('x', [line], { [fingerprint(line)]: 'An RFC, not a course number.' }),
    ).toEqual([]);
    const address = 'Example only: wrote to someone@example.com.';
    expect(
      problemsIn('x', [address], { [fingerprint(address)]: 'Cleared, but still an address.' }),
    ).toHaveLength(1);
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

  it('refuses empty lines, padded lines, line breaks, control characters and anything but text', () => {
    expect(lines('')).toBe(false);
    expect(lines(' Padded.')).toBe(false);
    expect(lines('Two\nsentences.')).toBe(false);
    expect(lines('Two\u2028sentences.')).toBe(false);
    // What "\textbf" and "\begin" turn into inside YAML double quotes: a tab, a backspace.
    expect(lines('Fixed \textbf.')).toBe(false);
    expect(lines('Fixed \begin.')).toBe(false);
    expect(lines('Fixed \\textbf and \\begin, as written.')).toBe(true);
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

  it('marks Chinese text as Chinese, by runs, and keeps every character', () => {
    const marked = (line: string) => {
      const { lang, runs } = noteLine(line);
      expect(runs.map((run) => run.text).join('')).toBe(line);
      return [lang ?? null, runs.filter((run) => run.lang).map((run) => run.text)];
    };
    // All Chinese: the whole line.
    expect(marked('今天把网站的新页面做好了。')).toEqual(['zh-CN', []]);
    expect(marked('今天跑了 5 公里。')).toEqual(['zh-CN', []]);
    expect(marked('他说“好的”。')).toEqual(['zh-CN', []]);
    // Chinese with English terms: each run of Chinese, the terms in the page's English.
    expect(marked('今天学会用 Playwright 截图。')).toEqual([null, ['今天学会用', '截图。']]);
    expect(marked('读了 CHI paper')).toEqual([null, ['读了']]);
    expect(marked('和advisor开了weekly meeting，讨论了CHI submission。')).toEqual([
      null,
      ['和', '开了', '，讨论了', '。'],
    ]);
    // English with a Chinese phrase: only the phrase.
    expect(marked('Cooked 红烧肉 for dinner.')).toEqual([null, ['红烧肉']]);
    expect(marked('Read 《人类简史》 again.')).toEqual([null, ['《人类简史》']]);
    expect(marked('Wrote 饶楠杰 beside my name on the CV.')).toEqual([null, ['饶楠杰']]);
    // No Chinese at all.
    expect(marked('Finished the notes page today.')).toEqual([null, []]);
    expect(marked('2026: 12 of 12.')).toEqual([null, []]);
  });
});
