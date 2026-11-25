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
import { CLASS_STUDY_FORBIDDEN, COURSE_NUMBER, VENUE_YEAR } from './class-study-patterns.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const SITE = join(ROOT, 'src', 'content', 'notes');
const FIXTURES = join(ROOT, 'tests', 'fixtures', 'notes');

/**
 * Lines of real notes that a pattern below flags but that Jimmy confirmed are fine, for example
 * "ISO 8601", which is not a course number. Each key is the first 16 hex characters of the line's
 * SHA-256, as the failing test prints it. Each value is a reason of a few words with the date,
 * written by the session and never pasted from his message ("Jimmy, 2026-11-26: an RFC number,
 * not a course number."): it names no course, person, count or facts.md §15 detail, and the
 * patterns run over it too. Add one only on his word, in that note's pull request (add-note
 * skill, step 5).
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

/**
 * A line that mentions a study, a course or the people in one also gets the class study's rules.
 * "Of course" is not a course, and 实验室 (a lab) is not an experiment.
 */
const ABOUT_A_STUDY =
  /\b(?:stud(?:y|ies|ents?)|participants?|consent\w*|co-?authors?|courses?|class(?:es|mates?)?|instructors?|TAs?|teaching\s+assistants?|surveys?|diar(?:y|ies))\b|研究|实验(?!室)|课|学生|同学|参与者|被试|同意书|共同作者|问卷|日记|助教/iu;
const NOT_A_COURSE = /\bof\s+course\b/gi;

/**
 * Words that come with a course. A line with one also gets the course-number pattern in any case
 * ("abc 1234"), which on every line would stop sentences like "Did 8000 steps today."
 */
const ABOUT_A_COURSE =
  /\b(?:labs?|lectures?|homework|assignments?|exams?|midterms?|quiz(?:zes)?|syllabus|semesters?|rubrics?|recitations?|office\s+hours)\b|作业|考试|期中|期末|学期/iu;

/**
 * The class study's rules for a line about a study, without its broad address pattern: every
 * line is checked for addresses already, and that pattern reads "astro@7.4.1" as one.
 */
const STUDY_RULES = CLASS_STUDY_FORBIDDEN.filter(([what]) => what !== 'an email address');

/** People, or what stands for them in a count, in English or Chinese. */
const WHO = String.raw`(?:学生|同学|参与者|被试|人(?!工智能|机)|共同作者|作者|同意书|问卷|日记|\b(?:students?|co-?authors?|authors?|participants?|people|classmates?|volunteers?|respondents?|responses?|consent\s*forms?|surveys?|diar(?:y|ies))\b)`;
const NUMBER_WORD = String.raw`one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|(?:thir|four|fif|six|seven|eigh|nine)teen|(?:twen|thir|for|fif|six|seven|eigh|nine)ty|hundreds?|several|dozens?`;

/**
 * More of the class study's rules, for notes, in either language or both mixed: a head count with
 * up to two words between the number and the people ("two more students", "7+ students",
 * "7个participants", "十多个学生", "七份同意书"); joining or leaving without "has" ("joined",
 * "sign up了", "学生加入"); a name with a Chinese title ("甲老师"), not a role ("课的老师", "当助教").
 */
const MORE_FORBIDDEN: ReadonlyArray<readonly [what: string, pattern: RegExp]> = [
  [
    'a head count',
    new RegExp(String.raw`\b(?:\d+\+?|${NUMBER_WORD})\s+(?:[a-z-]+\s+){0,2}${WHO}`, 'iu'),
  ],
  [
    'a head count',
    new RegExp(
      String.raw`[0-9０-９一二两三四五六七八九十几百]+[多来余]?\s*(?:个|位|名|份)\s*${WHO}`,
      'iu',
    ),
  ],
  [
    'who has joined',
    /\b(?:joined|signed\s+up|dropped\s+out|withdrew|consented)\b|\b(?:join|sign\s*up|drop(?:\s*out)?|withdraw|quit)\s*了/iu,
  ],
  [
    'who has joined',
    new RegExp(
      String.raw`${WHO}[^。，；！？]{0,6}(?:加入|报名|退出|同意)|报名|签了?同意书|退课`,
      'iu',
    ),
  ],
  [
    'a person with a title',
    /[^\P{Script=Han}的和跟与同给对问找请让被是有个位名们当做]\s*(?:老师|教授|助教)|\b\p{Lu}\p{Ll}+\s*(?:老师|教授|助教)/u,
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
  const topic = text.replace(NOT_A_COURSE, '');
  const rules: ReadonlyArray<readonly [what: string, pattern: RegExp]> = ABOUT_A_STUDY.test(topic)
    ? [...EVERY_LINE, ...STUDY_RULES, ...MORE_FORBIDDEN]
    : ABOUT_A_COURSE.test(topic)
      ? [...EVERY_LINE, ['a course number', COURSE_NUMBER]]
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
      // The reason is public too: it must pass the same patterns.
      expect(problemsIn(`the reason for ${key}`, [reason], {})).toEqual([]);
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
    // A line all in Chinese (one starts with a number), a Chinese line with an English word, an
    // English line with Chinese.
    expect(marked.some((line) => line.lang === 'zh-CN')).toBe(true);
    expect(lines.some((line) => /^\d/.test(line) && noteLine(line).lang === 'zh-CN')).toBe(true);
    expect(marked.some((line) => !line.lang && line.runs[0]?.lang === 'zh-CN')).toBe(true);
    expect(
      marked.some((line) => !line.lang && !line.runs[0]?.lang && line.runs.some((run) => run.lang)),
    ).toBe(true);
    expect(new Set(fixtures.map((note) => note.id.slice(0, 7))).size).toBeGreaterThan(1);
    // The newest note reaches the home page's card: it has Chinese, and a long name with no
    // place to break, which must wrap on a phone. It also has "protocol v2", which this test
    // lets through: the class-study page's end-to-end check of the home page must leave the
    // card out, or it would stop such a note.
    const newest = [...fixtures].sort((a, b) => b.id.localeCompare(a.id))[0];
    expect(newest?.lines.some((line) => /\p{Script=Han}/u.test(line))).toBe(true);
    expect(newest?.lines.some((line) => /\S{40,}/.test(line))).toBe(true);
    expect(newest?.lines.some((line) => /\bprotocol\s+\S*\d/.test(line))).toBe(true);
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
      'Did 8000 steps today.',
      '今天跑了 5 公里，学会了用 Playwright 截图。',
      '读了一篇 CHI 论文，有九个作者。',
      // Words that look like a study or a course but are not.
      'Of course, two people from my lab came to lunch.',
      'Of course I ran 5000 meters before breakfast.',
      '和实验室的两个人吃了午饭。',
      '今天一个人在实验室待到很晚。',
      // Lines about a study or a course without a count, a joining or a name.
      'Bumped astro@7.4.1 on the course website.',
      "TA'd two sections of the course today.",
      'Wrote the Study 2 analysis plan and a survey design.',
      'Graded the homework for my COP 3530 section.',
      '今天读了一个人机交互方向的研究。',
      '瑜伽课的老师人很好。',
      '研究生院的老师帮我改了论文格式。',
      '当助教的第一周，讲了两个小时。',
    ];
    expect(problemsIn('ordinary', ordinary, {})).toEqual([]);
  });

  it('flag course and protocol numbers, markers and other addresses', () => {
    const flagged = (line: string) => problemsIn('x', [line], {}).map((p) => p.split(': ')[1]);
    expect(flagged('Example only: ABC 1234 met today.')).toEqual(['a course number']);
    expect(flagged('Example only: abc1234 and abc-1234.')).toEqual(['a course number']);
    // In lower or title case with a space, a code counts in a line about a course.
    expect(flagged('Example only: graded abc 1234 homework tonight.')).toEqual(['a course number']);
    expect(flagged('Example only: gave the Abc 1234 lecture.')).toEqual(['a course number']);
    expect(flagged('Abc 1234 lab today, example only.')).toEqual(['a course number']);
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
    expect(flagged('Example only: the course ABC 2050 started.')).toBe(true);
    // Counts that are approximate, above twelve, or of forms; mixed Chinese and English.
    for (const line of [
      'Example only: 7+ students are in the made-up study so far.',
      'Example only: thirteen students are in the made-up study now.',
      'Example only: got 7 consent forms back for the made-up study.',
      'A made-up example: two more joined class today.',
      '虚构的例子：这个研究现在有十多个学生。',
      '虚构的例子：收到了七份同意书。',
      '虚构的例子：又有一个人加入了研究。',
      '虚构的例子：这个课题又多了两个人。',
      '虚构的例子：这个study有7个participants。',
      '虚构的例子：又有两个participants加入了study。',
      '虚构的例子：又有学生sign up了study。',
      '虚构的例子：这门课的甲老师今天来了。',
    ])
      expect(flagged(line), line).toBe(true);
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
    // Chinese without Latin letters: the whole line, its numbers and punctuation included.
    for (const line of [
      '今天把网站的新页面做好了。',
      '今天跑了 5 公里。',
      '他说“好的”。',
      '3点才睡，书看完了。',
      '2026年的第一场雪。',
      '今天跑了5.2公里。',
      '手机电量只剩12.5%。',
      '下午3:30开会。',
      '今天写了3,000字。',
      '今天好累……',
      '11月25日，下雪了。',
      '——今天的感想。',
    ])
      expect(marked(line), line).toEqual(['zh-CN', []]);
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
