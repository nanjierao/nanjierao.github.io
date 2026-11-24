// Daily notes (D71): plain helpers for the /notes/ page and the home page's card. No Astro
// imports, so the unit tests and the collection config can use them.

/** A note's id is its date, YYYY-MM-DD, and must be a real calendar day. */
export function isNoteDate(id: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(id);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function utc(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1);
}

const DAY = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "2026-11-25" → "Wednesday, November 25" (the month heading above it gives the year). */
export function formatNoteDay(id: string): string {
  return DAY.format(utc(id));
}

/** "2026-11" → "November 2026". */
export function formatNoteMonth(month: string): string {
  return MONTH.format(utc(`${month}-01`));
}

/** Notes grouped by month: newest month first, and the newest day first within each month. */
export function groupNotesByMonth<T extends { id: string }>(
  notes: readonly T[],
): Array<{ month: string; notes: T[] }> {
  const groups: Array<{ month: string; notes: T[] }> = [];
  for (const note of [...notes].sort((a, b) => b.id.localeCompare(a.id))) {
    const month = note.id.slice(0, 7);
    const last = groups.at(-1);
    if (last?.month === month) last.notes.push(note);
    else groups.push({ month, notes: [note] });
  }
  return groups;
}

/** The folder the notes collection reads: the real notes, or the synthetic ones for the tests. */
export function notesDir(): string {
  return process.env.NOTES_FIXTURES === '1' ? 'tests/fixtures/notes' : 'src/content/notes';
}

/** Chinese characters, CJK punctuation and full-width forms. */
const CJK = '\\p{Script=Han}\\u3000-\\u303F\\uFF00-\\uFFEF';
/** What may sit between two stretches of Chinese and still belong to them. */
const GLUE = '\\s\\d\\u00B7\\u2014\\u2018-\\u201F\\u2026';
/** One run of Chinese, with an opening quote before it and a closing quote after it. */
const CHINESE_RUN = new RegExp(
  `([\\u2018\\u201C]?[${CJK}]+(?:[${GLUE}]*[${CJK}]+)*[\\u2019\\u201D]?)`,
  'u',
);

export interface NoteRun {
  text: string;
  lang?: 'zh-CN';
}

/**
 * One line of a note, marked for language (WCAG 2.2, 3.1.2) without guessing at the line as a
 * whole: Chinese characters are Chinese, everything else is the page's English. A line that is
 * all Chinese gets lang="zh-CN" itself. In a mixed line each run of Chinese gets its own, so a
 * Chinese sentence with English terms and an English sentence with a Chinese phrase both come
 * out right. The runs join back into the line, character for character.
 */
export function noteLine(line: string): { lang?: 'zh-CN'; runs: NoteRun[] } {
  const runs: NoteRun[] = line
    .split(CHINESE_RUN)
    .map((text, i) => (i % 2 === 1 ? { text, lang: 'zh-CN' as const } : { text }))
    .filter((run) => run.text !== '');
  if (runs.length === 1 && runs[0]?.lang) return { lang: 'zh-CN', runs: [{ text: line }] };
  return { runs };
}
